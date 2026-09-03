import { NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register — relayed to orqis-backend's /v1/auth/register.
 *
 * The backend creates the account and grants the signup credits. The client
 * then calls /api/auth/login with the same credentials to get a token.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const data = await apiFetch<{ user: { email: string }; token: string }>(
      "/v1/auth/register",
      { method: "POST", body }
    );
    // Deliberately not returning the token. Registration does not log you
    // in; the client posts to /api/auth/login next, which is the one place
    // that sets the cookie.
    return NextResponse.json({ ok: true, email: data.user.email }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Could not create your account. Try again in a moment." },
      { status: 500 }
    );
  }
}
