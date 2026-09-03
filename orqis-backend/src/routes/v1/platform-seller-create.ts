import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import { connectMongoose } from "../../db/mongoose.js";
import { AgentModel } from "../../models/Agent.js";
import { UserModel } from "../../models/User.js";
import { AgentSubmissionModel } from "../../models/AgentSubmission.js";
import { CreditTransactionModel } from "../../models/CreditTransaction.js";
import { encryptString } from "../../platform/crypto-server.js";
import { normalizeSlug } from "../../platform/seller-agents.js";
import { requireCaller, requireAdmin } from "../../platform/caller.js";

/**
 * Seller listing creation + admin overview stats (Sprint 19).
 *
 *   POST /v1/seller/agents  → create a listing (status "pending")
 *   GET  /v1/admin/stats    → counts for the admin overview page
 *
 * The seller's auth header value is encrypted at rest here with
 * ENCRYPTION_KEY; the plaintext never round-trips back to any client.
 */

const MAX_TAGLINE = 140;
const MAX_DESCRIPTION = 8000;

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function safeUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const platformSellerCreateRoutes: FastifyPluginAsync = async (app) => {
  app.post("/seller/agents", { preHandler: requireCaller }, async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name = clip(body.name, 80);
    const tagline = clip(body.tagline, MAX_TAGLINE);
    const description = clip(body.description, MAX_DESCRIPTION) ?? "";
    const longDescription = clip(body.longDescription, MAX_DESCRIPTION) ?? "";
    const category = clip(body.category, 60);
    const slugInput = clip(body.slug, 60);
    const endpointUrl = safeUrl(body.endpointUrl);
    const pricePerCallRaw = Number(body.pricePerCall);
    const isAsync = body.isAsync === true;

    if (!name) return reply.code(400).send({ error: "Name is required." });
    if (!tagline) return reply.code(400).send({ error: "Tagline is required." });
    if (!category) return reply.code(400).send({ error: "Category is required." });
    if (!endpointUrl) {
      return reply.code(400).send({ error: "A valid http(s) endpoint URL is required." });
    }
    if (!Number.isFinite(pricePerCallRaw) || pricePerCallRaw < 0) {
      return reply.code(400).send({ error: "pricePerCall must be a non-negative number." });
    }
    const pricePerCall = Math.floor(pricePerCallRaw);

    const slug = normalizeSlug(slugInput || name);
    if (slug.length < 3) {
      return reply.code(400).send({ error: "Slug must be at least 3 characters." });
    }

    const tags = Array.isArray(body.tags)
      ? (body.tags as unknown[])
          .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : ""))
          .filter(Boolean)
          .slice(0, 12)
      : [];
    const screenshots = Array.isArray(body.screenshots)
      ? (body.screenshots as unknown[])
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean)
          .slice(0, 6)
      : [];
    const iconEmoji = clip(body.iconEmoji, 8) ?? "✨";
    const accentHex =
      typeof body.accentHex === "string" && /^#[0-9a-f]{6}$/i.test(body.accentHex)
        ? body.accentHex
        : "#a855f7";

    const inputSchema = isObject(body.inputSchema) ? body.inputSchema : null;
    const outputSchema = isObject(body.outputSchema) ? body.outputSchema : null;
    const exampleRequest = isObject(body.exampleRequest) ? body.exampleRequest : null;
    const exampleResponse = isObject(body.exampleResponse) ? body.exampleResponse : null;

    const authHeaderName = clip(body.authHeaderName, 80) ?? "";
    const authHeaderValuePlain =
      typeof body.authHeaderValue === "string" ? body.authHeaderValue : "";
    if (authHeaderName && !authHeaderValuePlain) {
      return reply
        .code(400)
        .send({ error: "If you set an auth header name you must also provide its value." });
    }
    let authHeaderValueEnc = "";
    if (authHeaderValuePlain) {
      try {
        authHeaderValueEnc = encryptString(authHeaderValuePlain);
      } catch (err) {
        return reply.code(500).send({
          error: err instanceof Error ? err.message : "Failed to encrypt auth header.",
        });
      }
    }

    await connectMongoose();

    // Surface a clean conflict rather than Mongo's E11000.
    const existing = await AgentModel.findOne({ slug }).select("_id").lean();
    if (existing) {
      return reply.code(409).send({ error: "That slug is already taken — try another." });
    }

    const created = await AgentModel.create({
      slug,
      name,
      tagline,
      description,
      longDescription,
      category,
      tags,
      iconEmoji,
      accentHex,
      screenshots,
      pricePerCall,
      isAsync,
      inputSchema,
      outputSchema,
      exampleRequest,
      exampleResponse,
      sellerId: new Types.ObjectId(req.caller!.userId),
      endpointUrl,
      authHeaderName,
      authHeaderValueEnc,
      // Never "approved" on create — listings go through admin review.
      status: "pending",
    });

    return reply.send({
      ok: true,
      id: String(created._id),
      slug: created.slug,
      status: created.status,
    });
  });

  app.get("/admin/stats", { preHandler: requireAdmin }, async (_req, reply) => {
    await connectMongoose();
    const [userCount, pendingSubmissions, pendingListings, granted, charged] = await Promise.all([
      UserModel.countDocuments(),
      AgentSubmissionModel.countDocuments({ status: "new" }),
      AgentModel.countDocuments({ sellerId: { $ne: null }, status: "pending" }),
      CreditTransactionModel.aggregate<{ _id: null; sum: number }>([
        { $match: { delta: { $gt: 0 } } },
        { $group: { _id: null, sum: { $sum: "$delta" } } },
      ]).then((rows) => rows[0]?.sum ?? 0),
      CreditTransactionModel.aggregate<{ _id: null; sum: number }>([
        { $match: { delta: { $lt: 0 } } },
        { $group: { _id: null, sum: { $sum: "$delta" } } },
      ]).then((rows) => Math.abs(rows[0]?.sum ?? 0)),
    ]);
    return reply.send({
      userCount,
      pendingSubmissions,
      pendingListings,
      totalGranted: granted,
      totalCharged: charged,
    });
  });
};
