import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { runClaudeChat, type ClaudeChatInput } from "../../services/claude-chat.js";
import { runGptChat, type GptChatInput } from "../../services/gpt-chat.js";
import { runGeminiChat, type GeminiChatInput } from "../../services/gemini-chat.js";
import {
  runOpenRouterChat,
  budgetModelSlugs,
  BUDGET_MODELS,
  type OpenRouterChatInput,
  type OpenRouterListing,
} from "../../services/openrouter-chat.js";
import { runNanoBanana, type NanoBananaInput } from "../../services/nano-banana.js";
import { runTextSummarize, type TextSummarizeInput } from "../../services/text-summarize.js";
import { runEntityExtract, type EntityExtractInput } from "../../services/entity-extract.js";
import { runCodeExplain, type CodeExplainInput } from "../../services/code-explain.js";
import { runCompareModels, type CompareModelsInput, type CompareModelsProvider } from "../../services/compare-models.js";
import { statusForThrown } from "../../lib/errors.js";

export type TierDRoutesOpts = {
  storageDir: string;
  publicBaseUrl: string;
};

const MAX_BODY_BYTES = 12 * 1024 * 1024;

// Legacy fallback for plain Error services. ValidationError is the typed path.
const VALIDATION_PATTERN =
  /required|invalid|too long|too many|must be|either|preset or schema|aspectRatio|model must/i;

async function writeArtifact(opts: TierDRoutesOpts, ext: string, buf: Buffer | string): Promise<string> {
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  const fileName = `${id}.${ext}`;
  const filePath = path.join(opts.storageDir, fileName);
  await fs.mkdir(opts.storageDir, { recursive: true });
  await fs.writeFile(filePath, buf);
  return `${opts.publicBaseUrl.replace(/\/$/, "")}/r/${fileName}`;
}

function looksLikeMessages(v: unknown): v is { role: string; content: string }[] {
  return Array.isArray(v) && v.every((m) => m && typeof m === "object" && "role" in m && "content" in m);
}

// Budget-tier listings all share the OpenRouter service; each pins a default
// model and (in managed mode) which models orqis's key may be spent on.
const OPENROUTER_LISTINGS: readonly OpenRouterListing[] = [
  {
    agent: "glm-chat",
    defaultModel: "z-ai/glm-5.2:free",
    // GLM first, then two reliable stand-ins. Free models 429 constantly, and
    // an agent that errors half the time is worse than one that occasionally
    // answers on a sibling model — the response reports which one served.
    allowedModels: [
      "z-ai/glm-5.2:free",
      "minimax/minimax-m2.7:free",
      "nvidia/nemotron-3.5-lightning:free",
    ],
  },
  {
    agent: "nemotron-chat",
    defaultModel: "nvidia/nemotron-3.5-lightning:free",
    allowedModels: [
      "nvidia/nemotron-3.5-lightning:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
    ],
  },
  {
    agent: "budget-chat",
    // Nemotron, not GLM: GLM 5.2:free is the most heavily used free model on
    // OpenRouter and 429s often. The generic listing should default to
    // whichever free model answers most reliably.
    defaultModel: "nvidia/nemotron-3.5-lightning:free",
    // undefined → whatever budgetModelSlugs() returns (env-overridable)
  },
];

