import { Types } from "mongoose";
import { connectMongoose } from "../db/mongoose.js";
import { ReviewModel, type ReviewDoc } from "../models/Review.js";
import { AgentModel } from "../models/Agent.js";

export type ReviewView = {
  id: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  authorImage: string;
  verifiedUse: boolean;
  createdAt: string; // ISO
  isMine: boolean;
};

function fromDoc(doc: ReviewDoc, currentUserId?: string): ReviewView {
  return {
    id: String(doc._id),
    rating: doc.rating,
    title: doc.title ?? "",
    body: doc.body ?? "",
    authorName: doc.authorName || "Anonymous",
    authorImage: doc.authorImage || "",
    verifiedUse: !!doc.verifiedUse,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : new Date(doc.createdAt as unknown as string).toISOString(),
    isMine: currentUserId ? String(doc.userId) === currentUserId : false,
  };
}

export async function getReviewsForAgent(
  agentId: string,
  currentUserId?: string,
  limit = 20
): Promise<ReviewView[]> {
  if (!Types.ObjectId.isValid(agentId)) return [];
  try {
    await connectMongoose();
    const docs = await ReviewModel.find({ agentId: new Types.ObjectId(agentId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<ReviewDoc[]>();
    return docs.map((d) => fromDoc(d, currentUserId));
  } catch (err) {
    console.warn("[reviews.getReviewsForAgent] failed:", (err as Error).message);
    return [];
  }
}

export async function getMyReviewForAgent(
  agentId: string,
  userId: string
): Promise<ReviewView | null> {
  if (!Types.ObjectId.isValid(agentId) || !Types.ObjectId.isValid(userId)) return null;
  try {
    await connectMongoose();
    const doc = await ReviewModel.findOne({
      agentId: new Types.ObjectId(agentId),
      userId: new Types.ObjectId(userId),
    }).lean<ReviewDoc>();
    return doc ? fromDoc(doc, userId) : null;
  } catch {
    return null;
  }
}

/**
 * Recomputes ratingAverage + ratingCount on the Agent doc from the reviews
 * collection. Cheap to do on every write while we're at small scale; we can
 * batch this later if it becomes a hot path.
 */
export async function recomputeAgentRating(agentId: Types.ObjectId): Promise<void> {
  await connectMongoose();
  const [agg] = await ReviewModel.aggregate<{
    _id: null;
    avg: number;
    count: number;
  }>([
    { $match: { agentId } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await AgentModel.updateOne(
    { _id: agentId },
    {
      $set: {
        ratingAverage: agg ? Math.round(agg.avg * 10) / 10 : 0,
        ratingCount: agg ? agg.count : 0,
      },
    }
  );
}

/**
 * Upsert a review (one per user per agent). Returns the resulting view.
 * Throws on validation failure.
 */
export async function upsertReview(input: {
  agentId: string;
  userId: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  authorImage: string;
}): Promise<ReviewView> {
  if (!Types.ObjectId.isValid(input.agentId)) {
    throw new Error("Invalid agentId");
  }
  if (!Types.ObjectId.isValid(input.userId)) {
    throw new Error("Invalid userId");
  }
  if (!Number.isFinite(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  await connectMongoose();
  const agentObjectId = new Types.ObjectId(input.agentId);
  const userObjectId = new Types.ObjectId(input.userId);

  const doc = await ReviewModel.findOneAndUpdate(
    { agentId: agentObjectId, userId: userObjectId },
    {
      $set: {
        rating: Math.round(input.rating),
        title: input.title.trim().slice(0, 120),
        body: input.body.trim().slice(0, 4000),
        authorName: input.authorName.slice(0, 80),
        authorImage: input.authorImage.slice(0, 500),
      },
    },
    { upsert: true, returnDocument: "after" }
  ).lean<ReviewDoc>();

  await recomputeAgentRating(agentObjectId);

  if (!doc) throw new Error("Failed to upsert review");
  return fromDoc(doc, input.userId);
}
