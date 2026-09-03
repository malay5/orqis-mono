import { proxyToBackend } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/agents/:slug/invoke — the documented public invoke endpoint.
 *
 * Relayed to orqis-backend's /v1/invoke/:slug with the caller's own
 * Authorization header, so `or_live_…` keys from the SDK and MCP server keep
 * working against this URL unchanged.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await req.text();
  return proxyToBackend(req, `/v1/invoke/${encodeURIComponent(slug)}`, {
    method: "POST",
    body,
  });
}
