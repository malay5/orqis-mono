/**
 * page-shot — URL → screenshot via Playwright Chromium.
 *
 * One headless Chromium launched per request for isolation. Browser pooling
 * is post-MVP; for now the launch cost (~300 ms) is amortised against the
 * network wait that dominates total latency.
 */

import { chromium, type Browser } from "playwright";
import { assertSafeUrl } from "../lib/url-guard.js";

export type PageShotInput = {
  url: string;
  width?: number;
  height?: number;
  fullPage?: boolean;
  device?: "desktop" | "mobile" | "tablet";
  format?: "png" | "jpeg";
  quality?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  darkMode?: boolean;
  hideAds?: boolean;
  delayMs?: number;
};

export type PageShotResult = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  fullPage: boolean;
  device: string;
  finalUrl: string;
  outputBytes: number;
  durationMs: number;
};

const FORMAT_INFO: Record<"png" | "jpeg", { contentType: string; extension: string }> = {
  png: { contentType: "image/png", extension: "png" },
  jpeg: { contentType: "image/jpeg", extension: "jpg" },
};

const DEVICE_VIEWPORTS: Record<"desktop" | "mobile" | "tablet", { width: number; height: number; isMobile: boolean }> = {
  desktop: { width: 1440, height: 900, isMobile: false },
  tablet: { width: 820, height: 1180, isMobile: true },
  mobile: { width: 390, height: 844, isMobile: true },
};

// Lightweight ad/cookie banner blocklist — applied as Playwright route
// handlers when hideAds is true. Not comprehensive (real uBlock filter
// lists are huge); just the highest-traffic noise.
const AD_HOSTS_RE =
  /(?:doubleclick\.net|googlesyndication\.com|googletagmanager\.com|google-analytics\.com|facebook\.com\/tr|amazon-adsystem\.com|adsrvr\.org|criteo\.com|adnxs\.com|taboola\.com|outbrain\.com|hotjar\.com)/i;

const MAX_DELAY_MS = 5000;
const NAV_TIMEOUT_MS = 30_000;

export async function runPageShot(input: PageShotInput): Promise<PageShotResult> {
  const startedAt = Date.now();
  const parsed = await assertSafeUrl(input.url, "url");

  const device = input.device ?? "desktop";
  const dv = DEVICE_VIEWPORTS[device];
  const viewport = {
    width: clampInt(input.width ?? dv.width, 320, 2560),
    height: clampInt(input.height ?? dv.height, 320, 2160),
  };
  const fullPage = input.fullPage === true;
  const format = input.format ?? "png";
  if (!FORMAT_INFO[format]) throw new Error(`format must be one of: png, jpeg`);
  const quality = format === "png" ? undefined : clampInt(input.quality ?? 85, 1, 100);
  const waitUntil = input.waitUntil ?? "networkidle";
  const delayMs = clampInt(input.delayMs ?? 0, 0, MAX_DELAY_MS);

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      isMobile: dv.isMobile,
      colorScheme: input.darkMode === true ? "dark" : "light",
      userAgent: dv.isMobile
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
    });

    if (input.hideAds === true) {
      await ctx.route("**/*", (route) => {
        if (AD_HOSTS_RE.test(route.request().url())) return route.abort();
        return route.continue();
      });
    }

    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    await page.goto(parsed.toString(), { waitUntil });
    if (delayMs > 0) await page.waitForTimeout(delayMs);

    const buffer = await page.screenshot({
      type: format,
      quality,
      fullPage,
    });

    const finalUrl = page.url();
    await ctx.close();

    return {
      buffer,
      contentType: FORMAT_INFO[format].contentType,
      extension: FORMAT_INFO[format].extension,
      width: viewport.width,
      height: viewport.height,
      fullPage,
      device,
      finalUrl,
      outputBytes: buffer.byteLength,
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
