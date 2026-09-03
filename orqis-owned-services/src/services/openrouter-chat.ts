/**
 * openrouter-chat — dual-mode chat completion over OpenRouter's
 * OpenAI-compatible API. One service backs several catalogue listings
 * (glm-chat, nemotron-chat, budget-chat); each listing pins a default
 * model and, in managed mode, an allowlist so a buyer can't route a
 * 1-credit call to a paid model on orqis's key.
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
  /** Context window, tokens. */
  contextTokens: number;
};

/**
 * Zero-cost tier — every entry is an OpenRouter `:free` model.
 *
 * Verified against `GET https://openrouter.ai/api/v1/models` on 2026-09-03.
 * That endpoint needs no auth, so re-checking costs nothing:
 *
 *   npm run smoke:openrouter -- --catalogue
 *
 * The previous list was written from memory and one slug was wrong —
 * `xiaomi/mimo-v2-flash` has never existed, so the agent defaulting to it
 * failed 100% of the time in managed mode. Don't add a slug here without
 * confirming it against that endpoint.
 *
 * Free models are rate-limited **per OpenRouter account**, not per key, so
 * heavy traffic can start returning 429s. The invocation proxy refunds on
 * upstream failure, so that degrades honestly rather than silently charging.
 *
 * OPENROUTER_BUDGET_MODELS (comma-separated slugs) overrides this list
 * without a redeploy.
 */
export const BUDGET_MODELS: readonly BudgetModel[] = [
  { slug: "z-ai/glm-5.2:free", label: "GLM 5.2", vendor: "Z.ai", contextTokens: 256_000 },
  { slug: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B", vendor: "NVIDIA", contextTokens: 262_144 },
  { slug: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning", vendor: "NVIDIA", contextTokens: 1_000_000 },
  { slug: "minimax/minimax-m2.7:free", label: "MiniMax M2.7", vendor: "MiniMax", contextTokens: 196_608 },
  { slug: "google/gemma-4-31b-it:free", label: "Gemma 4 31B", vendor: "Google", contextTokens: 262_144 },
  { slug: "inclusionai/ling-3.0-flash-fin:free", label: "Ling 3.0 Flash", vendor: "InclusionAI", contextTokens: 262_144 },
  { slug: "poolside/laguna-s-2.1:free", label: "Laguna S 2.1", vendor: "Poolside", contextTokens: 262_144 },
  { slug: "cohere/north-mini-code:free", label: "North Mini Code", vendor: "Cohere", contextTokens: 256_000 },
];

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// `vendor/model` plus optional `:variant` (OpenRouter uses `:free`,
// `:nitro`, `:thinking`, etc.).
const MODEL_RE = /^[a-z0-9-]{2,40}\/[a-zA-Z0-9._-]{2,80}(:[a-z0-9-]{1,20})?$/;

// Managed-mode ceiling. Lower than gpt-chat's 8192 because free models are
// rate-limited per OpenRouter *account*: a handful of long generations can
// exhaust the shared quota and 429 everyone else.
const MANAGED_MAX_TOKENS = 2048;
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
