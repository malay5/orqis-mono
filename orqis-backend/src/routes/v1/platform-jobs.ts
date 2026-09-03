import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import { createHash, timingSafeEqual } from "node:crypto";
import { connectMongoose } from "../../db/mongoose.js";
import { InvocationModel, type InvocationDoc } from "../../models/Invocation.js";
import { AgentModel } from "../../models/Agent.js";
import { ReviewModel } from "../../models/Review.js";
import { refundInvocation } from "../../platform/credit-mutations.js";
import { sanitizeResultUrls } from "../../platform/sanitize-urls.js";
import { listJobsForUser, getJobForUser } from "../../platform/jobs.js";
import { requireCaller } from "../../platform/caller.js";

/**
 * Async jobs and the seller result webhook (Sprint 19).
 *
 *   GET  /v1/jobs                    → this user's async jobs
 *   GET  /v1/jobs/:invocationId      → one job (ownership enforced)
 *   POST /v1/webhooks/jobs/:invocationId → seller posts the result
 *
 * Webhook auth: the seller echoes the `X-Orqis-Webhook-Secret` we sent on the
 * original invocation. We compare against the SHA-256 hash stored on the
 * Invocation row at dispatch — the plaintext is never persisted. Comparison is
 * timing-safe, and the handler is idempotent: an invocation already in a
 * terminal state returns 200 without mutating, so sellers can retry freely.
 */

function verifySecret(presented: string, storedHash: string): boolean {
  if (!presented || !storedHash) return false;
  const presentedHash = createHash("sha256").update(presented).digest("hex");
  if (presentedHash.length !== storedHash.length) return false;
  return timingSafeEqual(Buffer.from(presentedHash), Buffer.from(storedHash));
}

export const platformJobRoutes: FastifyPluginAsync = async (app) => {
  app.get("/jobs", { preHandler: requireCaller }, async (req, reply) => {
    const q = req.query as { limit?: string };
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 30));
    const jobs = await listJobsForUser(req.caller!.userId, limit);
    return reply.send({ count: jobs.length, jobs });
  });

  app.get<{ Params: { invocationId: string } }>(
    "/jobs/:invocationId",
    { preHandler: requireCaller },
    async (req, reply) => {
      const { invocationId } = req.params;
      if (!Types.ObjectId.isValid(invocationId)) {
        return reply.code(400).send({ error: "Invalid invocation id." });
      }
      // Ownership is enforced inside the helper — a job id must not be a
      // capability that lets any signed-in user read someone else's result.
      const job = await getJobForUser(req.caller!.userId, invocationId);
      if (!job) return reply.code(404).send({ error: "Job not found." });
      return reply.send({ job });
    }
  );

  app.post<{ Params: { invocationId: string } }>(
    "/webhooks/jobs/:invocationId",
    async (req, reply) => {
      const { invocationId } = req.params;
      if (!Types.ObjectId.isValid(invocationId)) {
        return reply.code(400).send({ error: "Invalid invocation id." });
      }

      const presented = (req.headers["x-orqis-webhook-secret"] as string | undefined) ?? "";

      await connectMongoose();
      const inv = await InvocationModel.findById(invocationId).lean<InvocationDoc>();
      if (!inv) return reply.code(404).send({ error: "Invocation not found." });
      if (!inv.isAsync || !inv.webhookSecretHash) {
        return reply.code(409).send({ error: "This invocation does not accept webhooks." });
      }
      if (!verifySecret(presented, inv.webhookSecretHash)) {
        return reply.code(401).send({ error: "Invalid webhook secret." });
      }

      // Idempotency: already terminal → 200 with no mutation.
      if (inv.status === "succeeded" || inv.status === "refunded" || inv.status === "failed") {
        return reply.send({ ok: true, alreadyFinalized: true, status: inv.status });
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const isOk = body.ok === true;
      const durationMs =
        typeof body.durationMs === "number" && body.durationMs >= 0
          ? Math.round(body.durationMs)
          : null;

      if (isOk) {
        // F4: scrub non-http(s) `*url` fields before persisting — the
        // dashboard and Try-It panel render these into <a href> and
        // <iframe src>, so a javascript:/data: URL here would XSS the buyer.
        const result = sanitizeResultUrls("result" in body ? body.result : null);
        const responseText = JSON.stringify(result ?? null);
        const responseBytes = Buffer.byteLength(responseText, "utf8");

        await InvocationModel.updateOne(
          { _id: inv._id },
          {
            $set: {
              status: "succeeded",
              httpStatus: 200,
              latencyMs: durationMs,
              responseBytes,
              responsePreview: responseText.slice(0, 512),
              result,
              completedAt: new Date(),
            },
          }
        );
        // Side effects mirror the sync success path.
        await AgentModel.updateOne({ _id: inv.agentId }, { $inc: { invocationCount: 1 } });
        await ReviewModel.updateMany(
          { agentId: inv.agentId, userId: inv.userId, verifiedUse: { $ne: true } },
          { $set: { verifiedUse: true } }
        );
        return reply.send({ ok: true });
      }

      // Failure path — refund and mark refunded.
      const errorCode =
        typeof body.errorCode === "string" ? body.errorCode.slice(0, 80) : "async_failed";
      const errorMessage =
        typeof body.errorMessage === "string"
          ? body.errorMessage.slice(0, 1000)
          : "Async job failed.";

      await refundInvocation({
        userId: String(inv.userId),
        amount: inv.creditsCharged,
        invocationId: String(inv._id),
        note: errorCode,
      });
      await InvocationModel.updateOne(
        { _id: inv._id },
        {
          $set: {
            status: "refunded",
            latencyMs: durationMs,
            errorCode,
            errorMessage,
            completedAt: new Date(),
          },
        }
      );
      return reply.send({ ok: true, refunded: true });
    }
  );
};
