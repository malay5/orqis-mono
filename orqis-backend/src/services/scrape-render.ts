/**
 * scrape-render — JS-rendering scrape via Playwright. The dynamic-content
 * companion to scrape-clean (static fetch + Readability).
 *
 * Returns the post-render DOM as HTML, the visible text, links, and the
 * Lighthouse-style "interesting-bit" metadata (title, meta description,
 * canonical, OG/Twitter cards). Lets the caller pick its own extractor
 * downstream — we don't pretend to know what they want from a SPA.
 *
 * Two extraction shortcuts: `extractText` returns visible body text via
 * `innerText`, and `selectorMap` runs `document.querySelector(...)` per
 * key and returns the matched text content. Together they cover ~80% of
 * "I want one number off this page" use cases without forcing the caller
 * to parse the full DOM.
 */

import { chromium, type Browser } from "playwright";
import { assertSafeUrl } from "../lib/url-guard.js";

export type ScrapeRenderInput = {
  url: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  delayMs?: number;
  device?: "desktop" | "mobile";
  extractText?: boolean;
  selectorMap?: Record<string, string>;
};

export type ScrapeRenderResult = {
  finalUrl: string;
  title: string;
  status: number;
  html: string;
  text: string | null;
  metadata: {
    description: string | null;
    canonical: string | null;
    ogTitle: string | null;
    ogImage: string | null;
    twitterCard: string | null;
    twitterImage: string | null;
    favicon: string | null;
  };
  selectors: Record<string, string | null>;
  linkCount: number;
  links: string[];
  durationMs: number;
};

const MAX_HTML_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;
const MAX_SELECTORS = 20;
const NAV_TIMEOUT_MS = 30_000;
const MAX_DELAY_MS = 5000;

export async function runScrapeRender(input: ScrapeRenderInput): Promise<ScrapeRenderResult> {
  const startedAt = Date.now();
  const parsed = await assertSafeUrl(input.url, "url");
  const waitUntil = input.waitUntil ?? "networkidle";
  const delayMs = clampInt(input.delayMs ?? 0, 0, MAX_DELAY_MS);

  if (input.selectorMap && Object.keys(input.selectorMap).length > MAX_SELECTORS) {
    throw new Error(`selectorMap may include at most ${MAX_SELECTORS} selectors`);
  }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport: input.device === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      isMobile: input.device === "mobile",
    });
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    const response = await page.goto(parsed.toString(), { waitUntil });
    if (delayMs > 0) await page.waitForTimeout(delayMs);

    const html = await page.content();
    if (html.length > MAX_HTML_BYTES) {
      throw new Error(`Rendered HTML too large: ${html.length} bytes`);
    }

    const title = await page.title();
    const finalUrl = page.url();
    const status = response?.status() ?? 0;

    // Browser-context evaluate; document / HTMLElement live in the page, not
    // the Node side, so we declare a minimal local shape rather than pull DOM
    // types into the whole project's tsconfig.
    const metadata = await page.evaluate(() => {
      type ElLike = { getAttribute(name: string): string | null } | null;
      const doc = (globalThis as unknown as { document: { querySelector: (s: string) => ElLike } }).document;
      const q = (sel: string): ElLike => doc.querySelector(sel);
      return {
        description: q('meta[name="description"]')?.getAttribute("content") ?? null,
        canonical: q('link[rel="canonical"]')?.getAttribute("href") ?? null,
        ogTitle: q('meta[property="og:title"]')?.getAttribute("content") ?? null,
        ogImage: q('meta[property="og:image"]')?.getAttribute("content") ?? null,
        twitterCard: q('meta[name="twitter:card"]')?.getAttribute("content") ?? null,
        twitterImage: q('meta[name="twitter:image"]')?.getAttribute("content") ?? null,
        favicon:
          q('link[rel="icon"]')?.getAttribute("href") ??
          q('link[rel="shortcut icon"]')?.getAttribute("href") ??
          null,
      };
    });

    const text = input.extractText === true ? truncate((await page.locator("body").innerText().catch(() => "")), MAX_TEXT_CHARS) : null;

    const selectors: Record<string, string | null> = {};
    if (input.selectorMap) {
      for (const [key, sel] of Object.entries(input.selectorMap)) {
        try {
          selectors[key] = await page.locator(sel).first().innerText({ timeout: 2000 });
        } catch {
          selectors[key] = null;
        }
      }
    }

    const links: string[] = await page.evaluate(() => {
      type AnchorLike = { href: string };
      const doc = (globalThis as unknown as { document: { querySelectorAll: (s: string) => AnchorLike[] } }).document;
      return Array.from(doc.querySelectorAll("a[href]"))
        .map((a: AnchorLike) => a.href)
        .filter((href: string) => href.startsWith("http"))
        .slice(0, 500);
    });

    await ctx.close();

    return {
      finalUrl,
      title,
      status,
      html,
      text,
      metadata,
      selectors,
      linkCount: links.length,
      links,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}

function clampInt(n: unknown, lo: number, hi: number): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}
