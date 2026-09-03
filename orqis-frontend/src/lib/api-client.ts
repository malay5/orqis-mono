import "server-only";
import {
  API_BASE_URL,
  API_BASE_URL_MISCONFIGURED,
  MISCONFIGURED_MESSAGE,
} from "@/lib/api-base";
import { getToken } from "@/lib/session";

export { API_BASE_URL };

/**
 * The single door between orqis-frontend and orqis-backend (Sprint 19).
 *
 * Before this, Next route handlers and server components opened their own
 * MongoDB connection. The frontend now has no database and no models: every
 * read and write goes through this client to the platform API.
 *
 * Auth: the backend issues a JWT at login, which /api/auth/login stores in an
 * httpOnly cookie. `apiFetch` reads it via lib/session and attaches it as
 * `Authorization: Bearer` when `authenticated` is requested.
 *
 * Server-only on purpose — the base URL may be an internal address, and the
 * JWT must never be handed to the browser.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Attach the signed-in user's JWT. Throws if there isn't one. */
  authenticated?: boolean;
  /** Use this token instead of reading the session (login/register flows). */
  token?: string;
  /** Seconds to cache. Omit for no caching, which is right for anything user-specific. */
  revalidate?: number;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  // Surface a missing ORQIS_API_URL as itself, not as ECONNREFUSED on loopback.
  if (API_BASE_URL_MISCONFIGURED) throw new ApiError(500, MISCONFIGURED_MESSAGE);

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  } else if (opts.authenticated) {
    const token = await getToken();
    if (!token) throw new ApiError(401, "Not signed in.");
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
    // User-specific data must never be cached across requests.
    cache: opts.revalidate === undefined ? "no-store" : undefined,
    next: opts.revalidate === undefined ? undefined : { revalidate: opts.revalidate },
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON response — keep the raw text for the error message.
  }

  if (!res.ok) {
    const message =
      (parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, parsed ?? text);
  }

  return parsed as T;
}

/**
 * Same as apiFetch but returns null instead of throwing when the backend is
 * unreachable or errors. For page-level reads where a degraded render beats
 * a 500 — the browse page should still paint if the API blips.
 */
export async function apiFetchSafe<T>(path: string, opts: FetchOptions = {}): Promise<T | null> {
  try {
    return await apiFetch<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    console.error(`[api-client] ${path} failed:`, err);
    return null;
  }
}

/**
 * Forward a public-API request straight through to orqis-backend, preserving
 * the caller's own `Authorization` header (Sprint 19).
 *
 * The documented public surface is `https://orqis.xyz/api/v1/…`, and the SDK,
 * MCP server and existing `or_live_…` keys all point at it. Rather than break
 * those, the Next routes stay put and relay to the backend, which does the
 * actual authentication.
 *
 * Credential precedence: an explicit `Authorization` header wins, so a
 * programmatic client's API key is always used as-is. Only when none is
 * present do we fall back to the signed-in session — the app's own UI
 * (`useCreditBalance`, the Try-It panel) calls these same URLs from the
 * browser with just a cookie.
 */
export async function proxyToBackend(
  req: Request,
  path: string,
  init: { method?: string; body?: BodyInit | null } = {}
): Promise<Response> {
  if (API_BASE_URL_MISCONFIGURED) {
    console.error("[api-client] " + MISCONFIGURED_MESSAGE);
    return Response.json({ error: MISCONFIGURED_MESSAGE }, { status: 500 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = req.headers.get("authorization");
  if (auth) {
    headers.Authorization = auth;
  } else {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? req.method,
      headers,
      body: init.body,
      cache: "no-store",
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
        // Preserve rate-limit signalling so SDK clients can back off correctly.
        ...(res.headers.has("retry-after")
          ? { "Retry-After": res.headers.get("retry-after")! }
          : {}),
      },
    });
  } catch (err) {
    console.error(`[api-client] proxy ${path} failed:`, err);
    return Response.json({ error: "The orqis API is unreachable." }, { status: 503 });
  }
}
