/**
 * exif-clean — strip EXIF / GPS / camera metadata from images.
 *
 * Reads all metadata via exifr, then re-encodes via sharp with `withMetadata`
 * disabled — sharp's encoder drops every metadata segment in the process,
 * which is the cleanest way to guarantee removal across format quirks.
 *
 * Returns a `removed` summary so callers can verify what was stripped.
 */

import exifr from "exifr";
import sharp from "sharp";

export type ExifCleanInput = {
  imageBase64: string;
  outputFormat?: "preserve" | "jpeg" | "png" | "webp";
};

export type ExifCleanRemoved = {
  hasExif: boolean;
  hasGps: boolean;
  hasXmp: boolean;
  hasIcc: boolean;
  camera: string | null;
  takenAt: string | null;
  gps: { lat: number; lon: number } | null;
};

export type ExifCleanResult = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  outputFormat: "jpeg" | "png" | "webp";
  width: number;
  height: number;
  originalBytes: number;
  outputBytes: number;
  removed: ExifCleanRemoved;
  durationMs: number;
};

const MAX_INPUT_BYTES = 25 * 1024 * 1024;

const FORMAT_INFO: Record<
  "jpeg" | "png" | "webp",
  { contentType: string; extension: string }
> = {
  jpeg: { contentType: "image/jpeg", extension: "jpg" },
  png: { contentType: "image/png", extension: "png" },
  webp: { contentType: "image/webp", extension: "webp" },
};

function decodeBase64(input: string): Buffer {
  const m = input.match(/^data:image\/[a-z0-9+]+;base64,(.+)$/i);
  const buf = Buffer.from(m ? m[1] : input, "base64");
  if (buf.byteLength === 0) throw new Error("imageBase64 decoded to zero bytes");
  if (buf.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`Image too large: ${buf.byteLength} bytes`);
  }
  return buf;
}

export async function runExifClean(input: ExifCleanInput): Promise<ExifCleanResult> {
  if (!input.imageBase64) throw new Error("imageBase64 is required");
  const startedAt = performance.now();
  const sourceBuf = decodeBase64(input.imageBase64);
  const originalBytes = sourceBuf.byteLength;

  // Read metadata first — exifr returns null for fields absent in the file.
  type ParsedMeta = {
    Make?: string;
    Model?: string;
    DateTimeOriginal?: Date | string;
    CreateDate?: Date | string;
    latitude?: number;
    longitude?: number;
  };
  const parsed = (await exifr.parse(sourceBuf, true).catch(() => null)) as ParsedMeta | null;

  // sharp.metadata() tells us which segments existed in the source.
  const meta = await sharp(sourceBuf, { failOn: "none" }).metadata();
  const removed: ExifCleanRemoved = {
    hasExif: !!meta.exif,
    hasGps: !!(parsed && typeof parsed.latitude === "number"),
    hasXmp: !!meta.xmp,
    hasIcc: !!meta.icc,
    camera:
      parsed && (parsed.Make || parsed.Model)
        ? [parsed.Make, parsed.Model].filter(Boolean).join(" ").trim()
        : null,
    takenAt:
      parsed && parsed.DateTimeOriginal
        ? new Date(parsed.DateTimeOriginal).toISOString()
        : parsed && parsed.CreateDate
        ? new Date(parsed.CreateDate).toISOString()
        : null,
    gps:
      parsed && typeof parsed.latitude === "number" && typeof parsed.longitude === "number"
        ? { lat: parsed.latitude, lon: parsed.longitude }
        : null,
  };

  const sourceFormat = (meta.format ?? "").toLowerCase();
  const target: "jpeg" | "png" | "webp" =
    input.outputFormat && input.outputFormat !== "preserve"
      ? input.outputFormat
      : sourceFormat === "png"
      ? "png"
      : sourceFormat === "webp"
      ? "webp"
      : "jpeg";

  // No call to withMetadata() — sharp encoders default to stripping.
  const pipeline = sharp(sourceBuf, { failOn: "none" });
  let out: Buffer;
  switch (target) {
    case "jpeg":
      out = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      break;
    case "png":
      out = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      break;
    case "webp":
      out = await pipeline.webp({ quality: 92 }).toBuffer();
      break;
  }

  const outMeta = await sharp(out).metadata();
  return {
    buffer: out,
    contentType: FORMAT_INFO[target].contentType,
    extension: FORMAT_INFO[target].extension,
    outputFormat: target,
    width: outMeta.width ?? 0,
    height: outMeta.height ?? 0,
    originalBytes,
    outputBytes: out.byteLength,
    removed,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
