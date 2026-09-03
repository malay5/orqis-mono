import type { FastifyPluginAsync } from "fastify";
import {
  detectMode,
  runCourseQuill,
  type CourseQuillInput,
} from "../../services/course-quill.js";
import {
  runLater,
  webhookContextFromHeaders,
  webhookFailure,
  webhookSuccess,
} from "../../lib/async-runner.js";

/**
 * Async invocation handler for course-quill — same contract as demo-forge:
 * proxy POSTs the input + webhook headers, we 202 within ms and POST the
 * result to the supplied webhook URL when done.
 */
export const courseQuillRoutes: FastifyPluginAsync = async (app) => {
  app.get("/agents/course-quill", async () => ({
    name: "course-quill",
    kind: "ai-agent",
    isAsync: true,
    mode: detectMode(),
    version: "0.9.0",
    doc: "POST /v1/agents/course-quill/run with the input schema published on orqis. Async — result delivered via webhook.",
  }));

  app.post("/agents/course-quill/run", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const topic =
      typeof body.topic === "string" && body.topic.trim() ? body.topic.trim() : null;
    if (!topic) {
      return reply.code(400).send({ error: "topic is required" });
    }

    const input: CourseQuillInput = {
      topic: topic.slice(0, 400),
      courseLevel: ((): CourseQuillInput["courseLevel"] => {
        const v = body.courseLevel;
        if (v === "intro" || v === "intermediate" || v === "advanced") return v;
        return "intro";
      })(),
      pageCount: ((): number => {
        const n = Number(body.pageCount);
        if (!Number.isFinite(n)) return 8;
        return Math.max(2, Math.min(30, Math.round(n)));
      })(),
      format: ((): CourseQuillInput["format"] => {
        const v = body.format;
        if (v === "paper" || v === "beamer-slides" || v === "both") return v;
        return "both";
      })(),
      includeTikzDiagrams: body.includeTikzDiagrams !== false,
      equationDensity: ((): CourseQuillInput["equationDensity"] => {
        const v = body.equationDensity;
        if (v === "sparse" || v === "balanced" || v === "heavy") return v;
        return "balanced";
      })(),
      citationStyle: ((): CourseQuillInput["citationStyle"] => {
        const v = body.citationStyle;
        if (v === "acm" || v === "ieee" || v === "apa" || v === "none") return v;
        return "acm";
      })(),
    };

    const webhook = webhookContextFromHeaders({
      "x-orqis-webhook-url": req.headers["x-orqis-webhook-url"] as string | undefined,
      "x-orqis-webhook-secret": req.headers["x-orqis-webhook-secret"] as
        | string
        | undefined,
    });
    if (!webhook) {
      return reply.code(400).send({
        error:
          "Missing X-Orqis-Webhook-Url + X-Orqis-Webhook-Secret headers. course-quill is async and needs them to deliver its result.",
      });
    }

    runLater(async () => {
      const startedAt = Date.now();
      try {
        const result = await runCourseQuill(input);
        await webhookSuccess(webhook, result, Date.now() - startedAt);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "course-quill: unknown failure";
        await webhookFailure(
          webhook,
          "course_quill_failed",
          message,
          Date.now() - startedAt
        );
      }
    });

    return reply.code(202).send({
      accepted: true,
      mode: detectMode(),
      message:
        "course-quill accepted the job. Result will be POSTed to the supplied webhook URL.",
    });
  });
};
