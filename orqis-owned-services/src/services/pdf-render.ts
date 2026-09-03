/**
 * pdf-render — HTML / URL → PDF via Playwright Chromium's page.pdf().
 *
 * Different from doc-converter (which goes through pandoc and shells out
 * to a different rendering stack). This service renders the page in a real
 * browser first, so CSS, web fonts, images, and layout match what a user
 * would see in Chrome.
 *
 * Two input modes — `url` to fetch a live URL, or `html` to inline-render
 * raw markup. URL mode is SSRF-guarded; HTML mode is sandboxed by Playwright.
 */

import { chromium, type Browser } from "playwright";
import { assertSafeUrl } from "../lib/url-guard.js";

export type PdfRenderInput = {
  url?: string;
  html?: string;
  format?: "Letter" | "Legal" | "Tabloid" | "Ledger" | "A0" | "A1" | "A2" | "A3" | "A4" | "A5" | "A6";
  landscape?: boolean;
  printBackground?: boolean;
  marginInches?: { top?: number; right?: number; bottom?: number; left?: number };
  scale?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  delayMs?: number;
  headerHtml?: string;
  footerHtml?: string;
};

export type PdfRenderResult = {
  buffer: Buffer;
  contentType: "application/pdf";
  extension: "pdf";
  pageCount: number | null;
  outputBytes: number;
  formatUsed: string;
  landscape: boolean;
  finalUrl: string | null;
  durationMs: number;
};

const VALID_FORMATS = new Set([
  "Letter", "Legal", "Tabloid", "Ledger", "A0", "A1", "A2", "A3", "A4", "A5", "A6",
]);

const MAX_HTML_BYTES = 8 * 1024 * 1024;
const MAX_DELAY_MS = 5000;
const NAV_TIMEOUT_MS = 30_000;

export async function runPdfRender(input: PdfRenderInput): Promise<PdfRenderResult> {
  if (!input.url && !input.html) {
    throw new Error("Either url or html is required");
  }
  if (input.url && input.html) {
    throw new Error("Pass only one of url or html, not both");
  }
  const format = input.format ?? "A4";
  if (!VALID_FORMATS.has(format)) {
    throw new Error(`format must be one of: ${Array.from(VALID_FORMATS).join(", ")}`);
  }
  const landscape = input.landscape === true;
  const printBackground = input.printBackground !== false;
  const scale = clamp(input.scale ?? 1, 0.1, 2);
  const waitUntil = input.waitUntil ?? "networkidle";
  const delayMs = clampInt(input.delayMs ?? 0, 0, MAX_DELAY_MS);

  const margin = formatMargin(input.marginInches);

  const startedAt = Date.now();
  let browser: Browser | null = null;
  let finalUrl: string | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    if (input.url) {
      const parsed = await assertSafeUrl(input.url, "url");
      await page.goto(parsed.toString(), { waitUntil });
      finalUrl = page.url();
    } else {
      const html = input.html!;
      if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
        throw new Error(`html too large: ${Buffer.byteLength(html, "utf8")} bytes (max ${MAX_HTML_BYTES})`);
      }
      await page.setContent(html, { waitUntil });
    }

    if (delayMs > 0) await page.waitForTimeout(delayMs);

    const buffer = await page.pdf({
      format,
      landscape,
      printBackground,
      scale,
      margin,
      displayHeaderFooter: !!(input.headerHtml || input.footerHtml),
      headerTemplate: input.headerHtml ?? "<span></span>",
      footerTemplate: input.footerHtml ?? "<span></span>",
    });

    await ctx.close();

    return {
      buffer,
      contentType: "application/pdf",
      extension: "pdf",
      pageCount: estimatePageCount(buffer),
      outputBytes: buffer.byteLength,
      formatUsed: format,
      landscape,
      finalUrl,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}

function formatMargin(m?: PdfRenderInput["marginInches"]): { top: string; right: string; bottom: string; left: string } {
  const fmt = (v: number | undefined, d: number) => `${clamp(v ?? d, 0, 4)}in`;
  return {
    top: fmt(m?.top, 0.5),
    right: fmt(m?.right, 0.5),
    bottom: fmt(m?.bottom, 0.5),
    left: fmt(m?.left, 0.5),
  };
}

/**
 * Count occurrences of "/Type /Page" (with optional whitespace) in the PDF
 * byte stream. Cheap heuristic; matches the standard /Page object marker
 * but skips /Pages (the parent). Off-by-a-few in pathological cases is
 * fine for the metadata field — we don't claim accuracy.
 */
function estimatePageCount(buf: Buffer): number | null {
  const s = buf.toString("binary");
  const m = s.match(/\/Type\s*\/Page(?!s)/g);
  return m ? m.length : null;
}

function clamp(n: unknown, lo: number, hi: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
function clampInt(n: unknown, lo: number, hi: number): number {
  return Math.round(clamp(n, lo, hi));
}
