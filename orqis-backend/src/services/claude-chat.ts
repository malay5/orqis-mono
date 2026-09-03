/**
 * claude-chat — dual-mode Anthropic chat-completion agent.
 *
 * Three execution paths:
 *   1. BYO-key (input.apiKey present) → use the caller's key. 1-credit routing fee.
 *   2. Managed (ANTHROPIC_API_KEY set, no input.apiKey) → use orqis's key. Full price.
 *   3. Mock (neither) → canned response. Free in dev.
 *
 * Single-turn or multi-turn (caller provides `messages` array). Non-streaming —
 * orqis's invocation contract is JSON-in / JSON-out. Streaming is post-MVP.
 */

import Anthropic from "@anthropic-ai/sdk";

export type ClaudeChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ClaudeChatInput = {
  messages: ClaudeChatMessage[];
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string; // BYO key — never logged, never stored
};

export type ClaudeChatResult = {
  text: string;
  model: string;
  mode: "byok" | "managed" | "mock";
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
};

const DEFAULT_MODEL = "claude-sonnet-4-6";
const VALID_MODELS = new Set([
  "claude-opus-4-7", "claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001",
  "claude-haiku-4-5",
]);

export type ClaudeChatMode = "byok" | "managed" | "mock";

export function detectMode(input: ClaudeChatInput): ClaudeChatMode {
  if (input.apiKey && input.apiKey.trim()) return "byok";
  if (process.env.ANTHROPIC_API_KEY) return "managed";
  return "mock";
}

function validate(input: ClaudeChatInput): { messages: ClaudeChatMessage[]; model: string; maxTokens: number; temperature: number } {
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new Error("messages is required (non-empty array of {role, content})");
  }
  if (input.messages.length > 64) {
    throw new Error(`too many messages: ${input.messages.length} (max 64)`);
  }
  const messages = input.messages.map((m, i) => {
    if (!m || (m.role !== "user" && m.role !== "assistant")) {
      throw new Error(`messages[${i}].role must be 'user' or 'assistant'`);
    }
    if (typeof m.content !== "string" || !m.content) {
      throw new Error(`messages[${i}].content must be a non-empty string`);
    }
    if (m.content.length > 100_000) {
      throw new Error(`messages[${i}].content too long (>100k chars)`);
    }
    return { role: m.role, content: m.content };
  });
  const model = input.model ?? DEFAULT_MODEL;
  if (!VALID_MODELS.has(model)) {
    throw new Error(`model must be one of: ${Array.from(VALID_MODELS).join(", ")}`);
  }
  const maxTokens = Math.max(1, Math.min(8192, Math.floor(input.maxTokens ?? 1024)));
  const temperature = clamp(input.temperature ?? 1, 0, 1);
  return { messages, model, maxTokens, temperature };
}

async function runReal(input: ClaudeChatInput, apiKey: string, mode: "byok" | "managed"): Promise<ClaudeChatResult> {
  const startedAt = Date.now();
  const { messages, model, maxTokens, temperature } = validate(input);
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: input.systemPrompt,
    messages,
  });
  const textBlock = res.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  return {
    text,
    model: res.model,
    mode,
    stopReason: res.stop_reason ?? null,
    usage: {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    },
    durationMs: Date.now() - startedAt,
  };
}

async function runMock(input: ClaudeChatInput): Promise<ClaudeChatResult> {
  const startedAt = Date.now();
  const { messages, model } = validate(input);
  await new Promise((r) => setTimeout(r, 60));
  const last = messages[messages.length - 1].content.slice(0, 120);
  return {
    text: `[claude-chat mock] You asked: "${last}". Set ANTHROPIC_API_KEY (or pass apiKey in the request) to get a real Claude response.`,
    model,
    mode: "mock",
    stopReason: "end_turn",
    usage: { inputTokens: 0, outputTokens: 0 },
    durationMs: Date.now() - startedAt,
  };
}

export async function runClaudeChat(input: ClaudeChatInput): Promise<ClaudeChatResult> {
  const mode = detectMode(input);
  if (mode === "mock") return runMock(input);
  const apiKey = mode === "byok" ? input.apiKey!.trim() : process.env.ANTHROPIC_API_KEY!;
  return runReal(input, apiKey, mode);
}

function clamp(n: unknown, lo: number, hi: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
