/**
 * nano-banana — dual-mode Gemini image generation (gemini-2.5-flash-image-preview).
 *
 * Different from poster-forge: poster-forge bakes Gemini into a typographic
 * poster pipeline (Claude plans the layout, Gemini does the artwork, sharp
 * composites real text on top). nano-banana is the raw image-gen call —
 * caller supplies the full prompt, we hand them back the PNG.
 *
 * Modes:
 *   1. BYO-key (input.apiKey) → caller's key, 1-credit routing fee.
 *   2. Managed (GEMINI_API_KEY) → orqis's key, full price.
 *   3. Mock — generates a small canvas-style placeholder via sharp.
 */

import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

export type NanoBananaInput = {
  prompt: string;
  aspectRatio?: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
  apiKey?: string;
};

export type NanoBananaResult = {
  buffer: Buffer;
  mimeType: "image/png";
  extension: "png";
  mode: "byok" | "managed" | "mock";
  width: number;
  height: number;
  outputBytes: number;
  promptUsed: string;
  durationMs: number;
};

const MODEL = "gemini-2.5-flash-image-preview";

const ASPECT_DIMENSIONS: Record<NonNullable<NanoBananaInput["aspectRatio"]>, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 },
  "4:3": { w: 1024, h: 768 },
  "3:4": { w: 768, h: 1024 },
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
};

export type NanoBananaMode = "byok" | "managed" | "mock";

export function detectMode(input: NanoBananaInput): NanoBananaMode {
  if (input.apiKey && input.apiKey.trim()) return "byok";
  if (process.env.GEMINI_API_KEY) return "managed";
  return "mock";
}

function validate(input: NanoBananaInput): { prompt: string; aspectRatio: NonNullable<NanoBananaInput["aspectRatio"]> } {
  if (!input.prompt || typeof input.prompt !== "string") {
    throw new Error("prompt is required");
  }
  if (input.prompt.length > 4_000) {
    throw new Error(`prompt too long: ${input.prompt.length} chars (max 4000)`);
  }
  const aspectRatio = input.aspectRatio ?? "1:1";
  if (!ASPECT_DIMENSIONS[aspectRatio]) {
    throw new Error(`aspectRatio must be one of: ${Object.keys(ASPECT_DIMENSIONS).join(", ")}`);
  }
  return { prompt: input.prompt.trim(), aspectRatio };
}

async function runReal(input: NanoBananaInput, apiKey: string, mode: "byok" | "managed"): Promise<NanoBananaResult> {
  const startedAt = Date.now();
  const { prompt, aspectRatio } = validate(input);
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: `${prompt}\n\n(Aspect ratio: ${aspectRatio})` }] }],
    config: { responseModalities: ["IMAGE"] },
  });

  // Find the first inline image part in the response candidates.
  type ImagePart = { inlineData?: { data?: string; mimeType?: string } };
  const candidates = (res as { candidates?: { content?: { parts?: ImagePart[] } }[] }).candidates ?? [];
  let b64: string | null = null;
  for (const c of candidates) {
    for (const p of c.content?.parts ?? []) {
      if (p.inlineData?.data) {
        b64 = p.inlineData.data;
        break;
      }
    }
    if (b64) break;
  }
  if (!b64) {
    throw new Error("Gemini returned no inline image data");
  }
  const buffer = Buffer.from(b64, "base64");
  const meta = await sharp(buffer).metadata();
  return {
    buffer,
    mimeType: "image/png",
    extension: "png",
    mode,
    width: meta.width ?? ASPECT_DIMENSIONS[aspectRatio].w,
    height: meta.height ?? ASPECT_DIMENSIONS[aspectRatio].h,
    outputBytes: buffer.byteLength,
    promptUsed: prompt,
    durationMs: Date.now() - startedAt,
  };
}

async function runMock(input: NanoBananaInput): Promise<NanoBananaResult> {
  const startedAt = Date.now();
  const { prompt, aspectRatio } = validate(input);
  const { w, h } = ASPECT_DIMENSIONS[aspectRatio];

  // SVG-composited placeholder: gradient background + prompt text + "MOCK" badge.
  const escapedPrompt = prompt.slice(0, 60).replace(/[<>&"']/g, " ");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fbbf24"/>
          <stop offset="100%" stop-color="#a855f7"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
            font-family="Arial,sans-serif" font-size="${Math.floor(w / 24)}" fill="white"
            font-weight="700">nano-banana</text>
      <text x="50%" y="${h / 2 + w / 16}" text-anchor="middle"
            font-family="Arial,sans-serif" font-size="${Math.floor(w / 48)}" fill="white" opacity="0.85">
        ${escapedPrompt}
      </text>
      <text x="50%" y="${h - 24}" text-anchor="middle"
            font-family="Arial,sans-serif" font-size="14" fill="white" opacity="0.7">
        MOCK — set GEMINI_API_KEY for real image-gen
      </text>
    </svg>
  `;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    buffer,
    mimeType: "image/png",
    extension: "png",
    mode: "mock",
    width: w,
    height: h,
    outputBytes: buffer.byteLength,
    promptUsed: prompt,
    durationMs: Date.now() - startedAt,
  };
}

export async function runNanoBanana(input: NanoBananaInput): Promise<NanoBananaResult> {
  const mode = detectMode(input);
  if (mode === "mock") return runMock(input);
  const apiKey = mode === "byok" ? input.apiKey!.trim() : process.env.GEMINI_API_KEY!;
  return runReal(input, apiKey, mode);
}
