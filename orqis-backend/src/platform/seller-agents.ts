import { Types } from "mongoose";
import { connectMongoose } from "../db/mongoose.js";
import { AgentModel, type AgentDoc } from "../models/Agent.js";

/** Slug normaliser shared by the seller form and the API. */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export type SellerAgentRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  pricePerCall: number;
  isAsync: boolean;
  status: AgentDoc["status"];
  ratingAverage: number;
  ratingCount: number;
  invocationCount: number;
  createdAt: string;
};

export async function listSellerAgents(sellerUserId: string): Promise<SellerAgentRow[]> {
  if (!Types.ObjectId.isValid(sellerUserId)) return [];
  await connectMongoose();
  const docs = await AgentModel.find({ sellerId: new Types.ObjectId(sellerUserId) })
    .sort({ createdAt: -1 })
    .lean<AgentDoc[]>();
  return docs.map((d) => ({
    id: String(d._id),
    slug: d.slug,
    name: d.name,
    tagline: d.tagline,
    category: d.category,
    pricePerCall: d.pricePerCall,
    isAsync: d.isAsync,
    status: d.status,
    ratingAverage: d.ratingAverage ?? 0,
    ratingCount: d.ratingCount ?? 0,
    invocationCount: d.invocationCount ?? 0,
    createdAt:
      d.createdAt instanceof Date
        ? d.createdAt.toISOString()
        : new Date(d.createdAt as unknown as string).toISOString(),
  }));
}

/**
 * Pending / reviewing seller-submitted Agent docs. Distinct from the
 * AgentSubmission collection (those come from the unauthenticated public form).
 */
export async function listPendingListings(): Promise<SellerAgentRow[]> {
  await connectMongoose();
  const docs = await AgentModel.find({
    sellerId: { $ne: null },
    status: { $in: ["pending", "rejected"] },
  })
    .sort({ status: 1, createdAt: -1 })
    .lean<AgentDoc[]>();
  return docs.map((d) => ({
    id: String(d._id),
    slug: d.slug,
    name: d.name,
    tagline: d.tagline,
    category: d.category,
    pricePerCall: d.pricePerCall,
    isAsync: d.isAsync,
    status: d.status,
    ratingAverage: d.ratingAverage ?? 0,
    ratingCount: d.ratingCount ?? 0,
    invocationCount: d.invocationCount ?? 0,
    createdAt:
      d.createdAt instanceof Date
        ? d.createdAt.toISOString()
        : new Date(d.createdAt as unknown as string).toISOString(),
  }));
}
