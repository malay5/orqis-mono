/**
 * code-explain — explain a code block at a chosen depth and audience.
 *
 * Product wrapper: Claude Sonnet internally. Default audience is
 * "intermediate developer who knows the language but not this codebase";
 * other audiences (`beginner`, `senior`, `tech-lead`) re-shape the
 * explanation accordingly.
 */

import Anthropic from "@anthropic-ai/sdk";

export type CodeExplainAudience = "beginner" | "intermediate" | "senior" | "tech-lead";

export type CodeExplainInput = {
  code: string;
  language?: string; // free-form: "typescript", "rust", "go", "python", etc.
  audience?: CodeExplainAudience;
  focusOn?: string; // optional: "performance", "security", "readability", "this function only"
};

export type CodeExplainResult = {
  explanation: string;
  bullets: string[];
  language: string;
  audience: CodeExplainAudience;
  mode: "managed" | "mock";
  modelUsed: string;
  durationMs: number;
};

const MODEL = "claude-sonnet-4-6";

const AUDIENCE_PROMPTS: Record<CodeExplainAudience, string> = {
  beginner: "Explain like the reader has been programming for a few months. Define jargon. Show what's happening line by line where useful.",
  intermediate: "Explain to a developer who knows the language but not this codebase. Lead with what it does, then how, then any surprising choices.",
  senior: "Explain to a senior engineer. Lead with the architectural shape and the trade-offs that shape it. Skip basics.",
  "tech-lead": "Explain to a tech lead reviewing this code. Lead with risks, edge cases, and 'I would not merge this if...' Then the design.",
};

export type CodeExplainMode = "managed" | "mock";

export function detectMode(): CodeExplainMode {
  return process.env.ANTHROPIC_API_KEY ? "managed" : "mock";
}

function validate(input: CodeExplainInput): { code: string; language: string; audience: CodeExplainAudience; focusOn: string | undefined } {
  if (!input.code || typeof input.code !== "string") {
    throw new Error("code is required");
  }
  if (input.code.length > 60_000) {
    throw new Error(`code too long: ${input.code.length} chars (max 60k)`);
  }
  const language = input.language?.trim() || "unspecified";
  if (language.length > 32) {
    throw new Error("language must be 32 chars or fewer");
  }
  const audience = input.audience ?? "intermediate";
  if (!AUDIENCE_PROMPTS[audience]) {
    throw new Error(`audience must be one of: ${Object.keys(AUDIENCE_PROMPTS).join(", ")}`);
  }
  const focusOn = input.focusOn?.trim() || undefined;
  if (focusOn && focusOn.length > 200) {
    throw new Error("focusOn must be 200 chars or fewer");
  }
  return { code: input.code, language, audience, focusOn };
}

async function runReal(input: CodeExplainInput): Promise<CodeExplainResult> {
  const startedAt = Date.now();
  const { code, language, audience, focusOn } = validate(input);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const system = [
    `You explain code clearly.`,
    AUDIENCE_PROMPTS[audience],
    focusOn ? `Focus on: ${focusOn}.` : null,
    `Return your response as JSON with two fields: {"explanation": "...prose...", "bullets": ["...", "..."]}. The "bullets" field captures the 3-7 most important takeaways. No preamble, no markdown fences.`,
  ].filter(Boolean).join(" ");
  const userMsg = `Language: ${language}\n\n\`\`\`${language === "unspecified" ? "" : language}\n${code}\n\`\`\``;
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userMsg }],
  });
  const block = res.content.find((b) => b.type === "text");
  const raw = (block && "text" in block ? block.text : "").trim();
  let parsed: { explanation?: string; bullets?: string[] } = {};
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    parsed = { explanation: raw, bullets: [] };
  }
  return {
    explanation: parsed.explanation ?? "",
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 10) : [],
    language,
    audience,
    mode: "managed",
    modelUsed: res.model,
    durationMs: Date.now() - startedAt,
  };
}

async function runMock(input: CodeExplainInput): Promise<CodeExplainResult> {
  const startedAt = Date.now();
  const { code, language, audience } = validate(input);
  const lines = code.split("\n").length;
  return {
    explanation: `[code-explain mock] This is ${lines}-line ${language} code, explained for a ${audience} audience. Set ANTHROPIC_API_KEY to get a real LLM explanation tailored to the snippet.`,
    bullets: [
      `Code is ${lines} lines of ${language}.`,
      `Audience requested: ${audience}.`,
      "Mock mode does not analyse the code — set ANTHROPIC_API_KEY for the real explanation.",
    ],
    language,
    audience,
    mode: "mock",
    modelUsed: "mock",
    durationMs: Date.now() - startedAt,
  };
}

export async function runCodeExplain(input: CodeExplainInput): Promise<CodeExplainResult> {
  return detectMode() === "managed" ? runReal(input) : runMock(input);
}
