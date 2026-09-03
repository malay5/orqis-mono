/**
 * email-truth — multi-signal email validity check.
 *
 * Layered, fast checks (sub-100ms): syntax → disposable domain list →
 * role account → free webmail → MX lookup. SMTP probe is deliberately
 * deferred to a follow-up `deepCheck` flag because (a) major providers
 * rate-limit it, (b) it can hurt sender reputation if abused, and (c) the
 * fast checks already catch the bulk of fake emails.
 *
 * Verdict rolls up to one of valid / risky / fake so callers don't have
 * to interpret 5 booleans themselves.
 */

import { resolveMx } from "node:dns/promises";
import { createRequire } from "node:module";

// disposable-email-domains ships as a single JSON. NodeNext requires either an
// import attribute (TS-version-sensitive) or a CommonJS-style load. createRequire
// is the most portable path.
const require = createRequire(import.meta.url);
const disposableDomains = require("disposable-email-domains") as string[];

const DISPOSABLE_SET = new Set(disposableDomains.map((d) => d.toLowerCase()));

// Hand-curated short lists. Comprehensive lists exist, but these are the
// ones our typical caller actually wants flagged.
const ROLE_LOCAL_PARTS = new Set([
  "admin", "administrator", "info", "support", "help", "contact", "hello",
  "sales", "billing", "accounts", "accounting", "marketing", "press",
  "noreply", "no-reply", "donotreply", "do-not-reply", "office", "team",
  "hr", "jobs", "careers", "legal", "abuse", "security", "postmaster",
  "webmaster", "hostmaster",
]);

const FREE_PROVIDERS: Record<string, string> = {
  "gmail.com": "Gmail",
  "googlemail.com": "Gmail",
  "yahoo.com": "Yahoo",
  "yahoo.co.uk": "Yahoo",
  "yahoo.co.in": "Yahoo",
  "outlook.com": "Outlook",
  "hotmail.com": "Outlook",
  "live.com": "Outlook",
  "msn.com": "Outlook",
  "icloud.com": "iCloud",
  "me.com": "iCloud",
  "aol.com": "AOL",
  "proton.me": "Proton",
  "protonmail.com": "Proton",
  "zoho.com": "Zoho",
  "yandex.com": "Yandex",
  "yandex.ru": "Yandex",
  "gmx.com": "GMX",
  "mail.com": "Mail.com",
};

// RFC-5322 lite. Real RFC 5322 supports quoted local parts, comments, etc.
// 99% of production validators use a simplified subset; we do the same.
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}$/;

export type EmailTruthInput = {
  email: string;
};

export type EmailTruthVerdict = "valid" | "risky" | "fake";

export type EmailTruthResult = {
  email: string;
  verdict: EmailTruthVerdict;
  verdictReasons: string[];
  score: number; // 0-1, higher = more trustworthy
  checks: {
    syntax: { valid: boolean };
    disposable: { isDisposable: boolean; matchedSource: string | null };
    roleAccount: { isRole: boolean; matchedLocal: string | null };
    freeProvider: { isFree: boolean; provider: string | null };
    mx: { hasMx: boolean; records: string[] | null; lookupError: string | null };
  };
  durationMs: number;
};

export async function runEmailTruth(input: EmailTruthInput): Promise<EmailTruthResult> {
  const startedAt = performance.now();
  const raw = (input.email ?? "").trim().toLowerCase();
  if (!raw) throw new Error("email is required");
  if (raw.length > 320) throw new Error("email too long (>320 chars)");

  const syntaxValid = EMAIL_RE.test(raw);
  const [local, domain] = raw.split("@");

  const isDisposable = !!domain && DISPOSABLE_SET.has(domain);
  const isRole = !!local && ROLE_LOCAL_PARTS.has(local);
  const freeProvider = domain ? FREE_PROVIDERS[domain] ?? null : null;

  let hasMx = false;
  let mxRecords: string[] | null = null;
  let lookupError: string | null = null;
  if (syntaxValid && domain && !isDisposable) {
    try {
      const records = await resolveMx(domain);
      hasMx = records.length > 0;
      mxRecords = records.sort((a, b) => a.priority - b.priority).map((r) => r.exchange);
    } catch (err) {
      lookupError = err instanceof Error ? err.message : "MX lookup failed";
    }
  }

  // Score + verdict.
  const reasons: string[] = [];
  let score = 1;
  if (!syntaxValid) {
    reasons.push("syntax_invalid");
    score -= 0.7;
  }
  if (isDisposable) {
    reasons.push("disposable_domain");
    score -= 0.9;
  }
  if (isRole) {
    reasons.push("role_account");
    score -= 0.15;
  }
  if (freeProvider) {
    reasons.push("free_provider");
    score -= 0.1;
  }
  if (syntaxValid && !isDisposable && !hasMx && !lookupError) {
    reasons.push("no_mx_records");
    score -= 0.4;
  }
  if (lookupError) {
    reasons.push("mx_lookup_failed");
    score -= 0.2;
  }
  score = Math.max(0, Math.min(1, score));

  let verdict: EmailTruthVerdict;
  if (!syntaxValid || isDisposable || (!hasMx && !lookupError && syntaxValid)) {
    verdict = "fake";
  } else if (isRole || freeProvider || lookupError) {
    verdict = "risky";
  } else {
    verdict = "valid";
  }

  return {
    email: raw,
    verdict,
    verdictReasons: reasons,
    score: Math.round(score * 100) / 100,
    checks: {
      syntax: { valid: syntaxValid },
      disposable: { isDisposable, matchedSource: isDisposable ? "disposable-email-domains" : null },
      roleAccount: { isRole, matchedLocal: isRole ? local : null },
      freeProvider: { isFree: !!freeProvider, provider: freeProvider },
      mx: { hasMx, records: mxRecords, lookupError },
    },
    durationMs: Math.round(performance.now() - startedAt),
  };
}
