/**
 * lighthouse-audit — full Google Lighthouse run on any URL.
 *
 * Returns the four category scores (performance / accessibility /
 * best-practices / SEO) plus the most diagnostic audit-level signals:
 * Core Web Vitals (LCP, CLS, INP-proxy via TBT), failed accessibility
 * checks, total bytes / requests, and a short list of opportunities the
 * page could ship to improve perf.
 *
 * Lighthouse spawns its own Chromium via chrome-launcher; this is a
 * separate browser install from the Playwright Chromium used by page-shot
 * / pdf-render / scrape-render. Two installs is fine for MVP; sharing
 * would require routing Lighthouse through Playwright's CDP endpoint,
 * which the lighthouse package supports but is brittle across versions.
 */

import * as lighthouseMod from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { assertSafeUrl } from "../lib/url-guard.js";

type LighthouseFn = (
  url: string,
  flags: { port: number; output: string },
  config: { extends: string; settings: { onlyCategories?: string[]; formFactor?: string; throttlingMethod?: string; screenEmulation?: { mobile?: boolean } } }
) => Promise<{ lhr?: unknown } | null>;
const lighthouse: LighthouseFn =
  (lighthouseMod as unknown as { default?: LighthouseFn }).default ??
  (lighthouseMod as unknown as LighthouseFn);

export type LighthouseAuditInput = {
  url: string;
  device?: "mobile" | "desktop";
  categories?: ("performance" | "accessibility" | "best-practices" | "seo")[];
};

export type LighthouseAuditResult = {
  finalUrl: string;
  scores: Record<string, number | null>;
  metrics: {
    firstContentfulPaintMs: number | null;
    largestContentfulPaintMs: number | null;
    totalBlockingTimeMs: number | null;
    cumulativeLayoutShift: number | null;
    speedIndexMs: number | null;
    timeToInteractiveMs: number | null;
  };
  network: {
    totalBytes: number | null;
    totalRequests: number | null;
  };
  opportunities: Array<{ id: string; title: string; estimatedSavingsMs: number | null }>;
  failedAccessibility: Array<{ id: string; title: string }>;
  device: "mobile" | "desktop";
  durationMs: number;
};

const VALID_CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;

export async function runLighthouseAudit(input: LighthouseAuditInput): Promise<LighthouseAuditResult> {
  const startedAt = Date.now();
  const parsed = await assertSafeUrl(input.url, "url");
  const device = input.device ?? "mobile";
  const categories = input.categories?.length
    ? input.categories.filter((c) => (VALID_CATEGORIES as readonly string[]).includes(c))
    : [...VALID_CATEGORIES];
  if (categories.length === 0) {
    throw new Error(`categories must include one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const config = {
      extends: "lighthouse:default",
      settings: {
        onlyCategories: categories,
        formFactor: device,
        throttlingMethod: "simulate",
        screenEmulation: { mobile: device === "mobile" },
      },
    };
    const runnerResult = await lighthouse(parsed.toString(), { port: chrome.port, output: "json" }, config);
    if (!runnerResult || !runnerResult.lhr) {
      throw new Error("lighthouse returned no result");
    }
    const lhr = runnerResult.lhr as {
      finalUrl?: string;
      categories?: Record<string, { score: number | null }>;
      audits?: Record<string, { id: string; title: string; score: number | null; numericValue?: number; details?: { overallSavingsMs?: number } }>;
    };

    const scores: Record<string, number | null> = {};
    for (const cat of categories) {
      const raw = lhr.categories?.[cat]?.score;
      scores[cat] = typeof raw === "number" ? Math.round(raw * 100) : null;
    }

    const audit = (id: string) => lhr.audits?.[id];
    const metrics = {
      firstContentfulPaintMs: round(audit("first-contentful-paint")?.numericValue),
      largestContentfulPaintMs: round(audit("largest-contentful-paint")?.numericValue),
      totalBlockingTimeMs: round(audit("total-blocking-time")?.numericValue),
      cumulativeLayoutShift: roundFloat(audit("cumulative-layout-shift")?.numericValue, 3),
      speedIndexMs: round(audit("speed-index")?.numericValue),
      timeToInteractiveMs: round(audit("interactive")?.numericValue),
    };

    const network = {
      totalBytes: round(audit("total-byte-weight")?.numericValue),
      totalRequests: round(audit("network-requests")?.numericValue),
    };

    const opportunities: LighthouseAuditResult["opportunities"] = [];
    for (const [id, a] of Object.entries(lhr.audits ?? {})) {
      const savings = a.details?.overallSavingsMs;
      if (typeof savings === "number" && savings > 100 && a.score !== null && a.score < 0.9) {
        opportunities.push({ id, title: a.title, estimatedSavingsMs: Math.round(savings) });
      }
    }
    opportunities.sort((a, b) => (b.estimatedSavingsMs ?? 0) - (a.estimatedSavingsMs ?? 0));

    const failedAccessibility: LighthouseAuditResult["failedAccessibility"] = [];
    for (const [id, a] of Object.entries(lhr.audits ?? {})) {
      if (a.score === 0 && /^(aria|color-contrast|image-alt|label|link-name|button-name|heading-order|landmark)/.test(id)) {
        failedAccessibility.push({ id, title: a.title });
      }
    }

    return {
      finalUrl: lhr.finalUrl ?? parsed.toString(),
      scores,
      metrics,
      network,
      opportunities: opportunities.slice(0, 10),
      failedAccessibility: failedAccessibility.slice(0, 20),
      device,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    try {
      await chrome.kill();
    } catch {
      /* swallow — chrome may already be dead */
    }
  }
}

function round(n: unknown): number | null {
  const x = Number(n);
  return Number.isFinite(x) ? Math.round(x) : null;
}
function roundFloat(n: unknown, decimals: number): number | null {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const m = 10 ** decimals;
  return Math.round(x * m) / m;
}
