import { NextResponse } from "next/server";
import { clearToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — drops the token cookie.
 *
 * Nothing to tell the backend: the JWT is stateless and simply stops being
 * sent. Add a server-side revocation list here if tokens ever need to be
 * killable before they expire.
 */
export async function POST() {
  await clearToken();
  return NextResponse.json({ ok: true });
}
