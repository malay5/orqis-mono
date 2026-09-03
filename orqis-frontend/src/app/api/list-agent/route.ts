import { NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/list-agent — seller intake, relayed to orqis-backend (Sprint 19). */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const data = await apiFetch<{ submissionId: string }>("/v1/list-agent", {
      method: "POST",
      body,
    });
    return NextResponse.json({ ok: true, ...data }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not submit your agent." }, { status: 500 });
  }
}
