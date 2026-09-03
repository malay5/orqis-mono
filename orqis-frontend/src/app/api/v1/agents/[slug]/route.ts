import { proxyToBackend } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/agents/:slug — single agent, relayed to the backend. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return proxyToBackend(req, `/v1/catalog/agents/${encodeURIComponent(slug)}`, {
    method: "GET",
  });
}
