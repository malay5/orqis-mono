import "server-only";
import { apiFetchSafe } from "@/lib/api-client";

/**
 * Credit balance + ledger (Sprint 19 — via the platform API).
 *
 * Was a direct Mongoose read; now `GET /v1/credits`. The exported shape is
 * unchanged so `dashboard/credits` and `dashboard` render untouched.
 */

export type CreditTxView = {
  id: string;
  delta: number;
  reason: "signup_bonus" | "admin_grant" | "invocation" | "refund" | "purchase";
  note: string;
  createdAt: string; // ISO
};

export type CreditSnapshot = {
  balance: number;
  transactions: CreditTxView[];
};

/**
 * No userId parameter: the backend derives the user from the bearer token, so
 * a caller cannot ask for someone else's ledger by passing a different id.
 */
export async function getCreditSnapshot(): Promise<CreditSnapshot | null> {
  return apiFetchSafe<CreditSnapshot>("/v1/credits", { authenticated: true });
}
