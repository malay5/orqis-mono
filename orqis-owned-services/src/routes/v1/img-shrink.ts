import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { runImgShrink, type ImgShrinkInput } from "../../services/img-shrink.js";
import { statusForThrown } from "../../lib/errors.js";

export type ImgShrinkRoutesOpts = {
  storageDir: string;
  publicBaseUrl: string;
};

const MAX_BODY_BYTES = 30 * 1024 * 1024; // 30 MB — accommodates a base64-encoded 22 MB image

export function makeImgShrinkRoutes(opts: ImgShrinkRoutesOpts): FastifyPluginAsync {
  return async (app) => {
    app.get("/agents/img-shrink", async () => ({
      name: "img-shrink",
      kind: "utility", // not an AI agent
      version: "0.7.0",
      doc: "POST /v1/agents/img-shrink/run with imageUrl or imageBase64.",
    }));

    app.post(
      "/agents/img-shrink/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: ImgShrinkInput = {
          imageUrl:
            typeof body.imageUrl === "string" ? body.imageUrl.trim() : undefined,
          imageBase64:
            typeof body.imageBase64 === "string" ? body.imageBase64 : undefined,
          format: (() => {
            const f = body.format;
            if (
              f === "jpeg" ||
              f === "png" ||
              f === "webp" ||
              f === "avif" ||
              f === "auto"
            )
              return f;
            return undefined;
          })(),
          maxWidth: typeof body.maxWidth === "number" ? body.maxWidth : undefined,
          quality: typeof body.quality === "number" ? body.quality : undefined,
        };

        const startedAt = Date.now();
        let result;
        try {
          result = await runImgShrink(input);
        } catch (err) {
          // Sprint 18 (F5): ValidationError → 400; legacy regex catches the
          // older plain-Error throws in img-shrink.ts that haven't been migrated yet.
          const { code, message } = statusForThrown(
            err,
            502,
            /required|valid URL|too large|Refusing to fetch|Pass only one|Only http|Expected image\//,
            "img-shrink failed"
          );
          return reply.code(code).send({ error: message });
        }

        const id = randomUUID().replace(/-/g, "").slice(0, 16);
        const fileName = `${id}.${result.extension}`;
        const filePath = path.join(opts.storageDir, fileName);
        try {
          await fs.mkdir(opts.storageDir, { recursive: true });
          await fs.writeFile(filePath, result.buffer);
        } catch (err) {
          app.log.error({ err, filePath }, "img-shrink: failed to write output");
          return reply.code(500).send({
            error: "Compressed the image but could not save it to disk.",
          });
        }

        const url = `${opts.publicBaseUrl.replace(/\/$/, "")}/r/${fileName}`;
        const ratio =
          result.outputBytes > 0
            ? Math.round((result.outputBytes / result.originalBytes) * 1000) / 1000
            : 0;

        return {
          previewUrl: url,
          downloadUrl: url,
          inputFormat: result.inputFormat,
          outputFormat: result.outputFormat,
          width: result.width,
          height: result.height,
          originalBytes: result.originalBytes,
          outputBytes: result.outputBytes,
          compressionRatio: ratio, // 0.42 means 42% of original
          savedBytes: Math.max(0, result.originalBytes - result.outputBytes),
          meta: {
            generatedInMs: Date.now() - startedAt,
          },
        };
      }
    );
  };
}
