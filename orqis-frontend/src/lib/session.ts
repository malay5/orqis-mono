import "server-only";
import { cookies } from "next/headers";
import { API_BASE_URL, API_BASE_URL_MISCONFIGURED, MISCONFIGURED_MESSAGE } from "@/lib/api-base";

/**
 * Plain token auth (Sprint 20) — NextAuth removed.
 *
 * The flow is the ordinary one you'd write for a React SPA:
 *
 *   1. the login form POSTs credentials to `/api/auth/login`
 *   2. that route forwards them to orqis-backend `POST /v1/auth/login`
 *   3. the backend verifies the password and returns `{ token, user }`
 *   4. we store the token and send it as `Authorization: Bearer …`
 *
 * No providers, no callbacks, no session strategy. The only Next-specific
 * part is *where* the token is kept.
 *
 * WHY A COOKIE AND NOT localStorage
 * ---------------------------------
 * A React SPA usually parks the token in localStorage. That doesn't work
 * here, because most of this app renders on the server: /browse, /dashboard,
 * every agent page and the admin screens are server components that need the
 * token while rendering, and the server cannot read localStorage. Using it
 * would mean rewriting every page as a client component with its own loading
 * state.
 *
 * So the token lives in an httpOnly cookie that we set ourselves, in one
 * function, below. It is the *same raw backend JWT* a SPA would hold — not a
 * framework session object — and it is still sent as a Bearer header on
 * every backend call. httpOnly also means XSS can't read it, which
 * localStorage can't offer.
 */

const COOKIE = "orqis_token";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string;
  role: "buyer" | "seller" | "admin";
  creditBalance: number;
};

export async function getToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export async function setToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function clearToken(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/**
 * Who is signed in, according to the backend.
 *
 * Asks `GET /v1/auth/me` rather than decoding the JWT locally: the token
 * carries a role and id, but the balance changes constantly and a decoded
 * token would go stale the moment credits are spent. It also means a token
 * for a deleted account resolves to null instead of a ghost session.
 *
 * Returns null (never throws) so a page can render signed-out rather than
 * 500 when the backend is down.
 */
export async function getSession(): Promise<{ user: SessionUser } | null> {
  const token = await getToken();
  if (!token) return null;
  if (API_BASE_URL_MISCONFIGURED) {
    console.error("[session] " + MISCONFIGURED_MESSAGE);
    return null;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: SessionUser };
    return data.user ? { user: data.user } : null;
  } catch (err) {
    console.error("[session] could not reach the API:", err);
    return null;
  }
}
