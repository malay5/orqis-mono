/**
 * og-card — extract Open Graph + Twitter Card + favicon metadata from a URL.
 *
 * Cheap fetch + cheerio parse. No browser, no JS execution — fine for the
 * 99% case where the markup contains the meta tags server-side. SPAs that
 * inject metadata client-side need scrape-render instead.
 *
 * Competes with: Microlink, Iframely, OpenGraph.io. Same job, faster
 * setup, our pricing.
 */

import * as cheerio from "cheerio";
import { assertSafeUrl } from "../lib/url-guard.js";

export type OgCardInput = {
  url: string;
};

export type OgCardResult = {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  language: string | null;
  siteName: string | null;
  url_canonical: string | null;
  image: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  type: string | null;
  twitter: {
    card: string | null;
    site: string | null;
    creator: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
  };
  favicon: string | null;
  durationMs: number;
};

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;

export async function runOgCard(input: OgCardInput): Promise<OgCardResult> {
  const startedAt = performance.now();
  const parsed = await assertSafeUrl(input.url, "url");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  let finalUrl: string;
  try {
    const res = await fetch(parsed, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "orqis-og-card/0.1 (+https://orqis.xyz)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`fetch returned HTTP ${res.status}`);
    finalUrl = res.url;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      throw new Error(`HTML too large: ${buf.byteLength} bytes`);
    }
    html = buf.toString("utf8");
  } finally {
    clearTimeout(timer);
  }

  const $ = cheerio.load(html);
  const m = (selector: string, attr = "content"): string | null =>
    $(selector).first().attr(attr)?.trim() || null;

  const absolutize = (href: string | null): string | null => {
    if (!href) return null;
    try {
      return new URL(href, finalUrl).toString();
    } catch {
      return href;
    }
  };

  const ogImage = m('meta[property="og:image"]') ?? m('meta[property="og:image:url"]');
  const image = absolutize(ogImage);

  const widthRaw = m('meta[property="og:image:width"]');
  const heightRaw = m('meta[property="og:image:height"]');

  const faviconHref =
    $('link[rel="icon"]').first().attr("href") ||
    $('link[rel="shortcut icon"]').first().attr("href") ||
    $('link[rel="apple-touch-icon"]').first().attr("href") ||
    "/favicon.ico";

  return {
    url: parsed.toString(),
    finalUrl,
    title: m('meta[property="og:title"]') ?? ($("title").first().text().trim() || null),
    description: m('meta[property="og:description"]') ?? m('meta[name="description"]'),
    language: m("html", "lang"),
    siteName: m('meta[property="og:site_name"]'),
    url_canonical: absolutize($('link[rel="canonical"]').first().attr("href") || m('meta[property="og:url"]')),
    image,
    imageAlt: m('meta[property="og:image:alt"]'),
    imageWidth: numberOrNull(widthRaw),
    imageHeight: numberOrNull(heightRaw),
    type: m('meta[property="og:type"]'),
    twitter: {
      card: m('meta[name="twitter:card"]'),
      site: m('meta[name="twitter:site"]'),
      creator: m('meta[name="twitter:creator"]'),
      title: m('meta[name="twitter:title"]'),
      description: m('meta[name="twitter:description"]'),
      image: absolutize(m('meta[name="twitter:image"]')),
    },
    favicon: absolutize(faviconHref),
    durationMs: Math.round(performance.now() - startedAt),
  };
}

function numberOrNull(s: string | null): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
