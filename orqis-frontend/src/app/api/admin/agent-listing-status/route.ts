import { NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/agent-listing-status — relayed to orqis-backend (Sprint 19). */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await apiFetch<unknown>("/v1/admin/submission-status", {
        method: "POST",
        authenticated: true,
        body,
      })
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Status update failed." }, { status: 500 });
  }
}
