import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import {
  detectMode as detectTexMode,
  runTexPress,
  type TexPressInput,
} from "../../services/tex-press.js";
import {
  detectMode as detectPandocMode,
  runDocConverter,
  type DocConverterInput,
  type DocFormat,
} from "../../services/doc-converter.js";
import {
  detectMode as detectBgMode,
  runBgStrip,
  type BgStripInput,
} from "../../services/bg-strip.js";
import {
  detectMode as detectWhisperMode,
  runSubtitleBot,
  type SubtitleBotInput,
} from "../../services/subtitle-bot.js";
import {
  runLater,
  webhookContextFromHeaders,
  webhookFailure,
  webhookSuccess,
} from "../../lib/async-runner.js";
import { statusForThrown } from "../../lib/errors.js";

export type TierBRoutesOpts = {
  storageDir: string;
  publicBaseUrl: string;
};

const MAX_BODY_BYTES = 30 * 1024 * 1024;

// Legacy validation-message regex — fallback for services that still throw
// plain Error for input issues. ValidationError is the typed path.
const VALIDATION_PATTERN =
  /required|invalid|too large|too long|too many|unsafe|unsupported|must be|not present in files|did not return|response missing|Either |Pass only one/;

async function writeArtifact(opts: TierBRoutesOpts, ext: string, buf: Buffer | string): Promise<string> {
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  const fileName = `${id}.${ext}`;
  const filePath = path.join(opts.storageDir, fileName);
  await fs.mkdir(opts.storageDir, { recursive: true });
  await fs.writeFile(filePath, buf);
  return `${opts.publicBaseUrl.replace(/\/$/, "")}/r/${fileName}`;
}

const VALID_DOC_FORMATS: DocFormat[] = ["md", "html", "docx", "epub", "latex", "rst", "org", "plaintext"];

export function makeTierBRoutes(opts: TierBRoutesOpts): FastifyPluginAsync {
  return async (app) => {
    // ---------- tex-press ----------
    app.get("/agents/tex-press", async () => ({
      name: "tex-press",
      kind: "utility",
      version: "0.14.0",
      mode: detectTexMode(),
      doc: "POST /v1/agents/tex-press/run with { files: [{ name, contentBase64 }], entrypoint? }",
    }));
    app.post(
      "/agents/tex-press/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: TexPressInput = {
          files: Array.isArray(body.files) ? (body.files as TexPressInput["files"]) : [],
          entrypoint: typeof body.entrypoint === "string" ? body.entrypoint : undefined,
        };
        try {
          const result = await runTexPress(input);
          const previewUrl = await writeArtifact(opts, "pdf", result.pdfBuffer);
          return {
            previewUrl,
            downloadUrl: previewUrl,
            pdfBytes: result.pdfBytes,
            pageCount: result.pageCount,
            filesUsed: result.filesUsed,
            entrypoint: result.entrypoint,
            engineUsed: result.engineUsed,
            durationMs: result.durationMs,
          };
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "tex-press failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- doc-converter ----------
    app.get("/agents/doc-converter", async () => ({
      name: "doc-converter",
      kind: "utility",
      version: "0.14.0",
      mode: detectPandocMode(),
      doc: "POST /v1/agents/doc-converter/run with { from, to, content, base64? }",
    }));
    app.post(
      "/agents/doc-converter/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const from = body.from as DocFormat;
        const to = body.to as DocFormat;
        if (!VALID_DOC_FORMATS.includes(from)) {
          return reply.code(400).send({ error: `from must be one of: ${VALID_DOC_FORMATS.join(", ")}` });
        }
        if (!VALID_DOC_FORMATS.includes(to)) {
          return reply.code(400).send({ error: `to must be one of: ${VALID_DOC_FORMATS.join(", ")}` });
        }
        const input: DocConverterInput = {
          from,
          to,
          content: typeof body.content === "string" ? body.content : "",
          base64: body.base64 === true,
        };
        try {
          return await runDocConverter(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "doc-converter failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- bg-strip ----------
    app.get("/agents/bg-strip", async () => ({
      name: "bg-strip",
      kind: "utility",
      version: "0.14.0",
      mode: detectBgMode(),
      doc: "POST /v1/agents/bg-strip/run with { imageBase64, model?, fillHex? }",
    }));
    app.post(
      "/agents/bg-strip/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: BgStripInput = {
          imageBase64: typeof body.imageBase64 === "string" ? body.imageBase64 : "",
          model:
            body.model === "u2net" ||
            body.model === "u2netp" ||
            body.model === "isnet-general-use" ||
            body.model === "silueta"
              ? body.model
              : undefined,
          fillHex: typeof body.fillHex === "string" ? body.fillHex : undefined,
        };
        try {
          const result = await runBgStrip(input);
          const previewUrl = await writeArtifact(opts, "png", result.pngBuffer);
          return {
            previewUrl,
            downloadUrl: previewUrl,
            width: result.width,
            height: result.height,
            originalBytes: result.originalBytes,
            outputBytes: result.outputBytes,
            modelUsed: result.modelUsed,
            engineUsed: result.engineUsed,
            durationMs: result.durationMs,
          };
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "bg-strip failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- subtitle-bot (async) ----------
    app.get("/agents/subtitle-bot", async () => ({
      name: "subtitle-bot",
      kind: "ai-agent",
      isAsync: true,
      version: "0.14.0",
      mode: detectWhisperMode(),
      doc: "POST /v1/agents/subtitle-bot/run with { audioUrl OR audioBase64, language?, model? }. Async — result via webhook.",
    }));
    app.post(
      "/agents/subtitle-bot/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: SubtitleBotInput = {
          audioUrl: typeof body.audioUrl === "string" ? body.audioUrl.trim() : undefined,
          audioBase64: typeof body.audioBase64 === "string" ? body.audioBase64 : undefined,
          language: typeof body.language === "string" ? body.language : undefined,
          model:
            body.model === "tiny" ||
            body.model === "base" ||
            body.model === "small" ||
            body.model === "medium" ||
            body.model === "large"
              ? body.model
              : undefined,
          translateToEnglish: body.translateToEnglish === true,
        };
        if (!input.audioUrl && !input.audioBase64) {
          return reply
            .code(400)
            .send({ error: "Either audioUrl or audioBase64 is required" });
        }
        const webhook = webhookContextFromHeaders({
          "x-orqis-webhook-url": req.headers["x-orqis-webhook-url"] as string | undefined,
          "x-orqis-webhook-secret": req.headers["x-orqis-webhook-secret"] as
            | string
            | undefined,
        });
        if (!webhook) {
          return reply.code(400).send({
            error:
              "Missing X-Orqis-Webhook-Url + X-Orqis-Webhook-Secret headers. subtitle-bot is async and needs them.",
          });
        }
        runLater(async () => {
          const startedAt = Date.now();
          try {
            const result = await runSubtitleBot(input);
            await webhookSuccess(webhook, result, Date.now() - startedAt);
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "subtitle-bot: unknown failure";
            await webhookFailure(
              webhook,
              "subtitle_bot_failed",
              message,
              Date.now() - startedAt
            );
          }
        });
        return reply.code(202).send({
          accepted: true,
          mode: detectWhisperMode(),
          message:
            "subtitle-bot accepted the job. Result will be POSTed to the supplied webhook URL.",
        });
      }
    );
  };
}
