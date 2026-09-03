import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";

/**
 * img-shrink — non-AI utility agent. Resizes + recompresses images via sharp.
 *
 * Lives next to the AI agents on purpose: orqis is a marketplace for any
 * callable specialist, not just LLMs. Most users don't have a one-API
 * compressor + format converter at hand; this is that.
 */

export type ImgShrinkInput = {
  imageUrl?: string;
  imageBase64?: string;
  format?: "jpeg" | "png" | "webp" | "avif" | "auto";
  maxWidth?: number;
  quality?: number;
};

export type ImgShrinkResult = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  originalBytes: number;
  outputBytes: number;
  width: number;
  height: number;
  inputFormat: string;
  outputFormat: "jpeg" | "png" | "webp" | "avif";
};

const MAX_INPUT_BYTES = 25 * 1024 * 1024; // 25 MB
const FETCH_TIMEOUT_MS = 15_000;

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const PRIVATE_V4_BLOCKS: [bigint, bigint][] = [
  // 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10 (CGNAT), 127.0.0.0/8, 169.254.0.0/16,
  // 172.16.0.0/12, 192.0.0.0/24, 192.168.0.0/16, 198.18.0.0/15, 224.0.0.0/4 (multicast),
  // 240.0.0.0/4 (reserved), 255.255.255.255
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
].map(([a, b]) => [v4ToBigInt(a), v4ToBigInt(b)] as [bigint, bigint]);

function v4ToBigInt(addr: string): bigint {
  return addr
    .split(".")
    .map((p) => BigInt(Number(p)))
    .reduce((acc, p) => (acc << 8n) | p, 0n);
}

function isBlockedV4(addr: string): boolean {
  if (isIP(addr) !== 4) return false;
  const n = v4ToBigInt(addr);
  return PRIVATE_V4_BLOCKS.some(([lo, hi]) => n >= lo && n <= hi);
}

function isBlockedV6(addr: string): boolean {
  if (isIP(addr) !== 6) return false;
  const norm = addr.toLowerCase();
  // ::1 (loopback), fc00::/7 (unique-local), fe80::/10 (link-local), ::ffff:127.x (mapped v4 loopback)
  return (
    norm === "::1" ||
    norm.startsWith("fc") ||
    norm.startsWith("fd") ||
    norm.startsWith("fe8") ||
    norm.startsWith("fe9") ||
    norm.startsWith("fea") ||
    norm.startsWith("feb") ||
    norm.includes("::ffff:127.") ||
    norm.includes("::ffff:10.") ||
    norm.includes("::ffff:192.168.") ||
    norm.includes("::ffff:172.")
  );
}

/**
 * SSRF guard. Resolve the URL's host and reject if it points at a private,
 * loopback, link-local, or multicast address. We do NOT then re-fetch via the
 * resolved IP because the second resolution could differ (DNS rebinding); we
 * just reject the request when DNS *currently* points anywhere unsafe and trust
 * that's good enough for our threat model. If you need stronger guarantees,
 * pin the resolution and pass the IP as Host header.
 */
async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("imageUrl is not a valid URL");
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Only http(s) URLs are allowed; got ${parsed.protocol}`);
  }

  const host = parsed.hostname;

  // If hostname is already an IP literal, validate directly.
  if (isIP(host)) {
    if (isBlockedV4(host) || isBlockedV6(host)) {
      throw new Error("Refusing to fetch from a private / loopback IP");
    }
    return parsed;
  }

  // Resolve all addresses; reject if any are blocked (defense against round-robin DNS).
  const records = await dnsLookup(host, { all: true });
  for (const r of records) {
    if (r.family === 4 ? isBlockedV4(r.address) : isBlockedV6(r.address)) {
      throw new Error(
        `Refusing to fetch from ${host}: resolves to a private / loopback address`
      );
    }
  }
  return parsed;
}

async function fetchImageBytes(url: URL): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`Fetch returned HTTP ${res.status}`);
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) {
      throw new Error(`Expected image/* response, got ${ct || "unknown"}`);
    }
    const cl = Number(res.headers.get("content-length") ?? "0");
    if (cl > MAX_INPUT_BYTES) {
      throw new Error(`Image too large: ${cl} bytes (max ${MAX_INPUT_BYTES})`);
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
  // Accept both bare base64 and data URLs.
  const m = input.match(/^data:image\/[a-z0-9+]+;base64,(.+)$/i);
  const b64 = m ? m[1] : input;
  const buf = Buffer.from(b64, "base64");
  if (buf.byteLength === 0) {
    throw new Error("imageBase64 decoded to zero bytes");
  }
  if (buf.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`Image too large: ${buf.byteLength} bytes`);
  }
  return buf;
}

const FORMAT_INFO: Record<
  "jpeg" | "png" | "webp" | "avif",
  { contentType: string; extension: string }
> = {
  jpeg: { contentType: "image/jpeg", extension: "jpg" },
  png: { contentType: "image/png", extension: "png" },
  webp: { contentType: "image/webp", extension: "webp" },
  avif: { contentType: "image/avif", extension: "avif" },
};

function pickFormat(
  desired: ImgShrinkInput["format"],
  source: string
): "jpeg" | "png" | "webp" | "avif" {
  if (desired && desired !== "auto") return desired;
  // "auto" or unset → webp is the modern default. Falls back to source format
  // if source is already webp/avif (avoids re-encoding for nothing).
  if (source === "webp" || source === "avif") return source;
  return "webp";
}

export async function runImgShrink(
  input: ImgShrinkInput
): Promise<ImgShrinkResult> {
  if (!input.imageUrl && !input.imageBase64) {
    throw new Error("Either imageUrl or imageBase64 is required");
  }
  if (input.imageUrl && input.imageBase64) {
    throw new Error("Pass only one of imageUrl or imageBase64, not both");
  }

  const sourceBuf = input.imageUrl
    ? await fetchImageBytes(await assertSafeUrl(input.imageUrl))
    : decodeBase64(input.imageBase64!);
  const originalBytes = sourceBuf.byteLength;

  // sharp.metadata() reads the source format without decoding the full image.
  const meta = await sharp(sourceBuf).metadata();
  const sourceFormat = (meta.format ?? "unknown").toLowerCase();
  const targetFormat = pickFormat(input.format, sourceFormat);

  const maxWidth = clampInt(input.maxWidth ?? 1920, 16, 8192);
  const quality = clampInt(input.quality ?? 80, 1, 100);

  const pipeline = sharp(sourceBuf, { failOn: "none" });
  if ((meta.width ?? 0) > maxWidth) {
    pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  let out: Buffer;
  switch (targetFormat) {
    case "jpeg":
      out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      break;
    case "png":
      // PNG is lossless — quality maps to compressionLevel.
      out = await pipeline
        .png({ compressionLevel: Math.round((100 - quality) / 11.11) })
        .toBuffer();
      break;
    case "webp":
      out = await pipeline.webp({ quality }).toBuffer();
      break;
    case "avif":
      out = await pipeline.avif({ quality }).toBuffer();
      break;
  }

  const outMeta = await sharp(out).metadata();

  return {
    buffer: out,
    contentType: FORMAT_INFO[targetFormat].contentType,
    extension: FORMAT_INFO[targetFormat].extension,
    originalBytes,
    outputBytes: out.byteLength,
    width: outMeta.width ?? 0,
    height: outMeta.height ?? 0,
    inputFormat: sourceFormat,
    outputFormat: targetFormat,
  };
}

function clampInt(n: unknown, min: number, max: number): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}
