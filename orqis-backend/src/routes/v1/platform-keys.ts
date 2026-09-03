import type { FastifyPluginAsync } from "fastify";
import {
  listApiKeys,
  mintApiKey,
  revokeApiKey,
  type ApiKeyScope,
} from "../../platform/api-keys.js";
import { requireCaller } from "../../platform/caller.js";

/**
 * API key management (Sprint 19).
 *
 *   GET    /v1/keys       → list this user's keys (secrets never returned)
 *   POST   /v1/keys       → mint a key; plaintext returned exactly once
 *   DELETE /v1/keys/:id   → revoke
 *
 * Minting and revoking are session-only (a JWT caller, not an API key). A key
 * that can mint more keys is a privilege-escalation path: steal one key, keep
 * access forever even after it's revoked.
 */

const ALLOWED_SCOPES: ApiKeyScope[] = ["read", "invoke"];

function sessionOnly(req: { caller?: { type: string } }): boolean {
  return req.caller?.type === "session";
}

export const platformKeyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/keys", { preHandler: requireCaller }, async (req, reply) => {
    const keys = await listApiKeys(req.caller!.userId);
    return reply.send({ keys });
  });

  app.post("/keys", { preHandler: requireCaller }, async (req, reply) => {
    if (!sessionOnly(req)) {
      return reply
        .code(403)
        .send({ error: "API keys can only be created from a signed-in session." });
    }

    const body = (req.body ?? {}) as { label?: unknown; scopes?: unknown };
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) return reply.code(400).send({ error: "label is required." });

    const scopes = Array.isArray(body.scopes)
      ? (body.scopes as unknown[]).filter((s): s is ApiKeyScope =>
          typeof s === "string" && ALLOWED_SCOPES.includes(s as ApiKeyScope)
        )
      : ALLOWED_SCOPES;
    if (scopes.length === 0) {
      return reply
        .code(400)
        .send({ error: `scopes must include at least one of: ${ALLOWED_SCOPES.join(", ")}` });
    }

    try {
      const created = await mintApiKey({ userId: req.caller!.userId, label, scopes });
      return reply.send({ key: created });
    } catch (err) {
      return reply
        .code(500)
        .send({ error: err instanceof Error ? err.message : "Failed to mint key." });
    }
  });

  app.delete<{ Params: { id: string } }>(
    "/keys/:id",
    { preHandler: requireCaller },
    async (req, reply) => {
      if (!sessionOnly(req)) {
        return reply
          .code(403)
          .send({ error: "API keys can only be revoked from a signed-in session." });
      }
      const ok = await revokeApiKey({ userId: req.caller!.userId, keyId: req.params.id });
      if (!ok) return reply.code(404).send({ error: "Key not found." });
      return reply.send({ ok: true });
    }
  );
};
