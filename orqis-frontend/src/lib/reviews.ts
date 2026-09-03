import "server-only";
import { apiFetch, apiFetchSafe } from "@/lib/api-client";

/**
 * Agent reviews (Sprint 19 — via the platform API).
 *
 * Signature change: these took a Mongo `agentId` because they queried the
 * collection directly. The API addresses agents by slug, so they now take a
 * slug. Call sites updated accordingly — `agent.slug` is available wherever
 * `agent.id` was.
 */

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

export async function getReviewsForAgent(slug: string): Promise<ReviewView[]> {
  const data = await apiFetchSafe<{ count: number; reviews: ReviewView[] }>(
    `/v1/agents/${encodeURIComponent(slug)}/reviews`,
    { revalidate: 15 }
  );
  return data?.reviews ?? [];
}

export async function getMyReviewForAgent(slug: string): Promise<ReviewView | null> {
  const data = await apiFetchSafe<{ review: ReviewView | null }>(
    `/v1/agents/${encodeURIComponent(slug)}/reviews/mine`,
    { authenticated: true }
  );
  return data?.review ?? null;
}

export async function upsertReview(input: {
  slug: string;
  rating: number;
  title: string;
  body: string;
}): Promise<ReviewView> {
  const data = await apiFetch<{ review: ReviewView }>(
    `/v1/agents/${encodeURIComponent(input.slug)}/reviews`,
    {
      method: "POST",
      authenticated: true,
      body: { rating: input.rating, title: input.title, body: input.body },
    }
  );
  return data.review;
}
