/**
 * openrouter-chat — dual-mode chat completion over OpenRouter's
 * OpenAI-compatible API. One service backs several catalogue listings
 * (deepseek-chat, mimo-chat, budget-chat); each listing pins a default
 * model and, in managed mode, an allowlist so a buyer can't route a
 * 2-credit call to a frontier-priced model on orqis's key.
 *
 * Modes (same shape as gpt-chat):
 *   1. BYO-key (input.apiKey present) → caller's OpenRouter key, any model.
 *   2. Managed (OPENROUTER_API_KEY set) → orqis's key, allowlisted models only.
 *   3. Mock — canned response.
 */

import OpenAI from "openai";
import { ValidationError } from "../lib/errors.js";

export type OpenRouterChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type OpenRouterChatInput = {
  messages: OpenRouterChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
};

export type OpenRouterChatResult = {
  text: string;
  model: string;
  mode: "byok" | "managed" | "mock";
  finishReason: string | null;
  usage: { inputTokens: number; outputTokens: number; costUsd: number | null };
  durationMs: number;
};

export type OpenRouterListing = {
  /** Catalogue slug, used in mock text + error messages. */
  agent: string;
  defaultModel: string;
  /**
   * Models a managed-mode call may use. BYO-mode calls bypass this — it's
   * the buyer's own money. `undefined` means "any budget model".
   */
  allowedModels?: readonly string[];
};

export type BudgetModel = {
  slug: string;
  label: string;
  vendor: string;
  /** Approximate USD per 1M tokens (input / output) at time of listing. */
  approxPricePerM: { input: number; output: number };
};

