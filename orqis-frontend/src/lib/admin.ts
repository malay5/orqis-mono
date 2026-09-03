import "server-only";
import { apiFetchSafe } from "@/lib/api-client";

/**
 * Admin reads (Sprint 19 — via the platform API).
 * Authorization now lives on the backend: these hit admin-guarded routes and
 * return empty when the caller isn't an admin, rather than trusting the UI.
 */

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: "buyer" | "seller" | "admin";
  creditBalance: number;
  createdAt: string;
};

export type AdminAgentSubmissionRow = {
  id: string;
  contactEmail: string;
  contactName: string;
  agentName: string;
  description: string;
  endpointUrl: string;
  pricingIdea: string;
  links: string;
  status: "new" | "reviewing" | "approved" | "rejected";
  createdAt: string;
};

export async function listUsers(limit = 100): Promise<AdminUserRow[]> {
  const data = await apiFetchSafe<{ users: AdminUserRow[] }>(
    `/v1/admin/users?limit=${limit}`,
    { authenticated: true }
  );
  return data?.users ?? [];
}

export async function listAgentSubmissions(
  status: AdminAgentSubmissionRow["status"] | "all" = "new"
): Promise<AdminAgentSubmissionRow[]> {
  const data = await apiFetchSafe<{ submissions: AdminAgentSubmissionRow[] }>(
    `/v1/admin/submissions?status=${encodeURIComponent(status)}`,
    { authenticated: true }
  );
  return data?.submissions ?? [];
}
