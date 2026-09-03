import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

/**
 * Minimal HS256 JWT sign/verify (Sprint 19).
 *
 * Hand-rolled against node:crypto rather than pulling in `jsonwebtoken` — the
 * same reasoning as password.ts: this backend deliberately carries no auth
 * dependency, and HS256 is an HMAC plus base64url, which is about 40 lines.
 *
 * Scope is deliberately narrow: we only ever issue and verify our OWN tokens
 * with one algorithm and one secret. `alg` from the header is never trusted —
 * we hardcode HS256 and reject anything else, which is the classic JWT
 * vulnerability (alg:none / alg confusion) that generic libraries have had to
 * be patched for repeatedly.
 */

const ALG = "HS256";

export type JwtPayload = {
  /** User id. */
  sub: string;
  email: string;
  role: "buyer" | "seller" | "admin";
  /** Issued-at and expiry, seconds since epoch. */
  iat: number;
  exp: number;
  /** Token id — lets us build a revocation list later without reissuing. */
  jti: string;
};

function b64urlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    // Fail loudly at use time rather than signing with a weak/empty key. The
    // frontend previously surfaced this as an opaque 500 — see the boot-time
    // assertion in server.ts.
    throw new Error(
      "AUTH_SECRET is missing or too short (need ≥16 chars). Set it in orqis-backend/.env."
    );
  }
  return s;
}

function sign(data: string): Buffer {
  return createHmac("sha256", secret()).update(data).digest();
}

export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function signJwt(
  claims: Pick<JwtPayload, "sub" | "email" | "role">,
  ttlSeconds: number = TOKEN_TTL_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    ...claims,
    iat: now,
    exp: now + ttlSeconds,
    jti: randomUUID(),
  };
  const header = b64urlEncode(JSON.stringify({ alg: ALG, typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  return `${signingInput}.${b64urlEncode(sign(signingInput))}`;
}

export type JwtVerifyResult =
  | { ok: true; payload: JwtPayload }
  | { ok: false; reason: "malformed" | "bad_alg" | "bad_signature" | "expired" };

export function verifyJwt(token: string): JwtVerifyResult {
  if (typeof token !== "string") return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [header, body, signature] = parts;

  let parsedHeader: { alg?: unknown };
  try {
    parsedHeader = JSON.parse(b64urlDecode(header).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  // Never take the algorithm from the token itself.
  if (parsedHeader.alg !== ALG) return { ok: false, reason: "bad_alg" };

  const expected = sign(`${header}.${body}`);
  const actual = b64urlDecode(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }
  if (!payload.sub || !payload.email) return { ok: false, reason: "malformed" };

  return { ok: true, payload };
}
