/**
 * gpt-chat — dual-mode OpenAI chat-completion agent. Same shape as claude-chat.
 *
 * Modes:
 *   1. BYO-key (input.apiKey present) → caller's key. 1-credit routing fee.
 *   2. Managed (OPENAI_API_KEY set, no input.apiKey) → orqis's key. Full price.
 *   3. Mock — canned response.
 */

import OpenAI from "openai";

export type GptChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type GptChatInput = {
  messages: GptChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
};

export type GptChatResult = {
  text: string;
  model: string;
  mode: "byok" | "managed" | "mock";
  finishReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
};

const DEFAULT_MODEL = "gpt-4o-mini";
// Keep the allowlist permissive — OpenAI model strings change fast and we
// don't want to gate behind a stale enum. Validate only that it's a string
// that looks like a model id.
const MODEL_RE = /^[a-zA-Z0-9._-]{2,64}$/;

export type GptChatMode = "byok" | "managed" | "mock";

export function detectMode(input: GptChatInput): GptChatMode {
  if (input.apiKey && input.apiKey.trim()) return "byok";
  if (process.env.OPENAI_API_KEY) return "managed";
  return "mock";
}

function validate(input: GptChatInput): { messages: GptChatMessage[]; model: string; maxTokens: number; temperature: number } {
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new Error("messages is required (non-empty array of {role, content})");
  }
  if (input.messages.length > 64) {
    throw new Error(`too many messages: ${input.messages.length} (max 64)`);
  }
  const messages = input.messages.map((m, i) => {
    if (!m || (m.role !== "user" && m.role !== "assistant" && m.role !== "system")) {
      throw new Error(`messages[${i}].role must be 'user' | 'assistant' | 'system'`);
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
  if (!MODEL_RE.test(model)) {
    throw new Error(`model must match ${MODEL_RE.source}`);
  }
  const maxTokens = Math.max(1, Math.min(8192, Math.floor(input.maxTokens ?? 1024)));
  const temperature = clamp(input.temperature ?? 1, 0, 2);
  return { messages, model, maxTokens, temperature };
}

async function runReal(input: GptChatInput, apiKey: string, mode: "byok" | "managed"): Promise<GptChatResult> {
  const startedAt = Date.now();
  const { messages, model, maxTokens, temperature } = validate(input);
  const client = new OpenAI({ apiKey });
  const res = await client.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  });
  const choice = res.choices[0];
  return {
    text: choice?.message?.content ?? "",
    model: res.model,
    mode,
    finishReason: choice?.finish_reason ?? null,
    usage: {
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    },
    durationMs: Date.now() - startedAt,
  };
}

async function runMock(input: GptChatInput): Promise<GptChatResult> {
  const startedAt = Date.now();
  const { messages, model } = validate(input);
  await new Promise((r) => setTimeout(r, 60));
  const last = messages[messages.length - 1].content.slice(0, 120);
  return {
    text: `[gpt-chat mock] You asked: "${last}". Set OPENAI_API_KEY (or pass apiKey in the request) to get a real GPT response.`,
    model,
    mode: "mock",
    finishReason: "stop",
    usage: { inputTokens: 0, outputTokens: 0 },
    durationMs: Date.now() - startedAt,
  };
}

export async function runGptChat(input: GptChatInput): Promise<GptChatResult> {
  const mode = detectMode(input);
  if (mode === "mock") return runMock(input);
  const apiKey = mode === "byok" ? input.apiKey!.trim() : process.env.OPENAI_API_KEY!;
  return runReal(input, apiKey, mode);
}

function clamp(n: unknown, lo: number, hi: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
