import "server-only";
import { apiFetchSafe } from "@/lib/api-client";

/**
 * Async-job rows for /dashboard/jobs (Sprint 19 — via the platform API).
 * Was a direct Mongoose read; now `GET /v1/jobs`.
 */

export type JobRowView = {
  id: string;
  agentSlug?: string;
  agentName?: string;
  agentEmoji?: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  errorCode: string;
  errorMessage: string;
  creditsCharged: number;
  latencyMs: number | null;
  createdAt: string;
  completedAt: string | null;
  previewUrl?: string;
  downloadUrl?: string;
};

/** The backend scopes jobs to the bearer token's owner. */
export async function listJobsForUser(limit = 30): Promise<JobRowView[]> {
  const data = await apiFetchSafe<{ count: number; jobs: JobRowView[] }>(
    `/v1/jobs?limit=${limit}`,
    { authenticated: true }
  );
  return data?.jobs ?? [];
}
