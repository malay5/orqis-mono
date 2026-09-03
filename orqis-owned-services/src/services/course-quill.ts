/**
 * course-quill — Sprint 9 in-house async agent.
 * Generates LaTeX coursework + Beamer slides with TikZ vector diagrams.
 *
 * Modes (LATEX_PIPELINE):
 *   - "mock" (default) → sleeps a short while then returns a stub PDF URL.
 *     Lets the full async pipeline (charge → ack → webhook → polling UI)
 *     be smoke-tested without external API costs and without needing the
 *     `tectonic` binary installed.
 *   - "real" → Anthropic for outline + per-section LaTeX content + TikZ
 *     source. Shells out to `tectonic` for compilation. **Currently falls
 *     back to mock with a TODO** since it needs `tectonic` system-installed,
 *     which is a fresh ask on Windows. The wire shape doesn't change.
 */

export type CourseQuillInput = {
  topic: string;
  courseLevel?: "intro" | "intermediate" | "advanced";
  pageCount?: number;
  format?: "paper" | "beamer-slides" | "both";
  includeTikzDiagrams?: boolean;
  equationDensity?: "sparse" | "balanced" | "heavy";
  citationStyle?: "acm" | "ieee" | "apa" | "none";
};

export type CourseQuillResult = {
  /** Same as pdfUrl — surfaced as `previewUrl` so the orqis TryItPanel embeds an inline preview. */
  previewUrl: string;
  pdfUrl: string;
  slidesPdfUrl?: string;
  sourceZipUrl?: string;
  tikzFigureCount: number;
  modelUsed: "mock" | "claude+tectonic";
  durationMs: number;
};

export type CourseQuillMode = "mock" | "real";

export function detectMode(): CourseQuillMode {
  const m = (process.env.LATEX_PIPELINE ?? "").toLowerCase();
  if (m === "real") return "real";
  return "mock";
}

const MOCK_LATENCY_MS = 8_000;

async function runMock(input: CourseQuillInput): Promise<CourseQuillResult> {
  const startedAt = Date.now();
  await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
  // arXiv hosts a stable demo PDF that's small enough to be a quick preview.
  // Replace with our own pre-saved demo bundle once the real pipeline lands.
  const demoPdf = "https://arxiv.org/pdf/1706.03762v7";
  return {
    previewUrl: demoPdf,
    pdfUrl: demoPdf,
    slidesPdfUrl: input.format === "paper" ? undefined : demoPdf,
    sourceZipUrl: undefined,
    tikzFigureCount: input.includeTikzDiagrams === false ? 0 : 3,
    modelUsed: "mock",
    durationMs: Date.now() - startedAt,
  };
}

async function runReal(input: CourseQuillInput): Promise<CourseQuillResult> {
  // TODO(sprint-9-followup): Anthropic for outline + per-section LaTeX +
  // TikZ source → write to temp dir → `tectonic` shell-out → zip → upload to R2.
  // Falls back to mock until `tectonic` is part of the Railway image.
  return runMock(input);
}

export async function runCourseQuill(input: CourseQuillInput): Promise<CourseQuillResult> {
  if (detectMode() === "real") return runReal(input);
  return runMock(input);
}