// Curated cheap tier. Slugs follow OpenRouter's `vendor/model` form and
// can drift as providers rename releases — OPENROUTER_BUDGET_MODELS
// (comma-separated slugs) overrides this list without a redeploy.
export const BUDGET_MODELS: readonly BudgetModel[] = [
  { slug: "deepseek/deepseek-chat", label: "DeepSeek V3", vendor: "DeepSeek", approxPricePerM: { input: 0.3, output: 1.2 } },
  { slug: "deepseek/deepseek-r1", label: "DeepSeek R1 (reasoning)", vendor: "DeepSeek", approxPricePerM: { input: 0.7, output: 2.5 } },
  { slug: "xiaomi/mimo-v2-flash", label: "MiMo V2 Flash", vendor: "Xiaomi", approxPricePerM: { input: 0.1, output: 0.3 } },
  { slug: "qwen/qwen3-30b-a3b", label: "Qwen3 30B-A3B", vendor: "Alibaba", approxPricePerM: { input: 0.1, output: 0.3 } },
  { slug: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", vendor: "Meta", approxPricePerM: { input: 0.1, output: 0.3 } },
  { slug: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", vendor: "Google", approxPricePerM: { input: 0.1, output: 0.4 } },
  { slug: "moonshotai/kimi-k2", label: "Kimi K2", vendor: "Moonshot", approxPricePerM: { input: 0.6, output: 2.5 } },
  { slug: "z-ai/glm-4.5-air", label: "GLM 4.5 Air", vendor: "Zhipu", approxPricePerM: { input: 0.2, output: 1.1 } },
];

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// `vendor/model` plus optional `:variant` (OpenRouter uses `:free`,
// `:nitro`, `:thinking`, etc.).
const MODEL_RE = /^[a-z0-9-]{2,40}\/[a-zA-Z0-9._-]{2,80}(:[a-z0-9-]{1,20})?$/;

// Managed-mode ceiling is deliberately lower than gpt-chat's 8192 — output
// tokens are where a "cheap" model call stops being cheap.
const MANAGED_MAX_TOKENS = 4096;
const BYOK_MAX_TOKENS = 8192;

export type OpenRouterChatMode = "byok" | "managed" | "mock";

export function detectMode(input: OpenRouterChatInput): OpenRouterChatMode {
  if (input.apiKey && input.apiKey.trim()) return "byok";
  if (process.env.OPENROUTER_API_KEY) return "managed";
  return "mock";
}

export function budgetModelSlugs(): string[] {
  const override = process.env.OPENROUTER_BUDGET_MODELS;
  if (override && override.trim()) {
    return override.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return BUDGET_MODELS.map((m) => m.slug);
}

function validate(
  input: OpenRouterChatInput,
  listing: OpenRouterListing,
  mode: OpenRouterChatMode
): { messages: OpenRouterChatMessage[]; model: string; maxTokens: number; temperature: number } {
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new ValidationError("messages is required (non-empty array of {role, content})");
  }
  if (input.messages.length > 64) {
    throw new ValidationError(`too many messages: ${input.messages.length} (max 64)`);
  }
  const messages = input.messages.map((m, i) => {
    if (!m || (m.role !== "user" && m.role !== "assistant" && m.role !== "system")) {
      throw new ValidationError(`messages[${i}].role must be 'user' | 'assistant' | 'system'`);
    }
    if (typeof m.content !== "string" || !m.content) {
      throw new ValidationError(`messages[${i}].content must be a non-empty string`);
    }
    if (m.content.length > 100_000) {
      throw new ValidationError(`messages[${i}].content too long (>100k chars)`);
    }
    return { role: m.role, content: m.content };
  });

  const model = input.model ?? listing.defaultModel;
  if (!MODEL_RE.test(model)) {
    throw new ValidationError(`model must be an OpenRouter slug like 'vendor/model' (got '${model}')`);
  }
  if (mode === "managed") {
    const allowed = listing.allowedModels ?? budgetModelSlugs();
    if (!allowed.includes(model)) {
      throw new ValidationError(
        `model '${model}' is not in ${listing.agent}'s managed allowlist (${allowed.join(", ")}). ` +
          "Pass apiKey to use your own OpenRouter key with any model."
      );
    }
  }

  const cap = mode === "managed" ? MANAGED_MAX_TOKENS : BYOK_MAX_TOKENS;
  const maxTokens = Math.max(1, Math.min(cap, Math.floor(input.maxTokens ?? 1024)));
  const temperature = clamp(input.temperature ?? 1, 0, 2);
  return { messages, model, maxTokens, temperature };
}

async function runReal(
  input: OpenRouterChatInput,
  listing: OpenRouterListing,
  apiKey: string,
  mode: "byok" | "managed"
): Promise<OpenRouterChatResult> {
  const startedAt = Date.now();
  const { messages, model, maxTokens, temperature } = validate(input, listing, mode);
  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://orqis.xyz",
      "X-Title": `orqis ${listing.agent}`,
    },
  });
  const res = await client.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    // OpenRouter-only extension: returns the actual USD cost of the call in
    // usage.cost, which is what buyers care about on a budget listing.
    ...({ usage: { include: true } } as Record<string, unknown>),
  });
  const choice = res.choices[0];
  const usage = res.usage as (typeof res.usage & { cost?: number }) | undefined;
  return {
    text: choice?.message?.content ?? "",
    model: res.model,
    mode,
    finishReason: choice?.finish_reason ?? null,
    usage: {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      costUsd: typeof usage?.cost === "number" ? usage.cost : null,
    },
    durationMs: Date.now() - startedAt,
  };
}

async function runMock(input: OpenRouterChatInput, listing: OpenRouterListing): Promise<OpenRouterChatResult> {
  const startedAt = Date.now();
  const { messages, model } = validate(input, listing, "mock");
  await new Promise((r) => setTimeout(r, 60));
  const last = messages[messages.length - 1].content.slice(0, 120);
  return {
    text: `[${listing.agent} mock] You asked: "${last}". Set OPENROUTER_API_KEY (or pass apiKey in the request) to get a real ${model} response.`,
    model,
    mode: "mock",
    finishReason: "stop",
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    durationMs: Date.now() - startedAt,
  };
}

export async function runOpenRouterChat(
  input: OpenRouterChatInput,
  listing: OpenRouterListing
): Promise<OpenRouterChatResult> {
  const mode = detectMode(input);
  if (mode === "mock") return runMock(input, listing);
  const apiKey = mode === "byok" ? input.apiKey!.trim() : process.env.OPENROUTER_API_KEY!;
  return runReal(input, listing, apiKey, mode);
}

function clamp(n: unknown, lo: number, hi: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
