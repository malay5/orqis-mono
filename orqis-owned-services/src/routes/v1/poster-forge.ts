import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import {
  detectMode,
  runPosterForge,
  type PosterForgeInput,
} from "../../services/poster-forge.js";

export type PosterForgeRoutesOpts = {
  storageDir: string;
  publicBaseUrl: string;
};

const ALLOWED_ASPECTS = new Set([
  "1:1",
  "4:5",
  "9:16",
  "16:9",
  "3:4",
  "2:3",
  "a4-portrait",
]);

function clip(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

export function makePosterForgeRoutes(opts: PosterForgeRoutesOpts): FastifyPluginAsync {
  return async (app) => {
    app.get("/agents/poster-forge", async () => ({
      name: "poster-forge",
      kind: "ai-agent",
      isAsync: false,
      mode: detectMode(),
      version: "0.10.0",
      doc: "POST /v1/agents/poster-forge/run with the input schema published on orqis.",
    }));

    app.post("/agents/poster-forge/run", async (req, reply) => {
      const body = (req.body ?? {}) as Record<string, unknown>;

      const title = clip(body.title, 80);
      const vibe = clip(body.vibe, 1000);
      if (!title) return reply.code(400).send({ error: "title is required" });
      if (!vibe) return reply.code(400).send({ error: "vibe is required" });

      const aspectRatio = ((): PosterForgeInput["aspectRatio"] => {
        const v = body.aspectRatio;
        if (typeof v === "string" && ALLOWED_ASPECTS.has(v)) {
          return v as PosterForgeInput["aspectRatio"];
        }
        return "a4-portrait";
      })();
      const accentHex =
        typeof body.accentHex === "string" && /^#[0-9a-f]{6}$/i.test(body.accentHex)
          ? body.accentHex
          : undefined;

      const input: PosterForgeInput = {
        title,
        subtitle: clip(body.subtitle, 200),
        eventDetails: clip(body.eventDetails, 300),
        vibe,
        aspectRatio,
        accentHex,
        avoid: Array.isArray(body.avoid)
          ? (body.avoid as unknown[])
              .filter((x): x is string => typeof x === "string")
              .slice(0, 8)
          : undefined,
      };

      const startedAt = Date.now();
      let result;
      try {
        result = await runPosterForge(input);
      } catch (err) {
        app.log.error({ err }, "poster-forge generation failed");
        return reply.code(502).send({
          error: err instanceof Error ? `poster-forge failed: ${err.message}` : "poster-forge failed",
        });
      }

      const id = randomUUID().replace(/-/g, "").slice(0, 16);
      const fileName = `${id}.png`;
      const filePath = path.join(opts.storageDir, fileName);
      try {
        await fs.mkdir(opts.storageDir, { recursive: true });
        await fs.writeFile(filePath, result.buffer);
      } catch (err) {
        app.log.error({ err, filePath }, "poster-forge: failed to write output");
        return reply.code(500).send({
          error: "Generated the poster but could not save it to disk.",
        });
      }

      const url = `${opts.publicBaseUrl.replace(/\/$/, "")}/r/${fileName}`;
      return {
        previewUrl: url,
        downloadUrl: url,
        width: result.width,
        height: result.height,
        meta: {
          modelUsed: result.modelUsed,
          generatedInMs: Date.now() - startedAt,
        },
      };
    });
  };
}
