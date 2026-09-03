import { NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-client";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Async job polling for the app's own UI. TryItPanel and /dashboard/jobs poll
 * this every ~2s while a job is pending; the backend scopes the result to the
 * token's owner.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invocationId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { invocationId } = await params;
  try {
    const data = await apiFetch<{ job: unknown }>(
      `/v1/jobs/${encodeURIComponent(invocationId)}`,
      { authenticated: true }
    );
    return NextResponse.json(data.job);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not load the job." }, { status: 500 });
  }
}
