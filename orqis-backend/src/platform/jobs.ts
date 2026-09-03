import { Types } from "mongoose";
import { connectMongoose } from "../db/mongoose.js";
import {
  InvocationModel,
  type InvocationDoc,
} from "../models/Invocation.js";
import { AgentModel } from "../models/Agent.js";

/**
 * Async-job rows for the /dashboard/jobs page. Async = isAsync: true.
 * We pull the latest N rows so the page renders instantly even with thousands
 * of historical jobs; running ones are polled client-side from there.
 */
export type JobRowView = {
  id: string;
  agentSlug?: string;
  agentName?: string;
  agentEmoji?: string;
  status: InvocationDoc["status"];
  errorCode: string;
  errorMessage: string;
  creditsCharged: number;
  latencyMs: number | null;
  createdAt: string;
  completedAt: string | null;
  // For successful runs we surface a previewUrl shortcut so the dashboard can
  // link straight to the artifact (matches the TryItPanel behavior).
  previewUrl?: string;
  downloadUrl?: string;
};

function asUrl(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

export async function listJobsForUser(
  userId: string,
  limit = 30
): Promise<JobRowView[]> {
  if (!Types.ObjectId.isValid(userId)) return [];
  await connectMongoose();
  const docs = await InvocationModel.find({
    userId: new Types.ObjectId(userId),
    isAsync: true,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<InvocationDoc[]>();

  if (docs.length === 0) return [];
  const agentIds = Array.from(new Set(docs.map((d) => String(d.agentId))));
  const agents = await AgentModel.find({
    _id: { $in: agentIds.map((id) => new Types.ObjectId(id)) },
  })
    .select({ slug: 1, name: 1, iconEmoji: 1 })
    .lean();
  const byId = new Map(agents.map((a) => [String(a._id), a]));

  return docs.map<JobRowView>((d) => {
    const a = byId.get(String(d.agentId));
    const result = d.result as Record<string, unknown> | null;
    return {
      id: String(d._id),
      agentSlug: a?.slug,
      agentName: a?.name,
      agentEmoji: a?.iconEmoji ?? "",
      status: d.status,
      errorCode: d.errorCode ?? "",
      errorMessage: d.errorMessage ?? "",
      creditsCharged: d.creditsCharged,
      latencyMs: d.latencyMs ?? null,
      createdAt:
        d.createdAt instanceof Date
          ? d.createdAt.toISOString()
          : new Date(d.createdAt as unknown as string).toISOString(),
      completedAt: d.completedAt
        ? d.completedAt instanceof Date
          ? d.completedAt.toISOString()
          : new Date(d.completedAt as unknown as string).toISOString()
        : null,
      previewUrl: asUrl(result?.previewUrl) ?? asUrl(result?.url),
      downloadUrl:
        asUrl(result?.downloadUrl) ??
        asUrl(result?.htmlDownloadUrl) ??
        asUrl(result?.previewUrl),
    };
  });
}

/**
 * Single async job, scoped to its owner (Sprint 19).
 *
 * Ownership is checked here rather than in the route so that an invocation id
 * can never act as a bearer capability — a job id is guessable-ish and must
 * not let one signed-in user poll another's result.
 *
 * Returns null both for "no such job" and "not yours", so the caller's 404
 * doesn't confirm the existence of someone else's invocation.
 */
export type JobDetailView = {
  invocationId: string;
  status: InvocationDoc["status"];
  isAsync: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
  creditsCharged: number;
  errorCode: string;
  errorMessage: string;
  result: unknown;
  createdAt: string;
  completedAt: string | null;
};

function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : new Date(v as string).toISOString();
}

export async function getJobForUser(
  userId: string,
  invocationId: string
): Promise<JobDetailView | null> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(invocationId)) return null;
  await connectMongoose();
  const inv = await InvocationModel.findById(invocationId).lean<InvocationDoc>();
  if (!inv) return null;
  if (String(inv.userId) !== String(userId)) return null;

  return {
    invocationId: String(inv._id),
    status: inv.status,
    isAsync: !!inv.isAsync,
    httpStatus: inv.httpStatus ?? null,
    latencyMs: inv.latencyMs ?? null,
    creditsCharged: inv.creditsCharged,
    errorCode: inv.errorCode ?? "",
    errorMessage: inv.errorMessage ?? "",
    result: inv.result ?? null,
    createdAt: iso(inv.createdAt),
    completedAt: inv.completedAt ? iso(inv.completedAt) : null,
  };
}
