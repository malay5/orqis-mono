import { Types } from "mongoose";
import { createHash } from "node:crypto";
import { connectMongoose } from "../db/mongoose.js";
import {
  InvocationModel,
  type InvocationDoc,
} from "../models/Invocation.js";
import { AgentModel } from "../models/Agent.js";
import { ReviewModel } from "../models/Review.js";

export function hashCanonicalJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function previewBody(body: string, max = 512): string {
  if (body.length <= max) return body;
  return `${body.slice(0, max)}…`;
}

export async function recordInvocationStart(input: {
  agentId: Types.ObjectId;
  userId: Types.ObjectId;
  callerType?: InvocationDoc["callerType"];
  pricePerCall: number;
  requestPayload: unknown;
  requestBytes: number;
}): Promise<InvocationDoc> {
  await connectMongoose();
  return InvocationModel.create({
    agentId: input.agentId,
    userId: input.userId,
    callerType: input.callerType ?? "session",
    creditsCharged: input.pricePerCall,
    status: "pending",
    requestHash: hashCanonicalJson(input.requestPayload),
    requestBytes: input.requestBytes,
  });
}

export async function markInvocationSucceeded(input: {
  invocationId: Types.ObjectId;
  agentId: Types.ObjectId;
  userId: Types.ObjectId;
  httpStatus: number;
  latencyMs: number;
  responseBody: string;
}) {
  await connectMongoose();
  await InvocationModel.updateOne(
    { _id: input.invocationId },
    {
      $set: {
        status: "succeeded",
        httpStatus: input.httpStatus,
        latencyMs: input.latencyMs,
        responseBytes: Buffer.byteLength(input.responseBody, "utf8"),
        responsePreview: previewBody(input.responseBody),
      },
    }
  );
  await AgentModel.updateOne(
    { _id: input.agentId },
    { $inc: { invocationCount: 1 } }
  );
  // Promote any of this user's reviews of this agent to verified.
  await ReviewModel.updateMany(
    { agentId: input.agentId, userId: input.userId, verifiedUse: { $ne: true } },
    { $set: { verifiedUse: true } }
  );
}

export async function markInvocationFailed(input: {
  invocationId: Types.ObjectId;
  httpStatus: number | null;
  latencyMs: number;
  errorCode: string;
  errorMessage: string;
  responseBody?: string;
  refunded: boolean;
}) {
  await connectMongoose();
  await InvocationModel.updateOne(
    { _id: input.invocationId },
    {
      $set: {
        status: input.refunded ? "refunded" : "failed",
        httpStatus: input.httpStatus,
        latencyMs: input.latencyMs,
        errorCode: input.errorCode.slice(0, 80),
        errorMessage: input.errorMessage.slice(0, 1000),
        responseBytes: input.responseBody ? Buffer.byteLength(input.responseBody, "utf8") : 0,
        responsePreview: input.responseBody ? previewBody(input.responseBody) : "",
      },
    }
  );
}

export type InvocationView = {
  id: string;
  agentId: string;
  agentSlug?: string;
  agentName?: string;
  agentEmoji?: string;
  status: InvocationDoc["status"];
  httpStatus: number | null;
  latencyMs: number | null;
  creditsCharged: number;
  errorCode: string;
  createdAt: string;
};

export async function recentInvocationsForUser(
  userId: string,
  limit = 25
): Promise<InvocationView[]> {
  if (!Types.ObjectId.isValid(userId)) return [];
  await connectMongoose();

  const docs = await InvocationModel.find({ userId: new Types.ObjectId(userId) })
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

  return docs.map<InvocationView>((d) => {
    const a = byId.get(String(d.agentId));
    return {
      id: String(d._id),
      agentId: String(d.agentId),
      agentSlug: a?.slug,
      agentName: a?.name,
      agentEmoji: a?.iconEmoji ?? "",
      status: d.status,
      httpStatus: d.httpStatus ?? null,
      latencyMs: d.latencyMs ?? null,
      creditsCharged: d.creditsCharged,
      errorCode: d.errorCode ?? "",
      createdAt:
        d.createdAt instanceof Date
          ? d.createdAt.toISOString()
          : new Date(d.createdAt as unknown as string).toISOString(),
    };
  });
}

export async function countInvocationsThisWeek(userId: string): Promise<number> {
  if (!Types.ObjectId.isValid(userId)) return 0;
  await connectMongoose();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return InvocationModel.countDocuments({
    userId: new Types.ObjectId(userId),
    createdAt: { $gte: since },
  });
}

/**
 * Sprint 18 (F6): true iff `userId` has at least one successful invocation
 * for `agentId`. Used to gate review submission so any signed-in user can't
 * leave an unverified rating on an agent they've never tried.
 */
export async function hasSucceededInvocation(
  userId: string,
  agentId: string
): Promise<boolean> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(agentId)) {
    return false;
  }
  await connectMongoose();
  const hit = await InvocationModel.findOne({
    userId: new Types.ObjectId(userId),
    agentId: new Types.ObjectId(agentId),
    status: "succeeded",
  })
    .select("_id")
    .lean();
  return !!hit;
}
