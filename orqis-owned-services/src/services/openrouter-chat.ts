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
  // Ordered by observed availability on 2026-09-03 — the fallback chain walks
  // this list in order, so the ones that actually answer come first.
  { slug: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning", vendor: "NVIDIA", contextTokens: 1_000_000 },
  { slug: "minimax/minimax-m2.7:free", label: "MiniMax M2.7", vendor: "MiniMax", contextTokens: 196_608 },
  { slug: "poolside/laguna-s-2.1:free", label: "Laguna S 2.1", vendor: "Poolside", contextTokens: 262_144 },
  { slug: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B", vendor: "NVIDIA", contextTokens: 262_144 },
  { slug: "z-ai/glm-5.2:free", label: "GLM 5.2", vendor: "Z.ai", contextTokens: 256_000 },
  { slug: "google/gemma-4-31b-it:free", label: "Gemma 4 31B", vendor: "Google", contextTokens: 262_144 },
  { slug: "inclusionai/ling-3.0-flash-fin:free", label: "Ling 3.0 Flash", vendor: "InclusionAI", contextTokens: 262_144 },
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

// Per-attempt ceiling, and how many models the fallback chain may try.
// The invocation proxy gives the whole call 30s, so the worst case here
// (MAX_ATTEMPTS x ATTEMPT_TIMEOUT_MS) has to stay comfortably under that or a
// rate-limited first choice burns the budget before a working model is
// reached. Measured: successful free-model calls return in 1.5-4s.
const ATTEMPT_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 3;
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
    timeout: ATTEMPT_TIMEOUT_MS,
    maxRetries: 0, // the fallback chain is the retry strategy
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
  // OpenRouter reports upstream provider failures as HTTP 200 with an `error`
  // field in the body, not as an HTTP error status — so the OpenAI SDK never
  // throws. Left unchecked, a rate-limited free model returns an empty string
  // that looks like a successful call, and the buyer is charged for nothing.
  // Throwing here surfaces it as a 502, which the invocation proxy refunds.
  const upstreamError = (res as unknown as { error?: { message?: string; code?: number } }).error;
  if (upstreamError) {
    throw new Error(
      `OpenRouter upstream error${upstreamError.code ? ` (${upstreamError.code})` : ""}: ` +
        `${upstreamError.message ?? "unknown"}. Model: ${model}.`
    );
  }

  const choice = res.choices?.[0];
  const content = choice?.message?.content ?? "";
  if (!content) {
    // No content and no error field. Most often a free model that hit its
    // per-account rate limit, or one whose entire token budget went to
    // reasoning. Either way the buyer got nothing, so don't bill for it.
    throw new Error(
      `OpenRouter returned an empty completion for ${model} ` +
        `(finish_reason: ${choice?.finish_reason ?? "none"}). ` +
        "Free models are rate-limited per account — retry shortly."
    );
  }

  const usage = res.usage as (typeof res.usage & { cost?: number }) | undefined;
  return {
    text: content,
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

/**
 * Candidate models to try, in order.
 *
 * Free models on OpenRouter are rate-limited per account and share capacity
 * across everyone using them, so any single one 429s or 502s unpredictably —
 * measured on 2026-09-03, only 3 of the 8 answered on a given pass, and a
 * different 3 a minute earlier. A hard default therefore fails often enough
 * to wreck a demo.
 *
 * So when the caller *didn't* pin a model we treat the listing's default as a
 * preference, not a requirement, and fall through the rest of its allowlist.
 * When the caller *did* pin one we honour it exactly and let it fail — asking
 * for GLM and silently getting Nemotron would be worse than an error.
 */
function candidateModels(input: OpenRouterChatInput, listing: OpenRouterListing): string[] {
  if (input.model) return [input.model];
  const allowed = listing.allowedModels ?? budgetModelSlugs();
  return [listing.defaultModel, ...allowed.filter((m) => m !== listing.defaultModel)];
}

export async function runOpenRouterChat(
  input: OpenRouterChatInput,
  listing: OpenRouterListing
): Promise<OpenRouterChatResult> {
  const mode = detectMode(input);
  if (mode === "mock") return runMock(input, listing);
  const apiKey = mode === "byok" ? input.apiKey!.trim() : process.env.OPENROUTER_API_KEY!;

  const candidates = candidateModels(input, listing).slice(0, MAX_ATTEMPTS);
  let lastError: unknown;

  for (const model of candidates) {
    try {
      return await runReal({ ...input, model }, listing, apiKey, mode);
    } catch (err) {
      // A ValidationError means the request itself is wrong — a bad role, an
      // off-allowlist model. Retrying a different model would turn a clear
      // 400 into a confusing one, so stop immediately.
      if (err instanceof ValidationError) throw err;
      lastError = err;
    }
  }

  throw new Error(
    `All ${candidates.length} model(s) failed for ${listing.agent}. ` +
      `Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

function clamp(n: unknown, lo: number, hi: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
