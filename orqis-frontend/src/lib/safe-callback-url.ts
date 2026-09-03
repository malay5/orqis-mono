/**
 * Sprint 18 (M1 fix): callbackUrl came straight from the query string and was
 * used as the post-sign-in redirect target. An attacker with a phishing link
 * like `/signin?callbackUrl=https://evil.com` could land the user on an
 * external site after sign-in. Only same-origin relative paths are accepted.
 *
 * Still enforced in Sprint 20 — AuthForm passes this through router.push().
 */
export function safeCallbackUrl(raw: string | undefined): string {
  const fallback = "/browse";
  if (!raw || typeof raw !== "string") return fallback;
  // Reject absolute URLs (http://, https://), protocol-relative URLs
  // (//evil.com/…), and backslash-escaped variants (\/\/evil.com).
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.includes("\\")) return fallback;
  return raw;
}
