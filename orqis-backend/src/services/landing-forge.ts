import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * landing-forge — Sprint 7 in-house agent.
 * Generates a single-file HTML landing page from a brief.
 *
 * Two modes, picked from ANTHROPIC_API_KEY:
 *   - unset / "mock"  → returns a hand-written sample (zero API cost; smoke-test path)
 *   - real key        → claude-sonnet-4-6 with prompt-cached system prompt + structured output
 */

export type LandingForgeInput = {
  productName: string;
  oneLiner: string;
  audience?: string;
  features?: string[];
  tone?: "minimal" | "bold" | "playful" | "premium";
  primaryColor?: string;
};

export type LandingForgeResult = {
  html: string;
  designNotes: string[];
  modelUsed: string; // "mock" | "claude-sonnet-4-6"
  cacheReadTokens?: number;
};

// Frozen — stable across requests so the prompt cache stays warm. Any change here
// invalidates the cache for every following request, so resist the urge to interpolate.
const SYSTEM_PROMPT_DESIGN_RULES = `You are landing-forge, an opinionated landing-page designer for orqis.

Your output is one self-contained HTML document. No external CSS, no external JS, no build step. Tailwind via the CDN script tag is the only allowed external dependency.

DESIGN RULES (apply every time, no exceptions):
1. Dark mode only. Background: near-black (#07070b or similar). High-contrast type. Soft radial gradients in the brand color for depth.
2. Single-column, hero-first. The hero must communicate value in under 7 words and include exactly one primary CTA.
3. Sections (in order): hero → 3-tile feature grid → social-proof slot (placeholder logos as muted text) → secondary CTA → footer with one link.
4. Typography: system font stack (ui-sans-serif, system-ui). Use generous line-height (1.4-1.6) and tight tracking on display headings (-0.025em).
5. Use the user's primaryColor (or default #6366f1) for accents only — buttons, highlights, gradient stops. Never as a flat background.
6. Responsive by default. Mobile breakpoint at sm: (640px). Test mentally: does it work at 375px wide?
7. Add subtle motion: a single CSS-only fade-in on the hero. No JS animation libraries.
8. Accessibility: every interactive element has visible focus state. Color contrast meets WCAG AA. Alt text on every image (or aria-hidden when decorative).
9. Output a complete <!doctype html> document with <html lang="en">, <head> with title + meta description + viewport, and <body>. Include the Tailwind CDN: <script src="https://cdn.tailwindcss.com"></script>. Inline a tiny config block setting darkMode: "class" and the brand color.
10. NEVER include placeholder lorem ipsum text. Use real, specific copy derived from the product brief.

DO NOT:
- Use sliders, carousels, or any interactive widget that needs JS.
- Reference images by URL — use CSS gradients + emoji + iconography only (sites tested without internet must still render).
- Add cookie banners, GDPR notices, or analytics scripts.
- Use Tailwind arbitrary values like \`text-[#ff0000]\` more than three times — prefer the palette.

EXAMPLE GOOD HEROES (study the structure, don't copy verbatim):
- "Issue tracking, finally fast." (Linear)
- "The marketplace for specialist AI agents." (orqis itself — be different from this in your output)
- "Pitch decks built around a one-paragraph brief." (pitch-roll)

When in doubt: simpler. The best landing page is the one that loads fast and answers "what is this?" within one second of viewing.`;

const LandingPageSchema = z.object({
  html: z
    .string()
    .min(500)
    .describe(
      "Complete self-contained HTML document. Starts with <!doctype html>. Includes Tailwind via CDN."
    ),
  designNotes: z
    .array(z.string())
    .min(2)
    .max(8)
    .describe(
      "Short notes (one sentence each) explaining the key design decisions: palette, typography, hero copy choice, etc."
    ),
});

export type LandingForgeRunMode = "real" | "mock";

export function detectMode(): LandingForgeRunMode {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === "mock") return "mock";
  return "real";
}

export async function runLandingForge(
  input: LandingForgeInput
): Promise<LandingForgeResult> {
  if (detectMode() === "mock") {
    return runMock(input);
  }
  return runReal(input);
}

// ----------------- mock -----------------

