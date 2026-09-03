/**
 * ocr-vision — Tesseract.js wrapper. Pure-Node OCR (no native deps).
 *
 * Accepts an image as URL or base64 and returns extracted text + per-word
 * bounding boxes. SSRF-guarded URL fetch (mirrors img-shrink).
 *
 * Tesseract.js downloads language data (~10MB per lang) on first run and
 * caches it under the OS temp dir. First call is slow; subsequent calls are
 * fast. We keep one worker pool of size 1 to amortise startup.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createWorker, type Worker } from "tesseract.js";

export type OcrVisionInput = {
  imageUrl?: string;
  imageBase64?: string;
  language?: string; // e.g. "eng", "spa", "eng+fra"
};

export type OcrVisionWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type OcrVisionResult = {
  text: string;
  language: string;
  confidence: number;
  wordCount: number;
  words: OcrVisionWord[];
  durationMs: number;
};

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_LANGS = /^[a-z]{3}(\+[a-z]{3})*$/;

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

async function safeFetch(url: string): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("imageUrl is not a valid URL");
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`Fetch returned HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) {
      throw new Error(`Expected image/* response, got ${ct || "unknown"}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_INPUT_BYTES) {
      throw new Error(`Image too large: ${buf.byteLength} bytes`);
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

function decodeBase64(input: string): Buffer {
  const m = input.match(/^data:image\/[a-z0-9+]+;base64,(.+)$/i);
  const buf = Buffer.from(m ? m[1] : input, "base64");
  if (buf.byteLength === 0) throw new Error("imageBase64 decoded to zero bytes");
  if (buf.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`Image too large: ${buf.byteLength} bytes`);
  }
  return buf;
}

let workerCache: { lang: string; worker: Worker } | null = null;

async function getWorker(lang: string): Promise<Worker> {
  if (workerCache && workerCache.lang === lang) return workerCache.worker;
  if (workerCache) await workerCache.worker.terminate().catch(() => {});
  const worker = await createWorker(lang);
  workerCache = { lang, worker };
  return worker;
}

export async function runOcrVision(input: OcrVisionInput): Promise<OcrVisionResult> {
  if (!input.imageUrl && !input.imageBase64) {
    throw new Error("Either imageUrl or imageBase64 is required");
  }
  if (input.imageUrl && input.imageBase64) {
    throw new Error("Pass only one of imageUrl or imageBase64, not both");
  }
  const language = (input.language ?? "eng").toLowerCase();
  if (!ALLOWED_LANGS.test(language)) {
    throw new Error("language must be a Tesseract code like 'eng' or 'eng+fra'");
  }

  const startedAt = performance.now();
  const buf = input.imageUrl
    ? await safeFetch(input.imageUrl)
    : decodeBase64(input.imageBase64!);

  const worker = await getWorker(language);
  const { data } = await worker.recognize(buf);

  // tesseract.js types changed across versions; treat words as optional.
  const rawWords = (data as { words?: unknown[] }).words ?? [];
  const words: OcrVisionWord[] = rawWords.slice(0, 1000).map((w) => {
    const obj = w as {
      text?: string;
      confidence?: number;
      bbox?: { x0?: number; y0?: number; x1?: number; y1?: number };
    };
    return {
      text: obj.text ?? "",
      confidence: typeof obj.confidence === "number" ? Math.round(obj.confidence * 10) / 10 : 0,
      bbox: {
        x0: obj.bbox?.x0 ?? 0,
        y0: obj.bbox?.y0 ?? 0,
        x1: obj.bbox?.x1 ?? 0,
        y1: obj.bbox?.y1 ?? 0,
      },
    };
  });

  return {
    text: data.text.trim(),
    language,
    confidence: Math.round((data.confidence ?? 0) * 10) / 10,
    wordCount: data.text.trim().split(/\s+/).filter(Boolean).length,
    words,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
