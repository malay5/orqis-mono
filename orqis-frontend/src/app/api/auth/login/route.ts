import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api-base";
import { setToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login — { email, password } → sets the token cookie.
 *
 * Forwards the credentials to orqis-backend, which does the actual
 * verification, and stores the JWT it returns. The token is never sent to
 * the browser in the response body; it goes into an httpOnly cookie.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[auth/login] backend unreachable:", err);
    return NextResponse.json({ error: "Can't reach orqis right now." }, { status: 503 });
  }

  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    user?: unknown;
    error?: string;
  };

  if (!res.ok || !data.token) {
    return NextResponse.json(
      { error: data.error ?? "That email and password don't match an account." },
      { status: res.status === 200 ? 500 : res.status }
    );
  }

  await setToken(data.token);
  return NextResponse.json({ ok: true, user: data.user });
}
