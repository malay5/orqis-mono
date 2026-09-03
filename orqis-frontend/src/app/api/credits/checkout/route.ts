import { NextResponse } from "next/server";
import { apiFetch, apiFetchSafe, ApiError } from "@/lib/api-client";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Credit checkout (Sprint 19 — relayed to orqis-backend).
 *
 * ⚠️ HACKATHON: the backend takes no payment while FAKE_PAYMENTS is on. It
 * grants the pack immediately and writes a ledger row marked simulated.
 */
export async function GET() {
  const data = await apiFetchSafe<unknown>("/v1/credits/packs");
  return NextResponse.json(data ?? { packs: [], simulated: true });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to buy credits." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await apiFetch<unknown>("/v1/credits/checkout", {
        method: "POST",
        authenticated: true,
        body,
      })
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not add credits." }, { status: 500 });
  }
}
