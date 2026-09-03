import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — who is signed in, for client components.
 *
 * Returns { user: null } rather than a 401 when signed out: "nobody is
 * logged in" is a normal state for the header to render, not an error.
 */
export async function GET() {
  const session = await getSession();
  return NextResponse.json({ user: session?.user ?? null });
}
