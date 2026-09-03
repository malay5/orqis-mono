/**
 * a11y-quick — run axe-core against a URL in headless Chromium.
 *
 * Faster + more focused than lighthouse-audit's accessibility category —
 * we just inject axe-core into the page and return the violations + passes
 * counts grouped by impact (critical / serious / moderate / minor).
 *
 * Uses the Playwright Chromium install from Sprint 15. No separate browser
 * dep needed.
 */

import { chromium, type Browser } from "playwright";
import axeSource from "axe-core";
import { assertSafeUrl } from "../lib/url-guard.js";

export type A11yQuickInput = {
  url: string;
  device?: "desktop" | "mobile";
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
};

export type A11yViolation = {
  id: string;
  impact: string;
  description: string;
  helpUrl: string;
  nodeCount: number;
  selectorSample: string | null;
};

export type A11yQuickResult = {
  url: string;
  finalUrl: string;
  device: "desktop" | "mobile";
  score: number; // 0-100, higher is better
  counts: {
    violations: number;
    passes: number;
    incomplete: number;
    inapplicable: number;
    byImpact: Record<string, number>;
  };
  topViolations: A11yViolation[];
  durationMs: number;
};

const NAV_TIMEOUT_MS = 30_000;

type AxeResult = {
  violations: {
    id: string;
    impact: string | null;
    description: string;
    helpUrl: string;
    nodes: { target: string[] }[];
  }[];
  passes: { id: string }[];
  incomplete: { id: string }[];
  inapplicable: { id: string }[];
};

export async function runA11yQuick(input: A11yQuickInput): Promise<A11yQuickResult> {
  const startedAt = Date.now();
  const parsed = await assertSafeUrl(input.url, "url");
  const device = input.device ?? "desktop";
  const waitUntil = input.waitUntil ?? "networkidle";

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport: device === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: device === "mobile",
    });
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    await page.goto(parsed.toString(), { waitUntil });

    // Inject axe-core's bundled JS, then invoke axe.run() in page context.
    await page.addScriptTag({ content: axeSource.source });
    const result = await page.evaluate(async () => {
      type AxeWindow = { axe?: { run: () => Promise<AxeResult> } };
      const w = globalThis as unknown as AxeWindow;
      if (!w.axe) throw new Error("axe-core failed to load in page");
      return await w.axe.run();
    });

    const finalUrl = page.url();
    await ctx.close();

    const byImpact: Record<string, number> = { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 };
    for (const v of result.violations) {
      const key = v.impact && byImpact[v.impact] !== undefined ? v.impact : "unknown";
      byImpact[key] += 1;
    }

    // Weighted score, similar in shape to Lighthouse's a11y rollup.
    const weight: Record<string, number> = { critical: 10, serious: 6, moderate: 3, minor: 1, unknown: 1 };
    const penalty = Object.entries(byImpact).reduce((acc, [k, n]) => acc + n * (weight[k] ?? 1), 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));

    const topViolations: A11yViolation[] = result.violations
      .sort((a, b) => (weight[b.impact ?? "unknown"] ?? 1) - (weight[a.impact ?? "unknown"] ?? 1))
      .slice(0, 15)
      .map((v) => ({
        id: v.id,
        impact: v.impact ?? "unknown",
        description: v.description,
        helpUrl: v.helpUrl,
        nodeCount: v.nodes.length,
        selectorSample: v.nodes[0]?.target?.[0] ?? null,
      }));

    return {
      url: parsed.toString(),
      finalUrl,
      device,
      score: Math.round(score),
      counts: {
        violations: result.violations.length,
        passes: result.passes.length,
        incomplete: result.incomplete.length,
        inapplicable: result.inapplicable.length,
        byImpact,
      },
      topViolations,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}
