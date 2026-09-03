import "server-only";
import { apiFetchSafe } from "@/lib/api-client";

/**
 * Invocation history for the dashboard (Sprint 19 — via the platform API).
 *
 * The write helpers that used to live here (recordInvocationStart,
 * markInvocationSucceeded, markInvocationFailed) moved to the backend with
 * the invocation proxy — the frontend no longer writes to the ledger, so it
 * has no business owning them.
 */

export type InvocationView = {
  id: string;
  agentId: string;
  agentSlug?: string;
  agentName?: string;
  agentEmoji?: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  httpStatus: number | null;
  latencyMs: number | null;
  creditsCharged: number;
  errorCode: string;
  createdAt: string;
};

/** The backend scopes activity to the bearer token's owner. */
export async function recentInvocationsForUser(limit = 25): Promise<InvocationView[]> {
  const data = await apiFetchSafe<{ count: number; invocations: InvocationView[] }>(
    `/v1/activity?limit=${limit}`,
    { authenticated: true }
  );
  return data?.invocations ?? [];
}

export async function countInvocationsThisWeek(): Promise<number> {
  const rows = await recentInvocationsForUser(100);
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return rows.filter((r) => new Date(r.createdAt).getTime() >= cutoff).length;
}
