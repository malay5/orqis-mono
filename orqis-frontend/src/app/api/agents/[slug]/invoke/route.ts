import { NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-client";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invocation proxy (Sprint 19 — now a pass-through).
 *
 * The real proxy — billing, refunds, the mode rebate, schema validation,
 * async dispatch — moved to orqis-backend at `POST /v1/invoke/:slug`. This
 * handler exists only so the browser keeps a same-origin endpoint and never
 * has to hold the backend JWT.
 *
 * Programmatic clients (SDK, MCP) should call the backend directly with an
 * `or_live_…` key; this route is for the app's own UI.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to invoke agents." }, { status: 401 });
  }

  const { slug } = await params;

  let body: unknown = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  try {
    const result = await apiFetch<unknown>(`/v1/invoke/${encodeURIComponent(slug)}`, {
      method: "POST",
      authenticated: true,
      body,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      // Pass the backend's status through unchanged — 402 (insufficient
      // credits), 429 (rate limited) and 502 (upstream failed) all mean
      // something specific to the UI.
      return NextResponse.json(err.body ?? { error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Invocation failed." }, { status: 500 });
  }
}
