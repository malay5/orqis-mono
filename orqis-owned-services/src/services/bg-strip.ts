/**
 * bg-strip — background removal for images.
 *
 * Real mode proxies to a Python sidecar (`rembg` + U²-Net). The sidecar
 * pattern is intentionally the same shape we'll need for seller-provided
 * Docker services in Month 4: an HTTP service we POST to + parse JSON back.
 *
 * Modes:
 *   - "mock" (default) → re-encodes the input as a PNG with alpha and applies
 *     a simple corner-derived chroma matte. Not real bg removal, but visually
 *     plausible enough for smoke tests and demo screenshots.
 *   - "real" → HTTP POST to `BG_STRIP_SIDECAR_URL` (e.g. http://localhost:5001/strip).
 *     Sidecar must accept `{ imageBase64, model? }` and return
 *     `{ pngBase64, modelUsed }`. Reference impl: `orqis-py-services/bg-strip`.
 */

import sharp from "sharp";

export type BgStripInput = {
  imageBase64: string;
  /** Reference model preset; passed through to the sidecar. */
  model?: "u2net" | "u2netp" | "isnet-general-use" | "silueta";
  /** When true, replace the alpha channel with a flat fill colour instead. */
  fillHex?: string;
};

export type BgStripResult = {
  pngBuffer: Buffer;
  width: number;
  height: number;
  originalBytes: number;
  outputBytes: number;
  modelUsed: string;
  engineUsed: "sidecar" | "mock";
  durationMs: number;
};

export type BgStripMode = "mock" | "real";

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 45_000;

export function detectMode(): BgStripMode {
  const want = (process.env.BG_STRIP_PIPELINE ?? "").toLowerCase();
  if (want === "real" && process.env.BG_STRIP_SIDECAR_URL) return "real";
  return "mock";
}

function decode(input: string): Buffer {
  const m = input.match(/^data:image\/[a-z0-9+]+;base64,(.+)$/i);
  const buf = Buffer.from(m ? m[1] : input, "base64");
  if (buf.byteLength === 0) throw new Error("imageBase64 decoded to zero bytes");
  if (buf.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`image too large: ${buf.byteLength} bytes (max ${MAX_INPUT_BYTES})`);
  }
  return buf;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`fillHex must be #rrggbb; got ${hex}`);
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/**
 * Mock pipeline. We can't replicate U²-Net in pure Node, but we can sample
 * the four corner pixels, treat them as the background colour, and turn
 * pixels within a small tolerance transparent. Works surprisingly well on
 * product shots taken against a clean backdrop.
 */
async function runMock(input: BgStripInput): Promise<BgStripResult> {
  const startedAt = Date.now();
  const sourceBuf = decode(input.imageBase64);

  const { data, info } = await sharp(sourceBuf, { failOn: "none" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const sample = (x: number, y: number) => {
    const idx = (y * w + x) * 4;
    return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
  };
  const corners = [sample(0, 0), sample(w - 1, 0), sample(0, h - 1), sample(w - 1, h - 1)];
  const avg = {
    r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
    g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
    b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4),
  };
  const tolerance = 32;

  const out = Buffer.from(data); // copy
  const fill = input.fillHex ? parseHex(input.fillHex) : null;
  for (let i = 0; i < out.length; i += 4) {
    const dr = out[i] - avg.r;
    const dg = out[i + 1] - avg.g;
    const db = out[i + 2] - avg.b;
    if (dr * dr + dg * dg + db * db < tolerance * tolerance) {
      if (fill) {
        out[i] = fill.r;
        out[i + 1] = fill.g;
        out[i + 2] = fill.b;
        out[i + 3] = 255;
      } else {
        out[i + 3] = 0;
      }
    }
  }

  const pngBuffer = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

  return {
    pngBuffer,
    width: w,
    height: h,
    originalBytes: sourceBuf.byteLength,
    outputBytes: pngBuffer.byteLength,
    modelUsed: "mock-corner-key",
    engineUsed: "mock",
    durationMs: Date.now() - startedAt,
  };
}

async function runReal(input: BgStripInput): Promise<BgStripResult> {
  const startedAt = Date.now();
  const url = process.env.BG_STRIP_SIDECAR_URL!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageBase64: input.imageBase64,
        model: input.model ?? "u2net",
        fillHex: input.fillHex,
      }),
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`bg-strip sidecar HTTP ${res.status}: ${body.slice(0, 800)}`);
  }
  const data = (await res.json()) as { pngBase64?: string; modelUsed?: string };
  if (!data.pngBase64) throw new Error("bg-strip sidecar did not return pngBase64");

  const pngBuffer = Buffer.from(data.pngBase64, "base64");
  const meta = await sharp(pngBuffer).metadata();
  const sourceBytes = Buffer.from(input.imageBase64, "base64").byteLength;

  return {
    pngBuffer,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    originalBytes: sourceBytes,
    outputBytes: pngBuffer.byteLength,
    modelUsed: data.modelUsed ?? input.model ?? "u2net",
    engineUsed: "sidecar",
    durationMs: Date.now() - startedAt,
  };
}

export async function runBgStrip(input: BgStripInput): Promise<BgStripResult> {
  if (!input || typeof input.imageBase64 !== "string") {
    throw new Error("imageBase64 is required");
  }
  if (detectMode() === "real") return runReal(input);
  return runMock(input);
}
