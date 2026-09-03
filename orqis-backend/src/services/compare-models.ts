/**
 * compare-models — fan one prompt out to Claude + GPT + Gemini in parallel,
 * return side-by-side outputs + latencies. The "race" agent.
 *
 * Designed as a managed-only agent (no BYO key — three keys would be
 * confusing). Each provider runs on its own default fast model; callers
 * can override per-provider via the `models` map.
 *
 * Per-provider failures don't fail the call; the failing slot just shows
 * an error in its `text` field. Caller can act on whichever providers
 * succeeded.
 */

import { runClaudeChat } from "./claude-chat.js";
import { runGptChat } from "./gpt-chat.js";
import { runGeminiChat } from "./gemini-chat.js";

export type CompareModelsProvider = "claude" | "gpt" | "gemini";

export type CompareModelsInput = {
  prompt: string;
  providers?: CompareModelsProvider[];
  models?: Partial<Record<CompareModelsProvider, string>>;
  systemPrompt?: string;
  maxTokens?: number;
};

export type CompareModelsAnswer = {
  provider: CompareModelsProvider;
  text: string;
  model: string;
  mode: "managed" | "mock";
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
};

export type CompareModelsResult = {
  prompt: string;
  answers: CompareModelsAnswer[];
  fastest: CompareModelsProvider | null;
  durationMs: number;
};

const DEFAULT_PROVIDERS: CompareModelsProvider[] = ["claude", "gpt", "gemini"];
const DEFAULT_MODELS: Record<CompareModelsProvider, string> = {
  claude: "claude-haiku-4-5-20251001",
  gpt: "gpt-4o-mini",
  gemini: "gemini-2.5-flash",
};

function validate(input: CompareModelsInput): {
  prompt: string;
  providers: CompareModelsProvider[];
  models: Record<CompareModelsProvider, string>;
  systemPrompt: string | undefined;
  maxTokens: number;
} {
  if (!input.prompt || typeof input.prompt !== "string") {
    throw new Error("prompt is required");
  }
  if (input.prompt.length > 50_000) {
    throw new Error(`prompt too long: ${input.prompt.length} chars (max 50k)`);
  }
  const providers = (input.providers ?? DEFAULT_PROVIDERS).filter((p) =>
    DEFAULT_PROVIDERS.includes(p)
  );
  if (providers.length === 0) {
    throw new Error("providers must include at least one of: claude, gpt, gemini");
  }
  const models = { ...DEFAULT_MODELS, ...(input.models ?? {}) };
  const maxTokens = Math.max(1, Math.min(4096, Math.floor(input.maxTokens ?? 512)));
  return {
    prompt: input.prompt,
    providers,
    models,
    systemPrompt: input.systemPrompt,
    maxTokens,
  };
}

async function callProvider(
  provider: CompareModelsProvider,
  prompt: string,
  model: string,
  systemPrompt: string | undefined,
  maxTokens: number
): Promise<CompareModelsAnswer> {
  const startedAt = Date.now();
  try {
    if (provider === "claude") {
      const r = await runClaudeChat({
        messages: [{ role: "user", content: prompt }],
        model,
        systemPrompt,
        maxTokens,
      });
      return {
        provider,
        text: r.text,
        model: r.model,
        mode: r.mode === "mock" ? "mock" : "managed",
        inputTokens: r.usage.inputTokens,
        outputTokens: r.usage.outputTokens,
        durationMs: r.durationMs,
        ok: true,
        error: null,
      };
    }
    if (provider === "gpt") {
      const messages: { role: "system" | "user"; content: string }[] = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: prompt });
      const r = await runGptChat({ messages, model, maxTokens });
      return {
        provider,
        text: r.text,
        model: r.model,
        mode: r.mode === "mock" ? "mock" : "managed",
        inputTokens: r.usage.inputTokens,
        outputTokens: r.usage.outputTokens,
        durationMs: r.durationMs,
        ok: true,
        error: null,
      };
    }
    // gemini
    const r = await runGeminiChat({
      messages: [{ role: "user", content: prompt }],
      model,
      systemPrompt,
      maxTokens,
    });
    return {
      provider,
      text: r.text,
      model: r.model,
      mode: r.mode === "mock" ? "mock" : "managed",
      inputTokens: r.usage.inputTokens,
      outputTokens: r.usage.outputTokens,
      durationMs: r.durationMs,
      ok: true,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return {
      provider,
      text: "",
      model: model,
      mode: "managed",
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - startedAt,
      ok: false,
      error: msg.slice(0, 500),
    };
  }
}

export async function runCompareModels(input: CompareModelsInput): Promise<CompareModelsResult> {
  const startedAt = Date.now();
  const { prompt, providers, models, systemPrompt, maxTokens } = validate(input);

  const answers = await Promise.all(
    providers.map((p) => callProvider(p, prompt, models[p], systemPrompt, maxTokens))
  );

  const successful = answers.filter((a) => a.ok);
  const fastest = successful.length
    ? successful.reduce((best, cur) => (cur.durationMs < best.durationMs ? cur : best)).provider
    : null;

  return {
    prompt,
    answers,
    fastest,
    durationMs: Date.now() - startedAt,
  };
}
