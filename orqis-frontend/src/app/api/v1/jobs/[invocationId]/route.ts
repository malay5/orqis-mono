import { proxyToBackend } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/jobs/:invocationId — async job polling, relayed to the backend. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ invocationId: string }> }
) {
  const { invocationId } = await params;
  return proxyToBackend(req, `/v1/jobs/${encodeURIComponent(invocationId)}`, {
    method: "GET",
  });
}
