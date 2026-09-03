import type { FastifyPluginAsync } from "fastify";
import { connectMongoose } from "../../db/mongoose.js";
import { AgentModel } from "../../models/Agent.js";

/**
 * Sprint 2 placeholder for the public REST search/invoke surface that lands
 * properly in Sprint 10. For now we expose a read-only listing so the frontend
 * (and any curious developer) can confirm the backend is talking to the same
 * MongoDB the frontend writes to.
 */
export const agentsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/agents", async (req, reply) => {
    try {
      await connectMongoose();
    } catch (err) {
      app.log.warn({ err }, "GET /v1/agents — DB unreachable");
      return reply.code(503).send({
        error: "Database unreachable. Set MONGODB_URI and ensure Mongo is running.",
      });
    }

    const docs = await AgentModel.find({ status: "approved" })
      .sort({ invocationCount: -1, createdAt: -1 })
      .lean();

    return {
      count: docs.length,
      agents: docs.map((d) => ({
        slug: d.slug,
        name: d.name,
        tagline: d.tagline,
        category: d.category,
        tags: d.tags ?? [],
        pricePerCall: d.pricePerCall,
        isAsync: d.isAsync,
        ratingAverage: d.ratingAverage,
        ratingCount: d.ratingCount,
        invocationCount: d.invocationCount,
      })),
    };
  });
};
