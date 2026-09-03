import { Types } from "mongoose";
import { connectMongoose } from "../db/mongoose.js";
import { AgentModel, type AgentDoc } from "../models/Agent.js";
import {
  InvocationModel,
  type InvocationDoc,
} from "../models/Invocation.js";
import { ReviewModel, type ReviewDoc } from "../models/Review.js";

/**
 * Per-agent analytics for the seller dashboard.
 *
 * All time-series math happens inside Mongo via the aggregation pipeline so
 * the page renders fast even for sellers with 10k+ invocations. The page
 * server-renders with a 30-day window; we keep the slice small.
 */

const WINDOW_DAYS = 30;

export type DailyBucket = {
  /** YYYY-MM-DD in UTC. */
  date: string;
  succeeded: number;
  failed: number; // failed + refunded combined for the chart
  pending: number;
};

export type AnalyticsSummary = {
  totalInvocations: number;
  totalSucceeded: number;
  totalRefunded: number;
  totalFailed: number;
  totalPending: number;
  successRate: number; // 0..1
  refundRate: number; // 0..1
  creditsEarned: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  daily: DailyBucket[];
};

export type AgentAnalytics = {
  agent: {
    id: string;
    slug: string;
    name: string;
    iconEmoji: string;
    accentHex: string;
    pricePerCall: number;
    isAsync: boolean;
    status: AgentDoc["status"];
    ratingAverage: number;
    ratingCount: number;
  };
  windowDays: number;
  summary: AnalyticsSummary;
  recentInvocations: Array<{
    id: string;
    status: InvocationDoc["status"];
    creditsCharged: number;
    latencyMs: number | null;
    errorCode: string;
    createdAt: string;
  }>;
  recentReviews: Array<{
    id: string;
    rating: number;
    title: string;
    body: string;
    authorName: string;
    verifiedUse: boolean;
    createdAt: string;
  }>;
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Permission check + analytics fetch in one. Returns null when:
 *   - the slug doesn't exist, OR
 *   - the caller is neither the seller of this agent nor an admin.
 *
 * We deliberately don't distinguish 404 vs 403 to the caller — keeps URL
 * enumeration from leaking which slugs exist.
 */
export async function loadAgentAnalytics(input: {
  slug: string;
  callerUserId: string;
  callerIsAdmin: boolean;
}): Promise<AgentAnalytics | null> {
  if (!Types.ObjectId.isValid(input.callerUserId)) return null;
  await connectMongoose();

  const agent = await AgentModel.findOne({ slug: input.slug }).lean<AgentDoc>();
  if (!agent) return null;
  const isOwner = agent.sellerId && String(agent.sellerId) === input.callerUserId;
  if (!isOwner && !input.callerIsAdmin) return null;

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // --- Aggregate stats + daily buckets in one round trip per shape ---
  const [statsAgg, dailyAgg, latencySamples, recentInvocations, recentReviews] =
    await Promise.all([
      InvocationModel.aggregate<{
        _id: InvocationDoc["status"];
        count: number;
        credits: number;
      }>([
        { $match: { agentId: agent._id, createdAt: { $gte: since } } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            credits: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "succeeded"] },
                  "$creditsCharged",
                  0,
                ],
              },
            },
          },
        },
      ]),
      InvocationModel.aggregate<{
        _id: { date: string; status: InvocationDoc["status"] };
        count: number;
      }>([
        { $match: { agentId: agent._id, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
      ]),
      // Latency samples — only succeeded rows. Cap at 5k to keep math cheap;
      // anything bigger than that needs t-digest, out of scope for Sprint 11.
      InvocationModel.find({
        agentId: agent._id,
        status: "succeeded",
        createdAt: { $gte: since },
        latencyMs: { $ne: null },
      })
        .select({ latencyMs: 1 })
        .limit(5000)
        .lean<Pick<InvocationDoc, "latencyMs">[]>(),
      InvocationModel.find({ agentId: agent._id })
        .sort({ createdAt: -1 })
        .limit(15)
        .lean<InvocationDoc[]>(),
      ReviewModel.find({ agentId: agent._id })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean<ReviewDoc[]>(),
    ]);

  // --- Roll up stats ---
  const counts = {
    succeeded: 0,
    failed: 0,
    refunded: 0,
    pending: 0,
  };
  let creditsEarned = 0;
  for (const row of statsAgg) {
    if (row._id === "succeeded") counts.succeeded = row.count;
    else if (row._id === "failed") counts.failed = row.count;
    else if (row._id === "refunded") counts.refunded = row.count;
    else if (row._id === "pending") counts.pending = row.count;
    creditsEarned += row.credits ?? 0;
  }
  const total =
    counts.succeeded + counts.failed + counts.refunded + counts.pending;
  const successRate = total > 0 ? counts.succeeded / total : 0;
  // Refund rate excludes pending (those aren't terminal yet).
  const terminal = counts.succeeded + counts.failed + counts.refunded;
  const refundRate = terminal > 0 ? counts.refunded / terminal : 0;

  // --- Latency percentiles ---
  const latencies = latencySamples
    .map((r) => r.latencyMs)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
  const pct = (p: number): number | null => {
    if (latencies.length === 0) return null;
    const idx = Math.min(latencies.length - 1, Math.floor(p * latencies.length));
    return Math.round(latencies[idx]);
  };

  // --- Daily buckets (back-fill empty days so the chart has a continuous axis) ---
  const dailyMap = new Map<string, DailyBucket>();
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(Date.now() - (WINDOW_DAYS - 1 - i) * 24 * 60 * 60 * 1000);
    dailyMap.set(isoDay(d), { date: isoDay(d), succeeded: 0, failed: 0, pending: 0 });
  }
  for (const row of dailyAgg) {
    const bucket = dailyMap.get(row._id.date);
    if (!bucket) continue;
    if (row._id.status === "succeeded") bucket.succeeded += row.count;
    else if (row._id.status === "pending") bucket.pending += row.count;
    else bucket.failed += row.count; // failed + refunded both go in the failure stack
  }

  return {
    agent: {
      id: String(agent._id),
      slug: agent.slug,
      name: agent.name,
      iconEmoji: agent.iconEmoji ?? "",
      accentHex: agent.accentHex ?? "#a855f7",
      pricePerCall: agent.pricePerCall,
      isAsync: agent.isAsync,
      status: agent.status,
      ratingAverage: agent.ratingAverage ?? 0,
      ratingCount: agent.ratingCount ?? 0,
    },
    windowDays: WINDOW_DAYS,
    summary: {
      totalInvocations: total,
      totalSucceeded: counts.succeeded,
      totalRefunded: counts.refunded,
      totalFailed: counts.failed,
      totalPending: counts.pending,
      successRate,
      refundRate,
      creditsEarned,
      p50LatencyMs: pct(0.5),
      p95LatencyMs: pct(0.95),
      daily: Array.from(dailyMap.values()),
    },
    recentInvocations: recentInvocations.map((d) => ({
      id: String(d._id),
      status: d.status,
      creditsCharged: d.creditsCharged,
      latencyMs: d.latencyMs ?? null,
      errorCode: d.errorCode ?? "",
      createdAt:
        d.createdAt instanceof Date
          ? d.createdAt.toISOString()
          : new Date(d.createdAt as unknown as string).toISOString(),
    })),
    recentReviews: recentReviews.map((r) => ({
      id: String(r._id),
      rating: r.rating,
      title: r.title ?? "",
      body: r.body ?? "",
      authorName: r.authorName || "Anonymous",
      verifiedUse: !!r.verifiedUse,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : new Date(r.createdAt as unknown as string).toISOString(),
    })),
  };
}
