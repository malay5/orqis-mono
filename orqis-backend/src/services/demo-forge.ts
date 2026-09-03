/**
 * demo-forge — Sprint 8 in-house async agent.
 * Generates a 30-second narrated product demo video from a brief.
 *
 * Two modes, picked from MEDIA_PIPELINE env:
 *   - "mock" (default) → returns a placeholder MP4 URL after a short delay.
 *     Lets us smoke-test the entire async pipeline (charge → ack → webhook
 *     → polling UI) with zero external API costs.
 *   - "real" → Anthropic for the script, ElevenLabs for voiceover, Remotion
 *     for the render. Requires ANTHROPIC_API_KEY + ELEVENLABS_API_KEY +
 *     a Remotion runtime. Stub for now; full implementation is a follow-up
 *     since it needs three keys + a render farm.
 */

export type DemoForgeInput = {
  product: string; // URL or free-text description
  durationSeconds?: 15 | 30 | 60;
  voice?: "alloy" | "onyx" | "nova" | "shimmer";
  style?: "minimal" | "bold" | "playful";
};

export type DemoForgeResult = {
  previewUrl: string;
  posterUrl?: string;
  scriptMarkdown?: string;
  modelUsed: "mock" | "claude+elevenlabs+remotion";
  durationMs: number;
};

export type DemoForgeMode = "mock" | "real";

export function detectMode(): DemoForgeMode {
  const m = (process.env.MEDIA_PIPELINE ?? "").toLowerCase();
  if (m === "real") return "real";
  return "mock";
}

const MOCK_LATENCY_MS = 8_000; // simulates a real video render

/**
 * Mock pipeline. Sleeps long enough for the polling UI to be interesting,
 * returns a stable placeholder URL. The placeholder is a tiny pre-saved MP4
 * served from /r/ — see scripts/seed-demo-mock.ts (created on first run).
 */
async function runMock(input: DemoForgeInput): Promise<DemoForgeResult> {
  const startedAt = Date.now();
  await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
  return {
    // SAMPLE.mp4 is a 1-second test pattern from sample-videos.com — the
    // smallest publicly-CDN-hosted MP4 we can point at without storing one.
    // Replace with an R2 URL once the real pipeline lands.
    previewUrl:
      "https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4",
    scriptMarkdown: `# 30-second demo: ${input.product}\n\n[Mock script — set MEDIA_PIPELINE=real to enable Claude + ElevenLabs + Remotion.]`,
    modelUsed: "mock",
    durationMs: Date.now() - startedAt,
  };
}

async function runReal(_input: DemoForgeInput): Promise<DemoForgeResult> {
  // TODO(sprint-8-followup): Anthropic script → ElevenLabs voiceover →
  // Remotion render. Needs ANTHROPIC_API_KEY + ELEVENLABS_API_KEY + a
  // Remotion runtime (Lambda or local headless Chromium). Falling back to
  // mock until that lands so the pipeline still works end-to-end.
  return runMock(_input);
}

export async function runDemoForge(input: DemoForgeInput): Promise<DemoForgeResult> {
  if (detectMode() === "real") return runReal(input);
  return runMock(input);
}
