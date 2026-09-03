import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import { connectMongoose } from "../../db/mongoose.js";
import { AgentModel } from "../../models/Agent.js";
import { UserModel } from "../../models/User.js";
import { AgentSubmissionModel } from "../../models/AgentSubmission.js";
import {
  getReviewsForAgent,
  getMyReviewForAgent,
  upsertReview,
} from "../../platform/reviews.js";
import { hasSucceededInvocation, recentInvocationsForUser } from "../../platform/invocations.js";
import { listUsers, listAgentSubmissions } from "../../platform/admin.js";
import { grantCredits } from "../../platform/credit-mutations.js";
import { requireCaller, requireAdmin } from "../../platform/caller.js";

/**
 * Reviews, activity, seller intake and admin (Sprint 19).
 *
 * These are the lower-traffic platform endpoints that moved out of the Next
 * app along with everything else. Grouped into one plugin because each is only
 * a handful of routes and they share no state.
 */

const MAX_NAME = 120;

export const platformMiscRoutes: FastifyPluginAsync = async (app) => {
  // ── Reviews ────────────────────────────────────────────────────
  app.get<{ Params: { slug: string } }>("/agents/:slug/reviews", async (req, reply) => {
    await connectMongoose();
    const agent = await AgentModel.findOne({ slug: req.params.slug }).select("_id").lean();
    if (!agent) return reply.code(404).send({ error: "Agent not found." });
    const reviews = await getReviewsForAgent(String(agent._id));
    return reply.send({ count: reviews.length, reviews });
  });

  app.post<{ Params: { slug: string } }>(
    "/agents/:slug/reviews",
    { preHandler: requireCaller },
    async (req, reply) => {
      const userId = req.caller!.userId;
      await connectMongoose();
      const agent = await AgentModel.findOne({ slug: req.params.slug }).select("_id").lean();
      if (!agent) return reply.code(404).send({ error: "Agent not found." });

      const body = (req.body ?? {}) as {
        rating?: unknown;
        title?: unknown;
        body?: unknown;
      };
      const rating = Number(body.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return reply.code(400).send({ error: "rating must be between 1 and 5." });
      }

      const user = await UserModel.findById(userId).select("name image").lean();
      const review = await upsertReview({
        agentId: String(agent._id),
        userId,
        rating,
        title: typeof body.title === "string" ? body.title : "",
        body: typeof body.body === "string" ? body.body : "",
        authorName: user?.name ?? "",
        authorImage: user?.image ?? "",
      });

      // verifiedUse is a trust signal — only true if this user actually ran
      // the agent successfully at least once.
      const verified = await hasSucceededInvocation(userId, String(agent._id));
      return reply.send({ review: { ...review, verifiedUse: verified } });
    }
  );

  app.get<{ Params: { slug: string } }>(
    "/agents/:slug/reviews/mine",
    { preHandler: requireCaller },
    async (req, reply) => {
      await connectMongoose();
      const agent = await AgentModel.findOne({ slug: req.params.slug }).select("_id").lean();
      if (!agent) return reply.code(404).send({ error: "Agent not found." });
      const review = await getMyReviewForAgent(String(agent._id), req.caller!.userId);
      return reply.send({ review });
    }
  );

  // ── Activity ───────────────────────────────────────────────────
  app.get("/activity", { preHandler: requireCaller }, async (req, reply) => {
    const q = req.query as { limit?: string };
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const invocations = await recentInvocationsForUser(req.caller!.userId, limit);
    return reply.send({ count: invocations.length, invocations });
  });

  // ── Seller intake (public) ─────────────────────────────────────
  app.post("/list-agent", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const contactEmail = String(body.contactEmail ?? body.email ?? "").trim().toLowerCase();
    const agentName = String(body.agentName ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail)) {
      return reply.code(400).send({ error: "Enter a valid contact email." });
    }
    if (!agentName) return reply.code(400).send({ error: "agentName is required." });
    if (!description) return reply.code(400).send({ error: "description is required." });

    await connectMongoose();
    const created = await AgentSubmissionModel.create({
      contactEmail,
      contactName: String(body.contactName ?? "").slice(0, MAX_NAME),
      agentName: agentName.slice(0, 200),
      description: description.slice(0, 5000),
      endpointUrl: String(body.endpointUrl ?? "").slice(0, 2000),
      pricingIdea: String(body.pricingIdea ?? "").slice(0, 500),
      links: String(body.links ?? "").slice(0, 2000),
      userAgent: (req.headers["user-agent"] ?? "").toString().slice(0, 500),
    });
    return reply.code(201).send({ ok: true, submissionId: String(created._id) });
  });

  // ── Admin ──────────────────────────────────────────────────────
  app.get("/admin/users", { preHandler: requireAdmin }, async (req, reply) => {
    const q = req.query as { limit?: string };
    const users = await listUsers(Math.min(500, Math.max(1, Number(q.limit) || 100)));
    return reply.send({ count: users.length, users });
  });

  app.get("/admin/submissions", { preHandler: requireAdmin }, async (req, reply) => {
    const q = req.query as { status?: string };
    const status = (q.status ?? "new") as Parameters<typeof listAgentSubmissions>[0];
    const submissions = await listAgentSubmissions(status);
    return reply.send({ count: submissions.length, submissions });
  });

  app.post("/admin/grant-credits", { preHandler: requireAdmin }, async (req, reply) => {
    const body = (req.body ?? {}) as { email?: unknown; amount?: unknown; note?: unknown };
    const email = String(body.email ?? "").trim().toLowerCase();
    const amount = Number(body.amount);

    if (!email) return reply.code(400).send({ error: "email is required." });
    // Negative amounts are allowed here and only here — an admin_grant is how
    // a mistaken credit gets clawed back.
    if (!Number.isInteger(amount) || amount === 0) {
      return reply.code(400).send({ error: "amount must be a non-zero integer." });
    }

    await connectMongoose();
    const target = await UserModel.findOne({ email }).select("_id").lean();
    if (!target) return reply.code(404).send({ error: `No user with email ${email}.` });

    const result = await grantCredits({
      userId: String(target._id),
      amount,
      reason: "admin_grant",
      note: typeof body.note === "string" ? body.note.slice(0, 500) : "",
      grantedByUserId: req.caller!.userId,
    });
    return reply.send({ ok: true, ...result });
  });

  app.post("/admin/agent-status", { preHandler: requireAdmin }, async (req, reply) => {
    const body = (req.body ?? {}) as { slug?: unknown; status?: unknown };
    const slug = String(body.slug ?? "").trim().toLowerCase();
    const status = String(body.status ?? "");
    const allowed = ["draft", "pending", "approved", "rejected"];
    if (!slug) return reply.code(400).send({ error: "slug is required." });
    if (!allowed.includes(status)) {
      return reply.code(400).send({ error: `status must be one of: ${allowed.join(", ")}` });
    }

    await connectMongoose();
    const res = await AgentModel.updateOne({ slug }, { $set: { status } });
    if (res.matchedCount === 0) {
      return reply.code(404).send({ error: `No agent with slug ${slug}.` });
    }
    return reply.send({ ok: true, slug, status });
  });

  app.post("/admin/submission-status", { preHandler: requireAdmin }, async (req, reply) => {
    const body = (req.body ?? {}) as { id?: unknown; status?: unknown };
    const id = String(body.id ?? "");
    const status = String(body.status ?? "");
    const allowed = ["new", "reviewing", "approved", "rejected"];
    if (!Types.ObjectId.isValid(id)) {
      return reply.code(400).send({ error: "Valid submission id required." });
    }
    if (!allowed.includes(status)) {
      return reply.code(400).send({ error: `status must be one of: ${allowed.join(", ")}` });
    }
    await connectMongoose();
    const res = await AgentSubmissionModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { status } }
    );
    if (res.matchedCount === 0) return reply.code(404).send({ error: "Submission not found." });
    return reply.send({ ok: true, id, status });
  });
};
