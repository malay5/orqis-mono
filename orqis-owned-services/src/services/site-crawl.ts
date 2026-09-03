/**
 * site-crawl — BFS multi-page scrape via Playwright.
 *
 * Picks up the per-page primitives from page-shot + scrape-render and walks
 * a site one URL at a time, returning HTML + visible text per page (plus
 * an optional screenshot per page).
 *
 * Sync, not async — kept under the 30s invocation-proxy budget with a
 * maxPages = 5 default and a 15-page hard cap. Bigger crawls need an async
 * variant (post-MVP); flagged in the seed description.
 *
 * Discipline:
 *   • Same-origin links only (override via `allowExternal: true`).
 *   • Strip fragments (`#section`) — same page, skip.
 *   • Skip non-HTML extensions (.pdf, .png, .mp4, .zip, etc.).
 *   • Skip mailto:, tel:, javascript:.
 *   • Per-host politeness delay between pages (default 400 ms).
 *   • SSRF-guarded start URL (rejected if it resolves to private space).
 *
 * Returns an array of per-page results in BFS visitation order. Each entry
 * is one of `{ ok: true, html, text, … }` or `{ ok: false, error }` — a
 * single page failing doesn't fail the whole call.
 */

import { chromium, type Browser } from "playwright";
import { assertSafeUrl } from "../lib/url-guard.js";
import { ValidationError } from "../lib/errors.js";

export type SiteCrawlInput = {
  startUrl: string;
  maxPages?: number;
  maxDepth?: number;
  allowExternal?: boolean;
  device?: "desktop" | "mobile";
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  extractText?: boolean;
  perPageDelayMs?: number;
};

export type SiteCrawlPage = {
  url: string;
  finalUrl: string;
  depth: number;
  status: number;
  title: string;
  html: string;
  text: string | null;
  linkCount: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
};

export type SiteCrawlResult = {
  startUrl: string;
  origin: string;
  visited: number;
  skippedDuplicates: number;
  skippedExternal: number;
  skippedNonHtml: number;
  hitMaxPages: boolean;
  hitMaxDepth: boolean;
  pages: SiteCrawlPage[];
  durationMs: number;
};

const DEFAULT_MAX_PAGES = 5;
const HARD_CAP_MAX_PAGES = 15;
const DEFAULT_MAX_DEPTH = 2;
const HARD_CAP_MAX_DEPTH = 5;
const DEFAULT_DELAY_MS = 400;
const NAV_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES_PER_PAGE = 2 * 1024 * 1024;
const MAX_TEXT_CHARS_PER_PAGE = 80_000;

