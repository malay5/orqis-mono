import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { Types } from "mongoose";
import { createHash, randomBytes } from "node:crypto";
import { Ajv } from "ajv";
import addFormatsPkg, { type FormatsPlugin } from "ajv-formats";
import { connectMongoose } from "../../db/mongoose.js";
import { AgentModel, type AgentDoc } from "../../models/Agent.js";
import { InvocationModel } from "../../models/Invocation.js";
import { UserModel } from "../../models/User.js";
import {
  chargeCredits,
  refundInvocation,
  InsufficientCreditsError,
} from "../../platform/credit-mutations.js";
import {
  recordInvocationStart,
  markInvocationSucceeded,
  markInvocationFailed,
} from "../../platform/invocations.js";
import { decryptString } from "../../platform/crypto-server.js";
import { take, INVOKE_LIMIT } from "../../platform/rate-limit.js";
import { sanitizeResultUrls } from "../../platform/sanitize-urls.js";
import { resolveCaller, callerCanInvoke } from "../../platform/caller.js";

/**
 * The invocation proxy (Sprint 19) — ported from the Next.js route handler at
 * `orqis-frontend/src/app/api/agents/[slug]/invoke/route.ts`.
 *
 * This is the money path, so the port is deliberately faithful: same ordering
 * (open the row → charge → call → rebate/refund), same idempotency keys, same
 * status codes. Behaviour preserved from the original, sprint tags kept so the
 * history stays traceable:
 *
 *   - M2: reject oversized bodies BEFORE opening a row or charging.
 *   - M6: rebate on `mode` — "mock" refunds in full, "byok" refunds all but
 *         the 1-credit routing fee.
 *   - F4: scrub non-http(s) `*url` fields out of seller responses.
 *
 * The one behavioural difference is the webhook URL: it now points at this
 * service (PUBLIC_BASE_URL) rather than the Next app, because the job webhook
 * moved here with the rest of the data layer.
 */

const SYNC_TIMEOUT_MS = 30_000;
const ASYNC_ACK_TIMEOUT_MS = 10_000; // sellers ack fast; work continues in background
const MAX_INVOKE_BODY_BYTES = 8 * 1024 * 1024; // 8 MB — generous for base64 inputs

// ajv and ajv-formats are CommonJS. The frontend resolved them with
// moduleResolution "bundler", which synthesises a callable default; this
// package uses NodeNext, where the default import lands on the module
// namespace instead. Ajv is taken as a named export (ajv sets
// `module.exports.Ajv`), and the formats plugin is unwrapped from `.default`.
const addFormats = ((addFormatsPkg as unknown as { default?: FormatsPlugin }).default ??
  addFormatsPkg) as FormatsPlugin;

// One Ajv instance per process — compiles lazily. Per-agent compiled
// validators aren't cached yet; do that when this becomes a hot path.
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

function ajvErrorsToString(errors: unknown): string {
  if (!Array.isArray(errors) || errors.length === 0) return "Schema validation failed";
  return errors
    .map((e) => {
      const path = (e as { instancePath?: string }).instancePath || "/";
      return `${path} ${(e as { message?: string }).message ?? ""}`.trim();
    })
    .join("; ");
}

