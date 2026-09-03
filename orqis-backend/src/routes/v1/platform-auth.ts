import type { FastifyPluginAsync } from "fastify";
import { connectMongoose } from "../../db/mongoose.js";
import { UserModel } from "../../models/User.js";
import { grantCredits } from "../../platform/credit-mutations.js";
import { hashPassword, passwordProblem, verifyPassword } from "../../platform/password.js";
import { signJwt, TOKEN_TTL_SECONDS } from "../../platform/jwt.js";
import { requireCaller } from "../../platform/caller.js";
import { SIGNUP_BONUS_CREDITS } from "../../platform/billing-config.js";

/**
 * Identity endpoints (Sprint 19). This backend owns users and passwords; the
 * frontend holds only the JWT these routes issue.
 *
 *   POST /v1/auth/register  → create account, grant signup credits, return JWT
 *   POST /v1/auth/login     → verify password, return JWT
 *   GET  /v1/auth/me        → resolve the bearer credential to a user
 */

// Deliberately loose — the spec-compliant email regex is unreadable, and
// wrongly rejecting a valid address is a worse failure than accepting an
// oddly-shaped one.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NAME_LENGTH = 80;

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

type Role = "buyer" | "seller" | "admin";

export const platformAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/register", async (req, reply) => {
    const body = (req.body ?? {}) as { email?: unknown; password?: unknown; name?: unknown };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim().slice(0, MAX_NAME_LENGTH);

    if (!EMAIL_RE.test(email)) {
      return reply.code(400).send({ error: "Enter a valid email address." });
    }
    const problem = passwordProblem(password);
    if (problem) return reply.code(400).send({ error: problem });

    await connectMongoose();

    const existing = await UserModel.findOne({ email }).select("_id").lean();
    if (existing) {
      return reply
        .code(409)
        .send({ error: "An account with that email already exists. Sign in instead." });
    }

    const role: Role = adminEmails().has(email) ? "admin" : "buyer";
    const passwordHash = await hashPassword(password);

    let created;
    try {
      created = await UserModel.create({ email, name, passwordHash, role });
    } catch (err) {
      // Unique index on email — someone registered the same address between
      // the findOne above and this insert.
      if (err && typeof err === "object" && (err as { code?: number }).code === 11000) {
        return reply
          .code(409)
          .send({ error: "An account with that email already exists. Sign in instead." });
      }
      throw err;
    }

    await grantCredits({
      userId: String(created._id),
      amount: SIGNUP_BONUS_CREDITS,
      reason: "signup_bonus",
      note: "Welcome to orqis",
      idempotencyKey: `signup:${created._id}`,
    });

    const token = signJwt({ sub: String(created._id), email, role });
    return reply.code(201).send({
      token,
      expiresIn: TOKEN_TTL_SECONDS,
      user: {
        id: String(created._id),
        email,
        name,
        role,
        creditBalance: SIGNUP_BONUS_CREDITS,
      },
    });
  });

  app.post("/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required." });
    }

    await connectMongoose();
    const user = await UserModel.findOne({ email })
      .select("+passwordHash email name image role creditBalance")
      .lean();

    // Identical response for "no such user" and "wrong password" so this
    // endpoint can't be used to enumerate registered emails.
    const invalid = { error: "That email and password don't match an account." };
    if (!user?.passwordHash) return reply.code(401).send(invalid);
    if (!(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send(invalid);
    }

    // Keep role in step with the ADMIN_EMAILS allowlist on every login:
    // promote if listed, demote out of admin if no longer listed. Non-admin
    // roles are left alone so sellers stay sellers.
    let role = (user.role ?? "buyer") as Role;
    const shouldBeAdmin = adminEmails().has(email);
    if (shouldBeAdmin && role !== "admin") {
      await UserModel.updateOne({ _id: user._id }, { $set: { role: "admin" } });
      role = "admin";
    } else if (!shouldBeAdmin && role === "admin") {
      await UserModel.updateOne({ _id: user._id }, { $set: { role: "buyer" } });
      role = "buyer";
    }

    const token = signJwt({ sub: String(user._id), email: user.email, role });
    return reply.send({
      token,
      expiresIn: TOKEN_TTL_SECONDS,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name ?? "",
        image: user.image ?? "",
        role,
        creditBalance: user.creditBalance ?? 0,
      },
    });
  });

  app.get("/auth/me", { preHandler: requireCaller }, async (req, reply) => {
    const caller = req.caller!;
    await connectMongoose();
    const user = await UserModel.findById(caller.userId)
      .select("email name image role creditBalance")
      .lean();
    if (!user) return reply.code(404).send({ error: "Account no longer exists." });

    return reply.send({
      callerType: caller.type,
      apiKeyId: caller.apiKeyId ?? null,
      scopes: caller.scopes ?? null,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name ?? "",
        image: user.image ?? "",
        role: user.role,
        creditBalance: user.creditBalance ?? 0,
      },
    });
  });
};
