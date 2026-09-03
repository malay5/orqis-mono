/**
 * scrape-clean — URL → clean article markdown.
 *
 * Uses @extractus/article-extractor (Readability port + cheerio under the
 * hood) for content extraction and turndown for HTML → Markdown conversion.
 * SSRF-guarded URL fetch (same guard as img-shrink / ocr-vision).
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extract } from "@extractus/article-extractor";
import TurndownService from "turndown";

export type ScrapeCleanInput = {
  url: string;
  includeHtml?: boolean;
};

export type ScrapeCleanResult = {
  url: string;
  title: string;
  byline: string | null;
  siteName: string | null;
  publishedAt: string | null;
  excerpt: string | null;
  markdown: string;
  plaintext: string;
  html?: string;
  wordCount: number;
  durationMs: number;
};

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_HTML_BYTES = 5 * 1024 * 1024;

const PRIVATE_V4: [bigint, bigint][] = (
  [
    ["0.0.0.0", "0.255.255.255"],
    ["10.0.0.0", "10.255.255.255"],
    ["100.64.0.0", "100.127.255.255"],
    ["127.0.0.0", "127.255.255.255"],
    ["169.254.0.0", "169.254.255.255"],
    ["172.16.0.0", "172.31.255.255"],
    ["192.0.0.0", "192.0.0.255"],
    ["192.168.0.0", "192.168.255.255"],
    ["198.18.0.0", "198.19.255.255"],
    ["224.0.0.0", "239.255.255.255"],
    ["240.0.0.0", "255.255.255.255"],
  ] as const
).map(([a, b]) => [v4(a), v4(b)] as [bigint, bigint]);

function v4(addr: string): bigint {
  return addr.split(".").map((p) => BigInt(Number(p))).reduce((acc, p) => (acc << 8n) | p, 0n);
}
function blockedV4(a: string) {
  if (isIP(a) !== 4) return false;
  const n = v4(a);
  return PRIVATE_V4.some(([lo, hi]) => n >= lo && n <= hi);
}
function blockedV6(a: string) {
  if (isIP(a) !== 6) return false;
  const n = a.toLowerCase();
  return n === "::1" || /^fc|^fd|^fe[89ab]/.test(n) || n.includes("::ffff:127.");
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("url is not a valid URL");
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Only http(s) URLs are allowed; got ${parsed.protocol}`);
  }
  const host = parsed.hostname;
  if (isIP(host)) {
    if (blockedV4(host) || blockedV6(host)) {
      throw new Error("Refusing to fetch from a private / loopback IP");
    }
  } else {
    const records = await dnsLookup(host, { all: true });
    for (const r of records) {
      if (r.family === 4 ? blockedV4(r.address) : blockedV6(r.address)) {
        throw new Error(`Refusing to fetch ${host}: resolves to a private address`);
      }
    }
  }
  return parsed;
}

let turndownCache: TurndownService | null = null;
function getTurndown(): TurndownService {
  if (turndownCache) return turndownCache;
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  td.addRule("strip-style", {
    filter: ["style", "script", "noscript", "iframe", "form"],
    replacement: () => "",
  });
  turndownCache = td;
  return td;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|h\d|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function runScrapeClean(input: ScrapeCleanInput): Promise<ScrapeCleanResult> {
  if (!input.url || typeof input.url !== "string") {
    throw new Error("url is required");
  }
  const parsed = await assertSafeUrl(input.url.trim());

  const startedAt = performance.now();
  const article = await extract(parsed.toString(), { contentLengthThreshold: 200 }, {
    headers: { "user-agent": "orqis-scrape-clean/0.1" },
  });
  if (!article || !article.content) {
    throw new Error("Could not extract a readable article from this URL");
  }
  if (article.content.length > MAX_HTML_BYTES) {
    throw new Error(`Article HTML too large: ${article.content.length} bytes`);
  }

  const markdown = getTurndown().turndown(article.content).trim();
  const plaintext = htmlToText(article.content);

  return {
    url: parsed.toString(),
    title: article.title?.trim() ?? "",
    byline: article.author?.trim() ?? null,
    siteName: article.source?.trim() ?? null,
    publishedAt: article.published ?? null,
    excerpt: article.description?.trim() ?? null,
    markdown,
    plaintext,
    html: input.includeHtml === true ? article.content : undefined,
    wordCount: plaintext.split(/\s+/).filter(Boolean).length,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
