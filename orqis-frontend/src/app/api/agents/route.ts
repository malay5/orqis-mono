import { NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-client";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agents — create a seller listing (Sprint 19 — relayed).
 *
 * Validation, slug uniqueness, and encryption of the seller's auth header
 * now happen on orqis-backend. This handler only checks that someone is
 * signed in before spending a round trip.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await apiFetch<unknown>("/v1/seller/agents", {
        method: "POST",
        authenticated: true,
        body,
      })
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not create the listing." }, { status: 500 });
  }
}