function publicBaseUrl(req: FastifyRequest): string {
  const fromEnv = process.env.PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = req.headers.host ?? "localhost:4000";
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export const platformInvokeRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { slug: string } }>(
    "/invoke/:slug",
    { bodyLimit: MAX_INVOKE_BODY_BYTES },
    async (req, reply) => {
      const caller = await resolveCaller(req);
      if (!caller) {
        return reply
          .code(401)
          .send({ error: "Sign in or pass an Authorization: Bearer or_live_… header." });
      }
      if (!callerCanInvoke(caller)) {
        return reply.code(403).send({ error: "This API key is missing the `invoke` scope." });
      }

      const userId = caller.userId;
      const userObjectId = new Types.ObjectId(userId);

      // Bucket per-key for programmatic calls (each key gets its own quota),
      // per-user for browser-session calls.
      const rlKey =
        caller.type === "api_key" ? `invoke:key:${caller.apiKeyId}` : `invoke:user:${userId}`;
      const rl = take(rlKey, INVOKE_LIMIT);
      if (!rl.ok) {
        const retryAfter = Math.ceil(rl.retryAfterMs / 1000);
        return reply
          .code(429)
          .header("Retry-After", String(retryAfter))
          .send({ error: `Rate limit exceeded. Try again in ${retryAfter}s.` });
      }

      const { slug } = req.params;
      await connectMongoose();
      const agent = await AgentModel.findOne({ slug, status: "approved" }).lean<AgentDoc>();
      if (!agent) {
        return reply.code(404).send({ error: "Agent not found or not approved." });
      }
      if (!agent.endpointUrl) {
        return reply
          .code(422)
          .send({ error: "This agent has no endpoint configured. Pick another from /browse." });
      }

      // Fastify's bodyLimit already rejects oversized payloads with a 413
      // before the handler runs, which is the M2 guarantee: no row, no charge.
      const body = (req.body ?? {}) as unknown;
      const bodyText = JSON.stringify(body ?? {});
      const requestBytes = Buffer.byteLength(bodyText, "utf8");

      // Validate input against the seller's schema.
      if (agent.inputSchema && typeof agent.inputSchema === "object") {
        try {
          const validate = ajv.compile(agent.inputSchema as object);
          if (!validate(body)) {
            return reply.code(400).send({
              error: `Input does not match schema: ${ajvErrorsToString(validate.errors)}`,
            });
          }
        } catch (err) {
          return reply.code(500).send({
            error: `Could not compile agent input schema: ${(err as Error).message}`,
          });
        }
      }

      // Pre-check balance. chargeCredits also enforces this transactionally.
      const userDoc = await UserModel.findById(userObjectId).select("creditBalance").lean();
      if (!userDoc) return reply.code(404).send({ error: "User not found." });
      if ((userDoc.creditBalance ?? 0) < agent.pricePerCall) {
        return reply.code(402).send({
          error: `Insufficient credits — this agent costs ${agent.pricePerCall} credits, you have ${userDoc.creditBalance ?? 0}.`,
        });
      }

      // 1) Open the invocation row first so we have an id for idempotent charges.
      const invocation = await recordInvocationStart({
        agentId: agent._id,
        userId: userObjectId,
        callerType: caller.type,
        pricePerCall: agent.pricePerCall,
        requestPayload: body,
        requestBytes,
      });

      // 2) Debit. Idempotency key tied to the invocation id keeps retries safe.
      try {
        await chargeCredits({
          userId,
          amount: agent.pricePerCall,
          reason: "invocation",
          invocationId: String(invocation._id),
          idempotencyKey: `invoke:${invocation._id}`,
          note: `Invoke ${agent.slug}`,
        });
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          await markInvocationFailed({
            invocationId: invocation._id,
            httpStatus: null,
            latencyMs: 0,
            errorCode: "insufficient_credits",
            errorMessage: err.message,
            refunded: false,
          });
          return reply.code(402).send({ error: err.message });
        }
        throw err;
      }

      // 3) Decrypt the seller's auth header, if any.
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "orqis-invocation-proxy/0.7",
        "X-Orqis-Invocation-Id": String(invocation._id),
      };
      if (agent.authHeaderName && agent.authHeaderValueEnc) {
        try {
          headers[agent.authHeaderName] = decryptString(agent.authHeaderValueEnc);
        } catch (err) {
          // Refund and fail — the key was probably rotated, or the ciphertext
          // is corrupt. Either way the buyer shouldn't pay for it.
          await refundInvocation({
            userId,
            amount: agent.pricePerCall,
            invocationId: String(invocation._id),
            note: "decrypt_failed",
          });
          await markInvocationFailed({
            invocationId: invocation._id,
            httpStatus: null,
            latencyMs: 0,
            errorCode: "decrypt_failed",
            errorMessage: (err as Error).message,
            refunded: true,
          });
          return reply
            .code(500)
            .send({ error: "Failed to decrypt seller auth header. Refunded." });
        }
      }

      // ---------- 4a) ASYNC branch ----------
      if (agent.isAsync) {
        const webhookSecret = randomBytes(24).toString("base64url");
        const webhookSecretHash = createHash("sha256").update(webhookSecret).digest("hex");
        const webhookUrl = `${publicBaseUrl(req)}/v1/webhooks/jobs/${invocation._id}`;

        await InvocationModel.updateOne(
          { _id: invocation._id },
          { $set: { isAsync: true, webhookSecretHash } }
        );

        headers["X-Orqis-Webhook-Url"] = webhookUrl;
        headers["X-Orqis-Webhook-Secret"] = webhookSecret;

        const ackController = new AbortController();
        const ackTimer = setTimeout(() => ackController.abort(), ASYNC_ACK_TIMEOUT_MS);
        const startedAt = performance.now();
        try {
          const ack = await fetch(agent.endpointUrl, {
            method: "POST",
            headers,
            body: bodyText,
            signal: ackController.signal,
          });
          const ackText = await ack.text();
          const ackLatency = Math.round(performance.now() - startedAt);

          if (!ack.ok) {
            await refundInvocation({
              userId,
              amount: agent.pricePerCall,
              invocationId: String(invocation._id),
              note: `async_ack_${ack.status}`,
            });
            await markInvocationFailed({
              invocationId: invocation._id,
              httpStatus: ack.status,
              latencyMs: ackLatency,
              errorCode: `async_ack_${ack.status}`,
              errorMessage:
                ackText.slice(0, 1000) || `Seller did not accept the job (${ack.status})`,
              responseBody: ackText,
              refunded: true,
            });
            return reply.code(502).send({
              error: `Seller did not accept the job (${ack.status}). You were refunded.`,
            });
          }

          // Don't mark succeeded — the webhook does that. We're queued.
          return reply.send({
            ok: true,
            status: "pending",
            invocationId: String(invocation._id),
            creditsCharged: agent.pricePerCall,
            message: `Job accepted. Poll GET /v1/jobs/${invocation._id} for status.`,
          });
        } catch (err) {
          const ackLatency = Math.round(performance.now() - startedAt);
          const aborted = (err as Error).name === "AbortError";
          const errorCode = aborted ? "async_ack_timeout" : "async_ack_network";
          const errorMessage = aborted
            ? `Seller did not acknowledge within ${ASYNC_ACK_TIMEOUT_MS / 1000}s.`
            : ((err as Error).message ?? "Network error");
          await refundInvocation({
            userId,
            amount: agent.pricePerCall,
            invocationId: String(invocation._id),
            note: errorCode,
          });
          await markInvocationFailed({
            invocationId: invocation._id,
            httpStatus: null,
            latencyMs: ackLatency,
            errorCode,
            errorMessage,
            refunded: true,
          });
          return reply
            .code(aborted ? 504 : 502)
            .send({ error: `${errorMessage} You were refunded.` });
        } finally {
          clearTimeout(ackTimer);
        }
      }

      // ---------- 4b) SYNC branch ----------
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
      const startedAt = performance.now();
      let httpStatus: number | null = null;
      let upstreamText = "";

      try {
        const res = await fetch(agent.endpointUrl, {
          method: "POST",
          headers,
          body: bodyText,
          signal: controller.signal,
        });
        httpStatus = res.status;
        upstreamText = await res.text();
        const latencyMs = Math.round(performance.now() - startedAt);

        if (!res.ok) {
          await refundInvocation({
            userId,
            amount: agent.pricePerCall,
            invocationId: String(invocation._id),
            note: `upstream_${res.status}`,
          });
          await markInvocationFailed({
            invocationId: invocation._id,
            httpStatus,
            latencyMs,
            errorCode: `upstream_${res.status}`,
            errorMessage: upstreamText.slice(0, 1000) || `Upstream ${res.status}`,
            responseBody: upstreamText,
            refunded: true,
          });
          return reply.code(502).send({
            error: `Upstream returned ${res.status}. You were refunded.`,
            upstream: upstreamText.slice(0, 2000),
          });
        }

        let responseJson: unknown = null;
        try {
          responseJson = upstreamText.length > 0 ? JSON.parse(upstreamText) : null;
        } catch {
          // Non-JSON 2xx — returned as text inside `result`.
        }
        // F4: scrub `*url` fields with non-http(s) schemes so a malicious
        // seller can't XSS the buyer via javascript:/data: in a previewUrl
        // that the Try-It panel renders into an iframe or link.
        responseJson = sanitizeResultUrls(responseJson);

        // Best-effort output schema validation. Warn, don't fail — the schema
        // is the seller's, and the buyer already has their result.
        let schemaWarning: string | null = null;
        if (responseJson !== null && agent.outputSchema && typeof agent.outputSchema === "object") {
          try {
            const validate = ajv.compile(agent.outputSchema as object);
            if (!validate(responseJson)) {
              schemaWarning = `Upstream response did not match the declared output schema: ${ajvErrorsToString(validate.errors)}`;
            }
          } catch {
            // ignore
          }
        }

        // M6: rebate when the upstream signals a non-billable mode.
        //   "mock" → full refund (the response was canned, nothing was spent)
        //   "byok" → refund all but the 1-credit routing fee
        // Agents that don't surface `mode` bill at full price.
        // NOTE: a third-party seller could forge `mode: "mock"` to dodge
        // billing. Harmless while there are no payouts (a rebate only credits
        // the buyer); gate this to trusted endpoint hosts before payouts ship.
        const upstreamMode =
          responseJson && typeof responseJson === "object"
            ? (responseJson as { mode?: unknown }).mode
            : null;
        let rebatedAmount = 0;
        if (upstreamMode === "mock") {
          rebatedAmount = agent.pricePerCall;
        } else if (upstreamMode === "byok") {
          rebatedAmount = Math.max(0, agent.pricePerCall - 1);
        }
        if (rebatedAmount > 0) {
          try {
            await refundInvocation({
              userId,
              amount: rebatedAmount,
              invocationId: String(invocation._id),
              note: `${upstreamMode}_rebate`,
            });
          } catch (err) {
            // Don't fail the buyer's call over a rebate write — they got the
            // right result; worst case they paid full price for a mock.
            app.log.error({ err }, "[invoke] rebate write failed");
          }
        }
        const effectiveCharge = agent.pricePerCall - rebatedAmount;

        await markInvocationSucceeded({
          invocationId: invocation._id,
          agentId: agent._id,
          userId: userObjectId,
          httpStatus,
          latencyMs,
          responseBody: upstreamText,
        });

        const newUser = await UserModel.findById(userObjectId).select("creditBalance").lean();
        return reply.send({
          ok: true,
          invocationId: String(invocation._id),
          latencyMs,
          creditsCharged: effectiveCharge,
          newBalance: newUser?.creditBalance ?? 0,
          result: responseJson ?? upstreamText,
          schemaWarning,
        });
      } catch (err) {
        const latencyMs = Math.round(performance.now() - startedAt);
        const aborted = (err as Error).name === "AbortError";
        const errorCode = aborted ? "timeout" : "network";
        const errorMessage = aborted
          ? `Upstream did not respond within ${SYNC_TIMEOUT_MS / 1000}s.`
          : ((err as Error).message ?? "Network error");

        await refundInvocation({
          userId,
          amount: agent.pricePerCall,
          invocationId: String(invocation._id),
          note: errorCode,
        });
        await markInvocationFailed({
          invocationId: invocation._id,
          httpStatus,
          latencyMs,
          errorCode,
          errorMessage,
          responseBody: upstreamText,
          refunded: true,
        });
        return reply
          .code(aborted ? 504 : 502)
          .send({ error: `${errorMessage} You were refunded.` });
      } finally {
        clearTimeout(timer);
      }
    }
  );
};
