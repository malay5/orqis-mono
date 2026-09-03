import "server-only";
import { apiFetchSafe } from "@/lib/api-client";

/**
 * Per-agent seller analytics (Sprint 19 — via the platform API).
 *
 * The aggregation moved to the backend, which also enforces ownership: a
 * seller can only read their own listing's numbers, and the route returns 404
 * (not 403) for someone else's slug so it can't be used to probe the
 * catalogue for who owns what.
 */

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
    status: "draft" | "pending" | "approved" | "rejected";
    ratingAverage: number;
    ratingCount: number;
  };
  windowDays: number;
  summary: AnalyticsSummary;
  recentInvocations: Array<{
    id: string;
    status: "pending" | "succeeded" | "failed" | "refunded";
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

export async function loadAgentAnalytics(input: {
  slug: string;
  callerUserId?: string;
  callerIsAdmin?: boolean;
}): Promise<AgentAnalytics | null> {
  const data = await apiFetchSafe<{ analytics: AgentAnalytics }>(
    `/v1/seller/agents/${encodeURIComponent(input.slug)}/analytics`,
    { authenticated: true }
  );
  return data?.analytics ?? null;
}
