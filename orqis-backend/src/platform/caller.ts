import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyJwt } from "./jwt.js";
import { validateApiKey } from "./api-keys.js";
import { connectMongoose } from "../db/mongoose.js";
import { UserModel } from "../models/User.js";

/**
 * Resolves who is making a request (Sprint 19).
 *
 * Ported from the frontend's `require-caller.ts`, with one substantive change:
 * where that resolved a NextAuth *cookie session*, this resolves a *bearer
 * JWT* that this backend issued. The frontend no longer has a database or a
 * session of its own — it holds the JWT and forwards it. That is the whole
 * point of the decoupling.
 *
 * Two accepted credentials, both on `Authorization: Bearer …`:
 *   1. `or_live_…`  — a user's API key (SDK, MCP, curl).
 *   2. anything else — a JWT from POST /v1/auth/login.
 *
 * `callerType` is carried onto Invocation rows so analytics can separate UI
 * traffic from programmatic traffic.
 */

export type CallerType = "session" | "api_key";

export type Caller = {
  userId: string;
  type: CallerType;
  email?: string;
  role?: "buyer" | "seller" | "admin";
  apiKeyId?: string;
  scopes?: string[];
};

declare module "fastify" {
  interface FastifyRequest {
    caller?: Caller;
  }
}

function bearer(req: FastifyRequest): string | null {
  const raw = req.headers.authorization;
  if (!raw) return null;
  const m = raw.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

export async function resolveCaller(req: FastifyRequest): Promise<Caller | null> {
  const token = bearer(req);
  if (!token) return null;

  // API keys are distinguishable by prefix, so we never have to try a JWT
  // verify against a key (or vice versa) and guess from the failure.
  if (token.startsWith("or_live_")) {
    const resolved = await validateApiKey(token);
    if (!resolved) return null;
    return {
      userId: resolved.userId,
      type: "api_key",
      apiKeyId: resolved.apiKeyId,
      scopes: resolved.scopes,
    };
  }

  const verified = verifyJwt(token);
  if (!verified.ok) return null;
  return {
    userId: verified.payload.sub,
    type: "session",
    email: verified.payload.email,
    role: verified.payload.role,
  };
}

export function callerCanInvoke(caller: Caller): boolean {
  if (caller.type === "session") return true;
  return (caller.scopes ?? []).includes("invoke");
}

/**
 * Fastify preHandler: 401s unless a valid credential is present, and attaches
 * `req.caller` for the route body.
 */
export async function requireCaller(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const caller = await resolveCaller(req);
  if (!caller) {
    await reply.code(401).send({
      error: "Sign in or pass an Authorization: Bearer or_live_… header.",
    });
    return;
  }
  req.caller = caller;
}

/**
 * The caller's role, looked up if the credential doesn't carry one.
 *
 * A JWT embeds the role; an API key doesn't. Reading `caller.role` directly
 * would silently treat every API-key caller as a non-admin.
 */
export async function callerRole(caller: Caller): Promise<Caller["role"]> {
  if (caller.role) return caller.role;
  await connectMongoose();
  const user = await UserModel.findById(caller.userId).select("role").lean();
  caller.role = (user?.role as Caller["role"]) ?? undefined;
  return caller.role;
}

/**
 * Fastify preHandler: as requireCaller, plus an admin role check.
 *
 * A JWT caller carries its role in the token. An API-key caller doesn't, so we
 * read the role from the database rather than treating "no role on the caller"
 * as "not an admin" — that would silently lock admins out of every endpoint
 * when using a key, which is the kind of bug that looks like a permissions
 * mystery rather than a missing lookup.
 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const caller = await resolveCaller(req);
  if (!caller) {
    await reply.code(401).send({ error: "Authentication required." });
    return;
  }

  let role = caller.role;
  if (!role) {
    await connectMongoose();
    const user = await UserModel.findById(caller.userId).select("role").lean();
    role = (user?.role as Caller["role"]) ?? undefined;
    caller.role = role;
  }

  if (role !== "admin") {
    await reply.code(403).send({ error: "Admin access required." });
    return;
  }
  req.caller = caller;
}
