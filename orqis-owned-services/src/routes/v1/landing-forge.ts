import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import {
  detectMode,
  runLandingForge,
  type LandingForgeInput,
} from "../../services/landing-forge.js";

/**
 * Public-facing endpoint for the in-house landing-forge agent. The orqis
 * invocation proxy POSTs validated input here; we generate the page, save
 * it to disk under STORAGE_DIR/r, and return preview + download URLs.
 *
 * Path inside the backend container: <project>/storage/r/<id>.html
 * Public URL:                         <PUBLIC_BASE_URL>/r/<id>.html
 */
export type LandingForgeRoutesOpts = {
  storageDir: string; // absolute path on disk
  publicBaseUrl: string; // e.g. http://localhost:4000
};

function isValidColor(s: unknown): s is string {
  return typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
  return out.length > 0 ? out : undefined;
}

export function makeLandingForgeRoutes(
  opts: LandingForgeRoutesOpts
): FastifyPluginAsync {
  return async (app) => {
    // Lightweight discoverability — the orqis admin queue can curl this.
    app.get("/agents/landing-forge", async () => ({
      name: "landing-forge",
      mode: detectMode(),
      version: "0.7.0",
      doc: "POST /v1/agents/landing-forge/run with the input schema published on orqis.",
    }));

    app.post("/agents/landing-forge/run", async (req, reply) => {
      const body = (req.body ?? {}) as Record<string, unknown>;

      // Permissive parsing — orqis already Ajv-validated against the agent's
      // inputSchema before calling us. We only re-check the bits we touch.
      const productName = asString(body.productName);
      const oneLiner = asString(body.oneLiner);
      if (!productName) {
        return reply.code(400).send({ error: "productName is required" });
      }
      if (!oneLiner) {
        return reply.code(400).send({ error: "oneLiner is required" });
      }

      const tone = (() => {
        const t = asString(body.tone);
        if (t === "minimal" || t === "bold" || t === "playful" || t === "premium") return t;
        return undefined;
      })();
      const primaryColor = isValidColor(body.primaryColor) ? body.primaryColor : undefined;

      const input: LandingForgeInput = {
        productName: productName.slice(0, 80),
        oneLiner: oneLiner.slice(0, 240),
        audience: asString(body.audience)?.slice(0, 200),
        features: asStringArray(body.features)?.slice(0, 8),
        tone,
        primaryColor,
      };

      const startedAt = Date.now();
      let result;
      try {
        result = await runLandingForge(input);
      } catch (err) {
        app.log.error({ err }, "landing-forge generation failed");
        return reply.code(502).send({
          error:
            err instanceof Error
              ? `landing-forge failed: ${err.message}`
              : "landing-forge failed",
        });
      }

      const id = randomUUID().replace(/-/g, "").slice(0, 16);
      const fileName = `${id}.html`;
      const filePath = path.join(opts.storageDir, fileName);
      try {
        await fs.mkdir(opts.storageDir, { recursive: true });
        await fs.writeFile(filePath, result.html, "utf8");
      } catch (err) {
        app.log.error({ err, filePath }, "failed to write generated HTML");
        return reply.code(500).send({
          error: "Generated the page but could not save it to disk.",
        });
      }

      const url = `${opts.publicBaseUrl.replace(/\/$/, "")}/r/${fileName}`;
      return {
        previewUrl: url,
        htmlDownloadUrl: url,
        designNotes: result.designNotes,
        meta: {
          modelUsed: result.modelUsed,
          generatedInMs: Date.now() - startedAt,
          ...(typeof result.cacheReadTokens === "number"
            ? { cacheReadTokens: result.cacheReadTokens }
            : {}),
        },
      };
    });
  };
}
