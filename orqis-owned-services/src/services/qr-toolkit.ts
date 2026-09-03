/**
 * qr-toolkit — encode + decode + parse QR codes.
 *
 * Encode: `qrcode` lib → SVG (inline) + PNG buffer.
 * Decode: `jsqr` (pure JS, reads RGBA pixel grid) — we use sharp to rasterise
 *   any input format (URL or base64) into raw pixels before handing to jsqr.
 *
 * Classifies common payload kinds (URL, WiFi, vCard, mailto, sms, geo, plain).
 */

import QRCode from "qrcode";
import * as jsqrMod from "jsqr";
import sharp from "sharp";

type JsQrLike = (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;
const jsQR: JsQrLike =
  (jsqrMod as unknown as { default?: JsQrLike }).default ??
  (jsqrMod as unknown as JsQrLike);

export type QrEncodeInput = {
  mode: "encode";
  text: string;
  errorCorrection?: "L" | "M" | "Q" | "H";
  margin?: number;
  scale?: number;
  darkColor?: string;
  lightColor?: string;
};

export type QrDecodeInput = {
  mode: "decode";
  imageBase64?: string;
};

export type QrInput = QrEncodeInput | QrDecodeInput;

export type QrPayloadKind =
  | "url"
  | "wifi"
  | "vcard"
  | "mailto"
  | "sms"
  | "geo"
  | "tel"
  | "text";

export type QrToolkitResult =
  | {
      mode: "encode";
      svg: string;
      pngBuffer: Buffer;
      payloadKind: QrPayloadKind;
      length: number;
      durationMs: number;
    }
  | {
      mode: "decode";
      text: string;
      payloadKind: QrPayloadKind;
      parsed: Record<string, string> | null;
      durationMs: number;
    };

function classify(text: string): QrPayloadKind {
  if (/^WIFI:/i.test(text)) return "wifi";
  if (/^BEGIN:VCARD/i.test(text)) return "vcard";
  if (/^mailto:/i.test(text)) return "mailto";
  if (/^sms:/i.test(text)) return "sms";
  if (/^geo:/i.test(text)) return "geo";
  if (/^tel:/i.test(text)) return "tel";
  if (/^https?:\/\//i.test(text)) return "url";
  return "text";
}

function parsePayload(text: string, kind: QrPayloadKind): Record<string, string> | null {
  if (kind === "wifi") {
    const parts = text.slice(5).split(";").filter(Boolean);
    const out: Record<string, string> = {};
    for (const p of parts) {
      const [k, ...rest] = p.split(":");
      if (k && rest.length) out[k.toUpperCase()] = rest.join(":");
    }
    return Object.keys(out).length ? out : null;
  }
  if (kind === "vcard") {
    const out: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z][A-Z0-9;=_-]*):(.*)$/);
      if (m) out[m[1]] = m[2];
    }
    return Object.keys(out).length ? out : null;
  }
  if (kind === "mailto") {
    const u = safeUrl(text);
    if (!u) return null;
    return {
      to: u.pathname,
      ...Object.fromEntries(u.searchParams.entries()),
    };
  }
  if (kind === "url") {
    const u = safeUrl(text);
    return u ? { href: u.toString(), host: u.host } : null;
  }
  return null;
}

function safeUrl(s: string): URL | null {
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

export async function runQrToolkit(input: QrInput): Promise<QrToolkitResult> {
  const startedAt = performance.now();

  if (input.mode === "encode") {
    if (!input.text || typeof input.text !== "string") {
      throw new Error("text is required");
    }
    if (input.text.length > 2953) {
      throw new Error(`text is too long for a QR code (max 2953 chars; got ${input.text.length})`);
    }
    const opts = {
      errorCorrectionLevel: input.errorCorrection ?? "M",
      margin: clampInt(input.margin ?? 2, 0, 16),
      scale: clampInt(input.scale ?? 6, 1, 32),
      color: {
        dark: validateHex(input.darkColor ?? "#000000ff"),
        light: validateHex(input.lightColor ?? "#ffffffff"),
      },
    };
    const svg = await QRCode.toString(input.text, { ...opts, type: "svg" });
    const pngBuffer = await QRCode.toBuffer(input.text, { ...opts, type: "png" });
    const kind = classify(input.text);
    return {
      mode: "encode",
      svg,
      pngBuffer,
      payloadKind: kind,
      length: input.text.length,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  if (input.mode === "decode") {
    if (!input.imageBase64) throw new Error("imageBase64 is required for decode");
    const m = input.imageBase64.match(/^data:image\/[a-z0-9+]+;base64,(.+)$/i);
    const buf = Buffer.from(m ? m[1] : input.imageBase64, "base64");
    if (buf.byteLength === 0) throw new Error("imageBase64 decoded to zero bytes");
    if (buf.byteLength > 10 * 1024 * 1024) throw new Error("Image too large for decode (max 10 MB)");

    const { data, info } = await sharp(buf, { failOn: "none" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const clamped = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    const code = jsQR(clamped, info.width, info.height);
    if (!code) throw new Error("No QR code found in the image");

    const kind = classify(code.data);
    return {
      mode: "decode",
      text: code.data,
      payloadKind: kind,
      parsed: parsePayload(code.data, kind),
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  throw new Error("mode must be 'encode' or 'decode'");
}

function clampInt(n: unknown, lo: number, hi: number) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function validateHex(s: string): string {
  if (!/^#[0-9a-f]{6,8}$/i.test(s)) throw new Error(`color must be #rrggbb or #rrggbbaa; got ${s}`);
  return s;
}
