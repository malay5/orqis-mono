/**
 * text-summarize — summarize any text into a target word count.
 *
 * Product wrapper: uses Claude Haiku internally for speed + cost. Buyer pays
 * a flat orqis-credit price regardless of upstream tokens — we eat the
 * variability. Choose Haiku because it's the cheapest Claude tier; for prose
 * summarisation the quality gap vs Sonnet is small.
 *
 * Mock falls back to a heuristic extractive summariser (first / middle / last
 * sentence sample) so the pipeline runs without any LLM key set.
 */

import Anthropic from "@anthropic-ai/sdk";

export type TextSummarizeInput = {
  text: string;
  maxWords?: number;
  style?: "neutral" | "executive" | "bulleted" | "casual";
};

export type TextSummarizeResult = {
  summary: string;
  wordCount: number;
  style: string;
  mode: "managed" | "mock";
  modelUsed: string;
  inputChars: number;
  durationMs: number;
};

const MODEL = "claude-haiku-4-5-20251001";

export type TextSummarizeMode = "managed" | "mock";

export function detectMode(): TextSummarizeMode {
  return process.env.ANTHROPIC_API_KEY ? "managed" : "mock";
}

function validate(input: TextSummarizeInput): { text: string; maxWords: number; style: string } {
  if (!input.text || typeof input.text !== "string") {
    throw new Error("text is required");
  }
  if (input.text.length > 200_000) {
    throw new Error(`text too long: ${input.text.length} chars (max 200k)`);
  }
  const maxWords = Math.max(20, Math.min(800, Math.floor(input.maxWords ?? 120)));
  const style = input.style ?? "neutral";
  if (!["neutral", "executive", "bulleted", "casual"].includes(style)) {
    throw new Error("style must be one of: neutral, executive, bulleted, casual");
  }
  return { text: input.text, maxWords, style };
}

const STYLE_PROMPTS: Record<string, string> = {
  neutral: "Produce a clear, neutral-tone summary.",
  executive: "Produce an executive summary: lead with the headline takeaway in one sentence, then 2-4 supporting bullets, then any risks or open questions.",
  bulleted: "Produce a bulleted summary. Each bullet is a single sentence. No prose preamble.",
  casual: "Produce a casual, conversational summary like you're explaining it to a friend.",
};

async function runReal(input: TextSummarizeInput): Promise<TextSummarizeResult> {
  const startedAt = Date.now();
  const { text, maxWords, style } = validate(input);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: Math.max(256, maxWords * 4),
    system: `You summarise text concisely. ${STYLE_PROMPTS[style]} Aim for ${maxWords} words or fewer. Do not invent facts.`,
    messages: [{ role: "user", content: text }],
  });
  const block = res.content.find((b) => b.type === "text");
  const summary = (block && "text" in block ? block.text : "").trim();
  return {
    summary,
    wordCount: summary.split(/\s+/).filter(Boolean).length,
    style,
    mode: "managed",
    modelUsed: res.model,
    inputChars: text.length,
    durationMs: Date.now() - startedAt,
  };
}

async function runMock(input: TextSummarizeInput): Promise<TextSummarizeResult> {
  const startedAt = Date.now();
  const { text, maxWords, style } = validate(input);
  // Crude extractive heuristic: split into sentences, pick a few, join.
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 12);
  const picks: string[] = [];
  if (sentences.length > 0) picks.push(sentences[0]);
  if (sentences.length > 6) picks.push(sentences[Math.floor(sentences.length / 2)]);
  if (sentences.length > 2) picks.push(sentences[sentences.length - 1]);
  let summary = picks.join(" ");
  if (style === "bulleted") summary = "• " + picks.join("\n• ");
  if (style === "executive") summary = `${picks[0]}\n\n• ${picks.slice(1).join("\n• ")}`;
  const words = summary.split(/\s+/);
  if (words.length > maxWords) summary = words.slice(0, maxWords).join(" ") + "…";
  return {
    summary: `${summary}\n\n[mock-mode extractive summary. Set ANTHROPIC_API_KEY for a real LLM summary.]`,
    wordCount: summary.split(/\s+/).filter(Boolean).length,
    style,
    mode: "mock",
    modelUsed: "mock-extractive",
    inputChars: text.length,
    durationMs: Date.now() - startedAt,
  };
}

export async function runTextSummarize(input: TextSummarizeInput): Promise<TextSummarizeResult> {
  return detectMode() === "managed" ? runReal(input) : runMock(input);
}