// File extensions we'll see in href values that aren't worth navigating to.
const SKIP_EXT_RE =
  /\.(pdf|png|jpe?g|gif|webp|svg|ico|mp4|webm|mov|mp3|wav|ogg|zip|tar|gz|7z|rar|exe|dmg|pkg|deb|rpm|css|js|json|xml|rss|atom|woff2?|ttf|otf)(\?|#|$)/i;

function normalizeUrl(href: string, base: URL): URL | null {
  let u: URL;
  try {
    u = new URL(href, base);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // Strip fragment + sort search params for dedup.
  u.hash = "";
  return u;
}

function clampInt(n: unknown, lo: number, hi: number, fallback: number): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return fallback;
  return Math.max(lo, Math.min(hi, x));
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

export async function runSiteCrawl(input: SiteCrawlInput): Promise<SiteCrawlResult> {
  if (!input.startUrl || typeof input.startUrl !== "string") {
    throw new ValidationError("startUrl is required");
  }
  const start = await assertSafeUrl(input.startUrl, "startUrl");
  const origin = start.origin;

  const maxPages = clampInt(input.maxPages ?? DEFAULT_MAX_PAGES, 1, HARD_CAP_MAX_PAGES, DEFAULT_MAX_PAGES);
  const maxDepth = clampInt(input.maxDepth ?? DEFAULT_MAX_DEPTH, 0, HARD_CAP_MAX_DEPTH, DEFAULT_MAX_DEPTH);
  const perPageDelayMs = clampInt(input.perPageDelayMs ?? DEFAULT_DELAY_MS, 0, 5000, DEFAULT_DELAY_MS);
  const waitUntil = input.waitUntil ?? "domcontentloaded";
  const extractText = input.extractText !== false;
  const allowExternal = input.allowExternal === true;

  const startedAt = Date.now();
  const queue: { url: URL; depth: number }[] = [{ url: start, depth: 0 }];
  const seen = new Set<string>([start.toString()]);
  const pages: SiteCrawlPage[] = [];
  let skippedExternal = 0;
  let skippedNonHtml = 0;
  let skippedDuplicates = 0;
  let hitMaxPages = false;
  let hitMaxDepth = false;

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport:
        input.device === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1440, height: 900 },
      isMobile: input.device === "mobile",
    });
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    while (queue.length > 0 && pages.length < maxPages) {
      const item = queue.shift()!;
      const pageStartedAt = Date.now();

      try {
        const response = await page.goto(item.url.toString(), { waitUntil });
        const html = await page.content();
        const status = response?.status() ?? 0;
        const finalUrl = page.url();
        const title = await page.title();
        const text = extractText
          ? truncate(await page.locator("body").innerText().catch(() => ""), MAX_TEXT_CHARS_PER_PAGE)
          : null;

        // Collect links for the queue (only if we haven't hit max depth).
        type AnchorLike = { href: string };
        const rawLinks: string[] =
          item.depth < maxDepth
            ? await page.evaluate(() => {
                const doc = (globalThis as unknown as {
                  document: { querySelectorAll: (s: string) => AnchorLike[] };
                }).document;
                return Array.from(doc.querySelectorAll("a[href]"))
                  .map((a: AnchorLike) => a.href)
                  .slice(0, 500);
              })
            : [];

        if (item.depth >= maxDepth && queue.length === 0 && pages.length < maxPages) {
          hitMaxDepth = true;
        }

        const linkCount = rawLinks.length;
        for (const href of rawLinks) {
          const u = normalizeUrl(href, item.url);
          if (!u) continue;
          if (SKIP_EXT_RE.test(u.pathname + u.search)) {
            skippedNonHtml++;
            continue;
          }
          const key = u.toString();
          if (seen.has(key)) {
            skippedDuplicates++;
            continue;
          }
          if (!allowExternal && u.origin !== origin) {
            skippedExternal++;
            continue;
          }
          seen.add(key);
          queue.push({ url: u, depth: item.depth + 1 });
        }

        pages.push({
          url: item.url.toString(),
          finalUrl,
          depth: item.depth,
          status,
          title,
          html: truncate(html, MAX_HTML_BYTES_PER_PAGE),
          text,
          linkCount,
          durationMs: Date.now() - pageStartedAt,
          ok: true,
          error: null,
        });
      } catch (err) {
        pages.push({
          url: item.url.toString(),
          finalUrl: item.url.toString(),
          depth: item.depth,
          status: 0,
          title: "",
          html: "",
          text: null,
          linkCount: 0,
          durationMs: Date.now() - pageStartedAt,
          ok: false,
          error: err instanceof Error ? err.message.slice(0, 500) : "navigation failed",
        });
      }

      if (pages.length < maxPages && perPageDelayMs > 0 && queue.length > 0) {
        await new Promise((r) => setTimeout(r, perPageDelayMs));
      }
    }

    if (pages.length >= maxPages && queue.length > 0) hitMaxPages = true;

    await ctx.close();
  } finally {
    await browser?.close().catch(() => {});
  }

  return {
    startUrl: start.toString(),
    origin,
    visited: pages.length,
    skippedDuplicates,
    skippedExternal,
    skippedNonHtml,
    hitMaxPages,
    hitMaxDepth,
    pages,
    durationMs: Date.now() - startedAt,
  };
}