export function makeTierDLlmRoutes(opts: TierDRoutesOpts): FastifyPluginAsync {
  return async (app) => {
    // ---------- glm-chat / nemotron-chat / budget-chat (OpenRouter, free tier) ----------
    for (const listing of OPENROUTER_LISTINGS) {
      app.get(`/agents/${listing.agent}`, async () => ({
        name: listing.agent,
        kind: "llm-passthrough",
        version: "0.18.0",
        provider: "openrouter",
        defaultModel: listing.defaultModel,
        managedModels: listing.allowedModels ?? budgetModelSlugs(),
        budgetCatalog: BUDGET_MODELS,
        doc: `POST /v1/agents/${listing.agent}/run with { messages, model?, maxTokens?, temperature?, apiKey? (BYO OpenRouter key) }`,
      }));
      app.post(
        `/agents/${listing.agent}/run`,
        { bodyLimit: MAX_BODY_BYTES },
        async (req, reply) => {
          const body = (req.body ?? {}) as Record<string, unknown>;
          const input: OpenRouterChatInput = {
            messages: looksLikeMessages(body.messages) ? (body.messages as OpenRouterChatInput["messages"]) : [],
            model: typeof body.model === "string" ? body.model : undefined,
            maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
            temperature: typeof body.temperature === "number" ? body.temperature : undefined,
            apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
          };
          try {
            return await runOpenRouterChat(input, listing);
          } catch (err) {
            const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, `${listing.agent} failed`);
            return reply.code(code).send({ error: message });
          }
        }
      );
    }

    // ---------- claude-chat ----------
    app.get("/agents/claude-chat", async () => ({
      name: "claude-chat",
      kind: "llm-passthrough",
      version: "0.17.0",
      doc: "POST /v1/agents/claude-chat/run with { messages, model?, systemPrompt?, maxTokens?, temperature?, apiKey? (BYO) }",
    }));
    app.post(
      "/agents/claude-chat/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: ClaudeChatInput = {
          messages: looksLikeMessages(body.messages) ? (body.messages as ClaudeChatInput["messages"]) : [],
          model: typeof body.model === "string" ? body.model : undefined,
          systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : undefined,
          maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
          temperature: typeof body.temperature === "number" ? body.temperature : undefined,
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
        };
        try {
          return await runClaudeChat(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "claude-chat failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- gpt-chat ----------
    app.get("/agents/gpt-chat", async () => ({
      name: "gpt-chat",
      kind: "llm-passthrough",
      version: "0.17.0",
      doc: "POST /v1/agents/gpt-chat/run with { messages, model?, maxTokens?, temperature?, apiKey? (BYO) }",
    }));
    app.post(
      "/agents/gpt-chat/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: GptChatInput = {
          messages: looksLikeMessages(body.messages) ? (body.messages as GptChatInput["messages"]) : [],
          model: typeof body.model === "string" ? body.model : undefined,
          maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
          temperature: typeof body.temperature === "number" ? body.temperature : undefined,
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
        };
        try {
          return await runGptChat(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "gpt-chat failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- gemini-chat ----------
    app.get("/agents/gemini-chat", async () => ({
      name: "gemini-chat",
      kind: "llm-passthrough",
      version: "0.17.0",
      doc: "POST /v1/agents/gemini-chat/run with { messages, model?, systemPrompt?, maxTokens?, temperature?, apiKey? (BYO) }",
    }));
    app.post(
      "/agents/gemini-chat/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: GeminiChatInput = {
          messages: looksLikeMessages(body.messages) ? (body.messages as GeminiChatInput["messages"]) : [],
          model: typeof body.model === "string" ? body.model : undefined,
          systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : undefined,
          maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
          temperature: typeof body.temperature === "number" ? body.temperature : undefined,
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
        };
        try {
          return await runGeminiChat(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "gemini-chat failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- nano-banana ----------
    app.get("/agents/nano-banana", async () => ({
      name: "nano-banana",
      kind: "llm-passthrough",
      version: "0.17.0",
      doc: "POST /v1/agents/nano-banana/run with { prompt, aspectRatio?, apiKey? (BYO) }",
    }));
    app.post(
      "/agents/nano-banana/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: NanoBananaInput = {
          prompt: typeof body.prompt === "string" ? body.prompt : "",
          aspectRatio:
            body.aspectRatio === "1:1" || body.aspectRatio === "4:3" || body.aspectRatio === "3:4" ||
            body.aspectRatio === "16:9" || body.aspectRatio === "9:16"
              ? body.aspectRatio
              : undefined,
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
        };
        try {
          const result = await runNanoBanana(input);
          const previewUrl = await writeArtifact(opts, result.extension, result.buffer);
          return {
            previewUrl,
            downloadUrl: previewUrl,
            mode: result.mode,
            width: result.width,
            height: result.height,
            outputBytes: result.outputBytes,
            promptUsed: result.promptUsed,
            durationMs: result.durationMs,
          };
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "nano-banana failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- text-summarize ----------
    app.get("/agents/text-summarize", async () => ({
      name: "text-summarize",
      kind: "product-wrapper",
      version: "0.17.0",
      doc: "POST /v1/agents/text-summarize/run with { text, maxWords?, style? }",
    }));
    app.post(
      "/agents/text-summarize/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: TextSummarizeInput = {
          text: typeof body.text === "string" ? body.text : "",
          maxWords: typeof body.maxWords === "number" ? body.maxWords : undefined,
          style:
            body.style === "neutral" || body.style === "executive" ||
            body.style === "bulleted" || body.style === "casual"
              ? body.style
              : undefined,
        };
        try {
          return await runTextSummarize(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "text-summarize failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- entity-extract ----------
    app.get("/agents/entity-extract", async () => ({
      name: "entity-extract",
      kind: "product-wrapper",
      version: "0.17.0",
      doc: "POST /v1/agents/entity-extract/run with { text, preset? | schema? }",
    }));
    app.post(
      "/agents/entity-extract/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: EntityExtractInput = {
          text: typeof body.text === "string" ? body.text : "",
          preset: typeof body.preset === "string" ? (body.preset as EntityExtractInput["preset"]) : undefined,
          schema: body.schema && typeof body.schema === "object" ? (body.schema as Record<string, unknown>) : undefined,
        };
        try {
          return await runEntityExtract(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "entity-extract failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- code-explain ----------
    app.get("/agents/code-explain", async () => ({
      name: "code-explain",
      kind: "product-wrapper",
      version: "0.17.0",
      doc: "POST /v1/agents/code-explain/run with { code, language?, audience?, focusOn? }",
    }));
    app.post(
      "/agents/code-explain/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: CodeExplainInput = {
          code: typeof body.code === "string" ? body.code : "",
          language: typeof body.language === "string" ? body.language : undefined,
          audience:
            body.audience === "beginner" || body.audience === "intermediate" ||
            body.audience === "senior" || body.audience === "tech-lead"
              ? body.audience
              : undefined,
          focusOn: typeof body.focusOn === "string" ? body.focusOn : undefined,
        };
        try {
          return await runCodeExplain(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "code-explain failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- compare-models ----------
    app.get("/agents/compare-models", async () => ({
      name: "compare-models",
      kind: "product-wrapper",
      version: "0.17.0",
      doc: "POST /v1/agents/compare-models/run with { prompt, providers?, models?, systemPrompt?, maxTokens? }",
    }));
    app.post(
      "/agents/compare-models/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const providers = Array.isArray(body.providers)
          ? (body.providers as CompareModelsProvider[]).filter(
              (p) => p === "claude" || p === "gpt" || p === "gemini"
            )
          : undefined;
        const input: CompareModelsInput = {
          prompt: typeof body.prompt === "string" ? body.prompt : "",
          providers,
          models: body.models && typeof body.models === "object" ? (body.models as CompareModelsInput["models"]) : undefined,
          systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : undefined,
          maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
        };
        try {
          return await runCompareModels(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "compare-models failed");
          return reply.code(code).send({ error: message });
        }
      }
    );
  };
}