function runMock(input: LandingForgeInput): LandingForgeResult {
  const accent = input.primaryColor ?? "#6366f1";
  const features = (input.features?.length ? input.features : ["Fast", "Honest", "Yours"]).slice(0, 3);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(input.productName)}</title>
<meta name="description" content="${escape(input.oneLiner)}">
<script src="https://cdn.tailwindcss.com"></script>
<style>
  :root { color-scheme: dark; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .fade-up { animation: fadeUp .6s ease-out both; }
</style>
</head>
<body class="bg-[#07070b] text-zinc-100 min-h-screen antialiased font-[ui-sans-serif,system-ui]">
  <main class="relative isolate overflow-hidden">
    <div aria-hidden class="absolute inset-0 -z-10" style="background: radial-gradient(700px 320px at 50% 0%, ${accent}40, transparent 60%);"></div>
    <section class="mx-auto max-w-3xl px-6 pt-24 pb-16 text-center fade-up">
      <h1 class="text-5xl sm:text-6xl font-semibold tracking-[-0.025em] leading-[1.05]">${escape(input.productName)}</h1>
      <p class="mt-6 text-lg text-zinc-300 max-w-xl mx-auto">${escape(input.oneLiner)}</p>
      <a href="#cta" class="mt-10 inline-flex items-center gap-2 h-12 px-6 rounded-full font-medium text-white" style="background: ${accent};">Get early access →</a>
    </section>
    <section class="mx-auto max-w-5xl px-6 pb-24 grid gap-4 sm:grid-cols-3">
      ${features
        .map(
          (f) => `<div class="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style="background: ${accent}25; color: ${accent};">✦</div>
        <p class="mt-4 text-base font-medium">${escape(f)}</p>
      </div>`
        )
        .join("\n      ")}
    </section>
    <section id="cta" class="mx-auto max-w-3xl px-6 pb-24 text-center">
      <p class="text-zinc-400 text-sm uppercase tracking-[0.18em]">Trusted by serious people at</p>
      <p class="mt-3 text-zinc-500 font-mono">acme · linear · vercel · stripe</p>
      <a href="#" class="mt-10 inline-flex items-center gap-2 h-12 px-6 rounded-full font-medium text-white" style="background: ${accent};">Sign up — it's free</a>
    </section>
    <footer class="border-t border-white/10 py-8 text-center text-zinc-500 text-xs">
      <a href="#" class="hover:text-zinc-300 transition-colors">contact</a>
    </footer>
  </main>
</body>
</html>`;
  return {
    html,
    designNotes: [
      "Mock-mode output — set ANTHROPIC_API_KEY to a real key to enable claude-sonnet-4-6.",
      `Used ${input.primaryColor ?? "default indigo"} as the accent color.`,
      `Highlighted ${features.length} features in the grid.`,
    ],
    modelUsed: "mock",
  };
}

// ----------------- real -----------------

async function runReal(input: LandingForgeInput): Promise<LandingForgeResult> {
  const client = new Anthropic();

  const userBrief = [
    `Product name: ${input.productName}`,
    `One-liner: ${input.oneLiner}`,
    input.audience ? `Audience: ${input.audience}` : null,
    input.features?.length
      ? `Features (use 3-5): ${input.features.slice(0, 5).join(" | ")}`
      : null,
    input.tone ? `Tone: ${input.tone}` : null,
    input.primaryColor ? `Primary color (hex): ${input.primaryColor}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Use messages.parse() — validates the response against the Zod schema and returns parsed_output.
  // System prompt is sent as a structured array so we can attach cache_control to the last block.
  const response = await client.messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: zodOutputFormat(LandingPageSchema),
    },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT_DESIGN_RULES,
        // Prefix-cached: any byte change to SYSTEM_PROMPT_DESIGN_RULES invalidates this entry.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Build me the landing page. Brief follows.\n\n${userBrief}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `landing-forge: model returned a response that did not validate against the schema (stop_reason=${response.stop_reason}).`
    );
  }

  return {
    html: parsed.html,
    designNotes: parsed.designNotes,
    modelUsed: "claude-sonnet-4-6",
    cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
  };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
