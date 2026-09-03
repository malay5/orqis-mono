import { proxyToBackend } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/me — relayed to orqis-backend's /v1/auth/me (Sprint 19). */
export async function GET(req: Request) {
  return proxyToBackend(req, "/v1/auth/me", { method: "GET" });
}
