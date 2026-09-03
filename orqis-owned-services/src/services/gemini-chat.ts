/**
 * gemini-chat — dual-mode Google Gemini chat-completion agent.
 *
 * Modes match claude-chat / gpt-chat:
 *   1. BYO-key (input.apiKey) → caller's key, 1-credit routing fee.
 *   2. Managed (GEMINI_API_KEY set) → orqis's key, full price.
 *   3. Mock — canned response.
 *
 * Gemini's chat input uses a `contents` array with `parts[]` per turn rather
 * than OpenAI's flat `messages`. We translate from the standard messages
 * shape on the way in so callers can use the same payload across all three
 * chat agents.
 */

import { GoogleGenAI } from "@google/genai";

export type GeminiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GeminiChatInput = {
  messages: GeminiChatMessage[];
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
};

export type GeminiChatResult = {
  text: string;
  model: string;
  mode: "byok" | "managed" | "mock";
  finishReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
};

const DEFAULT_MODEL = "gemini-2.5-flash";
const MODEL_RE = /^gemini-[a-z0-9.-]{2,64}$/;

export type GeminiChatMode = "byok" | "managed" | "mock";

export function detectMode(input: GeminiChatInput): GeminiChatMode {
  if (input.apiKey && input.apiKey.trim()) return "byok";
  if (process.env.GEMINI_API_KEY) return "managed";
  return "mock";
}

function validate(input: GeminiChatInput): { messages: GeminiChatMessage[]; model: string; maxTokens: number; temperature: number } {
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
  if (!MODEL_RE.test(model)) {
    throw new Error(`model must match ${MODEL_RE.source}`);
  }
  const maxTokens = Math.max(1, Math.min(8192, Math.floor(input.maxTokens ?? 1024)));
  const temperature = clamp(input.temperature ?? 1, 0, 2);
  return { messages, model, maxTokens, temperature };
}

async function runReal(input: GeminiChatInput, apiKey: string, mode: "byok" | "managed"): Promise<GeminiChatResult> {
  const startedAt = Date.now();
  const { messages, model, maxTokens, temperature } = validate(input);
  const ai = new GoogleGenAI({ apiKey });
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await ai.models.generateContent({
    model,
    contents,
    config: {
      maxOutputTokens: maxTokens,
      temperature,
      systemInstruction: input.systemPrompt,
    },
  });
  // SDK shapes vary across versions — guard each field.
  const text = (res as { text?: string }).text ?? "";
  const usage = (res as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata ?? {};
  const finishReason =
    (res as { candidates?: { finishReason?: string }[] }).candidates?.[0]?.finishReason ?? null;
  return {
    text,
    model,
    mode,
    finishReason,
    usage: {
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
    },
    durationMs: Date.now() - startedAt,
  };
}

async function runMock(input: GeminiChatInput): Promise<GeminiChatResult> {
  const startedAt = Date.now();
  const { messages, model } = validate(input);
  await new Promise((r) => setTimeout(r, 60));
  const last = messages[messages.length - 1].content.slice(0, 120);
  return {
    text: `[gemini-chat mock] You asked: "${last}". Set GEMINI_API_KEY (or pass apiKey in the request) to get a real Gemini response.`,
    model,
    mode: "mock",
    finishReason: "STOP",
    usage: { inputTokens: 0, outputTokens: 0 },
    durationMs: Date.now() - startedAt,
  };
}

export async function runGeminiChat(input: GeminiChatInput): Promise<GeminiChatResult> {
  const mode = detectMode(input);
  if (mode === "mock") return runMock(input);
  const apiKey = mode === "byok" ? input.apiKey!.trim() : process.env.GEMINI_API_KEY!;
  return runReal(input, apiKey, mode);
}

function clamp(n: unknown, lo: number, hi: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
