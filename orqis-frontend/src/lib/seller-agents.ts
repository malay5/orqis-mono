import "server-only";
import { apiFetchSafe } from "@/lib/api-client";

/** Seller listings (Sprint 19 — via the platform API). */

export type SellerAgentRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  iconEmoji: string;
  pricePerCall: number;
  isAsync: boolean;
  status: "draft" | "pending" | "approved" | "rejected";
  invocationCount: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
};

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function listSellerAgents(): Promise<SellerAgentRow[]> {
  const data = await apiFetchSafe<{ agents: SellerAgentRow[] }>("/v1/seller/agents", {
    authenticated: true,
  });
  return data?.agents ?? [];
}

export async function listPendingListings(): Promise<SellerAgentRow[]> {
  const data = await apiFetchSafe<{ listings: SellerAgentRow[] }>("/v1/admin/listings", {
    authenticated: true,
  });
  return data?.listings ?? [];
}
