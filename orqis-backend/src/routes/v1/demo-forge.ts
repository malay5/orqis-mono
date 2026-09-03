import type { FastifyPluginAsync } from "fastify";
import {
  detectMode,
  runDemoForge,
  type DemoForgeInput,
} from "../../services/demo-forge.js";
import {
  runLater,
  webhookContextFromHeaders,
  webhookFailure,
  webhookSuccess,
} from "../../lib/async-runner.js";

/**
 * POST /v1/agents/demo-forge/run — async invocation handler.
 *
 * Contract with the orqis invocation proxy:
 *   1. Proxy POSTs the validated input here, plus headers:
 *        X-Orqis-Invocation-Id   (informational)
 *        X-Orqis-Webhook-Url     (where to POST the result)
 *        X-Orqis-Webhook-Secret  (echoed back when posting)
 *   2. We respond **202 Accepted** within a few hundred ms.
 *   3. We then run the actual pipeline in the background and POST the
 *      result (success or failure) to the webhook URL.
 */
export const demoForgeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/agents/demo-forge", async () => ({
    name: "demo-forge",
    kind: "ai-agent",
    isAsync: true,
    mode: detectMode(),
    version: "0.8.0",
    doc: "POST /v1/agents/demo-forge/run with the input schema published on orqis. Async — result delivered via webhook.",
  }));

  app.post("/agents/demo-forge/run", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const product =
      typeof body.product === "string" && body.product.trim()
        ? body.product.trim()
        : null;
    if (!product) {
      return reply.code(400).send({ error: "product is required" });
    }

    const input: DemoForgeInput = {
      product: product.slice(0, 2_000),
      durationSeconds: ((): 15 | 30 | 60 => {
        const v = Number(body.durationSeconds);
        if (v === 15 || v === 30 || v === 60) return v;
        return 30;
      })(),
      voice: ((): DemoForgeInput["voice"] => {
        const v = body.voice;
        if (v === "alloy" || v === "onyx" || v === "nova" || v === "shimmer") return v;
        return undefined;
      })(),
      style: ((): DemoForgeInput["style"] => {
        const v = body.style;
        if (v === "minimal" || v === "bold" || v === "playful") return v;
        return undefined;
      })(),
    };

    // Webhook context is required for async — without it we'd run the
    // pipeline and have nowhere to deliver the result.
    const webhook = webhookContextFromHeaders({
      "x-orqis-webhook-url": req.headers["x-orqis-webhook-url"] as string | undefined,
      "x-orqis-webhook-secret": req.headers["x-orqis-webhook-secret"] as
        | string
        | undefined,
    });
    if (!webhook) {
      return reply.code(400).send({
        error:
          "Missing X-Orqis-Webhook-Url + X-Orqis-Webhook-Secret headers. This agent is async and needs them to deliver its result.",
      });
    }

    runLater(async () => {
      const startedAt = Date.now();
      try {
        const result = await runDemoForge(input);
        await webhookSuccess(webhook, result, Date.now() - startedAt);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "demo-forge: unknown failure";
        await webhookFailure(
          webhook,
          "demo_forge_failed",
          message,
          Date.now() - startedAt
        );
      }
    });

    return reply.code(202).send({
      accepted: true,
      mode: detectMode(),
      message:
        "demo-forge accepted the job. Result will be POSTed to the supplied webhook URL.",
    });
  });
};
