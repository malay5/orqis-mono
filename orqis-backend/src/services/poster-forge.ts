import sharp from "sharp";

/**
 * poster-forge — Sprint 10 in-house sync agent.
 * Generates event posters / key art.
 *
 * Mock mode (default): we render a real-looking poster on the fly with sharp +
 *   an SVG layout. Free, no external API. Looks decent enough to demo.
 *
 * Real mode (GOOGLE_API_KEY set): would call Gemini's image model
 *   ("nano banana" / gemini-2.5-flash-image-preview), then composite the title
 *   text on top with sharp because image models still don't render long titles
 *   reliably. Stubbed; falls back to mock until we have the API key.
 */

export type PosterForgeInput = {
  title: string;
  subtitle?: string;
  eventDetails?: string;
  vibe: string;
  aspectRatio?: "1:1" | "4:5" | "9:16" | "16:9" | "3:4" | "2:3" | "a4-portrait";
  accentHex?: string;
  avoid?: string[];
};

export type PosterForgeResult = {
  buffer: Buffer; // PNG bytes
  width: number;
  height: number;
  modelUsed: "mock" | "gemini-nano-banana+sharp";
  durationMs: number;
};

export type PosterForgeMode = "mock" | "real";

export function detectMode(): PosterForgeMode {
  const k = process.env.GOOGLE_API_KEY;
  if (!k || k === "mock") return "mock";
  return "real";
}

const ASPECT_DIMENSIONS: Record<NonNullable<PosterForgeInput["aspectRatio"]>, [number, number]> = {
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "3:4": [1080, 1440],
  "2:3": [1080, 1620],
  "a4-portrait": [1240, 1754], // ~150 dpi A4
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Tiny readable-contrast helper. We choose between black and white for the
 * accent text overlay based on the perceived luminance of the accent color.
 */
function readableOn(hex: string): string {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return "#0a0a0f";
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0a0a0f" : "#f5f5fa";
}

function pickHashedHue(s: string): string {
  // Stable color picker so the same vibe string yields the same secondary.
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 70%, 55%)`;
}

/**
 * Build a poster as an SVG string, then have sharp rasterize it. SVG is the
 * sweet spot for "designy mock" — gradients, type, layout — without a render
 * farm. The output is a real PNG, not a placeholder.
 */
function buildPosterSvg(input: PosterForgeInput, width: number, height: number): string {
  const accent = input.accentHex ?? "#a855f7";
  const secondary = pickHashedHue(input.vibe);
  const inkOnAccent = readableOn(accent);

  // Dynamically size the title to fit the width — bigger fonts for short titles.
  const titleFontSize = Math.max(48, Math.min(140, Math.round(width / Math.max(input.title.length / 1.4, 6))));
  const subtitleFontSize = Math.round(titleFontSize * 0.32);
  const detailFontSize = Math.round(titleFontSize * 0.22);

  const padX = Math.round(width * 0.08);
  const titleY = Math.round(height * 0.5);
  const subtitleY = titleY + Math.round(titleFontSize * 0.55);
  const detailY = height - Math.round(height * 0.07);

  const subtitleLine = input.subtitle ? escapeXml(input.subtitle) : "";
  const detailLine = input.eventDetails ? escapeXml(input.eventDetails) : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#07070b"/>
      <stop offset="1" stop-color="#16121f"/>
    </linearGradient>
    <radialGradient id="glow1" cx="${width * 0.85}" cy="${height * 0.15}" r="${Math.max(width, height) * 0.6}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="${width * 0.1}" cy="${height * 0.85}" r="${Math.max(width, height) * 0.6}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${secondary}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${secondary}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grain" x="0" y="0" width="180" height="180" patternUnits="userSpaceOnUse">
      <rect width="180" height="180" fill="url(#bg)"/>
    </pattern>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow1)"/>
  <rect width="${width}" height="${height}" fill="url(#glow2)"/>

  <!-- accent rule near top -->
  <rect x="${padX}" y="${Math.round(height * 0.12)}" width="${Math.round(width * 0.1)}" height="6" rx="3" fill="${accent}"/>

  <text x="${padX}" y="${titleY}" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${titleFontSize}" font-weight="700" fill="#f5f5fa" letter-spacing="-0.025em">${escapeXml(input.title)}</text>

  ${
    subtitleLine
      ? `<text x="${padX}" y="${subtitleY}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="${subtitleFontSize}" font-weight="500" fill="#c5c5d6">${subtitleLine}</text>`
      : ""
  }

  ${
    detailLine
      ? `<text x="${padX}" y="${detailY}" font-family="ui-monospace, SFMono-Regular, monospace" font-size="${detailFontSize}" font-weight="500" fill="${accent}">${detailLine}</text>`
      : ""
  }

  <!-- mock-mode watermark, small + low contrast -->
  <text x="${width - padX}" y="${height - 24}" text-anchor="end" font-family="ui-monospace, monospace" font-size="14" fill="${inkOnAccent}" opacity="0.35">poster-forge · mock</text>
</svg>`;
}

async function runMock(input: PosterForgeInput): Promise<PosterForgeResult> {
  const startedAt = Date.now();
  const [w, h] = ASPECT_DIMENSIONS[input.aspectRatio ?? "a4-portrait"];
  const svg = buildPosterSvg(input, w, h);
  const png = await sharp(Buffer.from(svg, "utf8")).png({ compressionLevel: 9 }).toBuffer();
  return {
    buffer: png,
    width: w,
    height: h,
    modelUsed: "mock",
    durationMs: Date.now() - startedAt,
  };
}

async function runReal(input: PosterForgeInput): Promise<PosterForgeResult> {
  // TODO(sprint-10-followup): @google/genai for image gen via gemini-2.5-flash-image-preview,
  // then sharp.composite() to overlay the title text. Falls back to mock until
  // GOOGLE_API_KEY is wired up.
  return runMock(input);
}

export async function runPosterForge(input: PosterForgeInput): Promise<PosterForgeResult> {
  if (detectMode() === "real") return runReal(input);
  return runMock(input);
}
