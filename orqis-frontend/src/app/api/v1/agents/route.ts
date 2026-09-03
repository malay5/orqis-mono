import { proxyToBackend } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/agents — public catalogue search, relayed to the backend. */
export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const qs = incoming.search;
  return proxyToBackend(req, `/v1/catalog/agents${qs}`, { method: "GET" });
}
