import type { FastifyPluginAsync } from "fastify";
import { listSellerAgents, listPendingListings } from "../../platform/seller-agents.js";
import { loadAgentAnalytics } from "../../platform/seller-analytics.js";
import { requireCaller, requireAdmin, callerRole } from "../../platform/caller.js";

/**
 * Seller-facing routes (Sprint 19).
 *
 *   GET /v1/seller/agents                  → listings owned by the caller
 *   GET /v1/seller/agents/:slug/analytics  → per-agent usage, owner-scoped
 *   GET /v1/admin/listings                 → pending listings awaiting review
 *
 * Ownership on the analytics route is enforced here, not just in the query:
 * a seller must not be able to read another seller's revenue by guessing a
 * slug.
 */

export const platformSellerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/seller/agents", { preHandler: requireCaller }, async (req, reply) => {
    const agents = await listSellerAgents(req.caller!.userId);
    return reply.send({ count: agents.length, agents });
  });

  app.get<{ Params: { slug: string } }>(
    "/seller/agents/:slug/analytics",
    { preHandler: requireCaller },
    async (req, reply) => {
      const caller = req.caller!;
      const role = await callerRole(caller);

      // loadAgentAnalytics performs the ownership check itself and returns
      // null for both "no such agent" and "not yours" — deliberately, so a
      // 404 here doesn't confirm another seller's listing exists.
      const analytics = await loadAgentAnalytics({
        slug: req.params.slug,
        callerUserId: caller.userId,
        callerIsAdmin: role === "admin",
      });
      if (!analytics) return reply.code(404).send({ error: "Agent not found." });
      return reply.send({ analytics });
    }
  );

  app.get("/admin/listings", { preHandler: requireAdmin }, async (_req, reply) => {
    const listings = await listPendingListings();
    return reply.send({ count: listings.length, listings });
  });
};
