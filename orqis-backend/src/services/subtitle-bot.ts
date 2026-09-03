/**
 * subtitle-bot — audio/video → SRT/VTT, via faster-whisper (Python sidecar).
 *
 * Async agent — follows the demo-forge / course-quill pattern. The route layer
 * accepts a 202 ack, runs this in the background, then POSTs to the orqis
 * webhook with success or failure.
 *
 * Modes:
 *   - "mock" (default) → returns a canned 3-cue SRT after ~5 seconds. Enough
 *     for the polling UI + webhook delivery to be exercised end-to-end.
 *   - "real" → HTTP POST to `WHISPER_SIDECAR_URL` (e.g. http://localhost:5002/transcribe).
 *     Sidecar must accept `{ audioUrl OR audioBase64, language?, model? }`
 *     and return `{ srt, vtt, language, durationSec, segments[] }`. Reference
 *     impl: `orqis-py-services/subtitle-bot` (FastAPI + faster-whisper).
 */

export type SubtitleBotInput = {
  audioUrl?: string;
  audioBase64?: string;
  language?: string; // ISO 639-1, e.g. "en", "es"; omit for auto-detect
  model?: "tiny" | "base" | "small" | "medium" | "large";
  translateToEnglish?: boolean;
};

export type SubtitleSegment = {
  start: number; // seconds
  end: number;
  text: string;
};

export type SubtitleBotResult = {
  srt: string;
  vtt: string;
  plaintext: string;
  language: string;
  durationSeconds: number;
  segments: SubtitleSegment[];
  modelUsed: string;
  engineUsed: "sidecar" | "mock";
  durationMs: number;
};

export type SubtitleBotMode = "mock" | "real";

const REQUEST_TIMEOUT_MS = 120_000;
const MOCK_LATENCY_MS = 5_000;

export function detectMode(): SubtitleBotMode {
  const want = (process.env.WHISPER_PIPELINE ?? "").toLowerCase();
  if (want === "real" && process.env.WHISPER_SIDECAR_URL) return "real";
  return "mock";
}

function fmtSrtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`;
}
function fmtVttTime(s: number): string {
  return fmtSrtTime(s).replace(",", ".");
}
function pad(n: number, w = 2): string {
  return n.toString().padStart(w, "0");
}

function segmentsToSrt(segments: SubtitleSegment[]): string {
  return segments
    .map((s, i) => `${i + 1}\n${fmtSrtTime(s.start)} --> ${fmtSrtTime(s.end)}\n${s.text}\n`)
    .join("\n");
}
function segmentsToVtt(segments: SubtitleSegment[]): string {
  return (
    "WEBVTT\n\n" +
    segments
      .map((s) => `${fmtVttTime(s.start)} --> ${fmtVttTime(s.end)}\n${s.text}\n`)
      .join("\n")
  );
}

async function runMock(input: SubtitleBotInput): Promise<SubtitleBotResult> {
  const startedAt = Date.now();
  await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
  const segments: SubtitleSegment[] = [
    {
      start: 0,
      end: 2.4,
      text: "[subtitle-bot mock]",
    },
    {
      start: 2.4,
      end: 5.8,
      text: `Source: ${input.audioUrl ? input.audioUrl.slice(0, 60) : "base64 audio"}`,
    },
    {
      start: 5.8,
      end: 9,
      text: "Set WHISPER_PIPELINE=real + WHISPER_SIDECAR_URL to enable transcription.",
    },
  ];
  return {
    srt: segmentsToSrt(segments),
    vtt: segmentsToVtt(segments),
    plaintext: segments.map((s) => s.text).join(" "),
    language: input.language ?? "en",
    durationSeconds: segments[segments.length - 1].end,
    segments,
    modelUsed: "mock",
    engineUsed: "mock",
    durationMs: Date.now() - startedAt,
  };
}

async function runReal(input: SubtitleBotInput): Promise<SubtitleBotResult> {
  const startedAt = Date.now();
  const url = process.env.WHISPER_SIDECAR_URL!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audioUrl: input.audioUrl,
        audioBase64: input.audioBase64,
        language: input.language,
        model: input.model ?? "small",
        translateToEnglish: input.translateToEnglish === true,
      }),
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`subtitle-bot sidecar HTTP ${res.status}: ${body.slice(0, 800)}`);
  }
  const data = (await res.json()) as {
    srt?: string;
    vtt?: string;
    language?: string;
    durationSec?: number;
    segments?: SubtitleSegment[];
    modelUsed?: string;
  };
  if (!data.srt || !Array.isArray(data.segments)) {
    throw new Error("subtitle-bot sidecar response missing required fields");
  }
  return {
    srt: data.srt,
    vtt: data.vtt ?? segmentsToVtt(data.segments),
    plaintext: data.segments.map((s) => s.text).join(" "),
    language: data.language ?? input.language ?? "auto",
    durationSeconds: data.durationSec ?? data.segments[data.segments.length - 1]?.end ?? 0,
    segments: data.segments,
    modelUsed: data.modelUsed ?? input.model ?? "small",
    engineUsed: "sidecar",
    durationMs: Date.now() - startedAt,
  };
}

export async function runSubtitleBot(input: SubtitleBotInput): Promise<SubtitleBotResult> {
  if (!input.audioUrl && !input.audioBase64) {
    throw new Error("Either audioUrl or audioBase64 is required");
  }
  if (input.audioUrl && input.audioBase64) {
    throw new Error("Pass only one of audioUrl or audioBase64");
  }
  if (detectMode() === "real") return runReal(input);
  return runMock(input);
}
