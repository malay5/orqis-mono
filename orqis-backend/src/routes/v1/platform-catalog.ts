import type { FastifyPluginAsync } from "fastify";
import { connectMongoose } from "../../db/mongoose.js";
import { AgentModel, type AgentDoc } from "../../models/Agent.js";

/**
 * Public catalogue (Sprint 19) — replaces the Sprint 2 read-only placeholder
 * in routes/v1/agents.ts, which existed only to prove the backend could see
 * the same database the frontend was writing to. The frontend now has no
 * database, so this is the catalogue.
 *
 *   GET /v1/catalog/agents          → list, with q / category / async / sort
 *   GET /v1/catalog/agents/:slug    → one agent, full detail
 *
 * No auth: the catalogue is public, same as the browse page it feeds.
 *
 * `endpointUrl`, `authHeaderName` and `authHeaderValueEnc` are NEVER returned.
 * A seller's endpoint and its credentials are ours to call, not the buyer's to
 * see — leaking the URL would let anyone bypass billing by calling it directly.
 */

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 60;

type PublicAgent = ReturnType<typeof toPublic>;

function toPublic(d: AgentDoc) {
  return {
    id: String(d._id),
    slug: d.slug,
    name: d.name,
    tagline: d.tagline,
    description: d.description ?? "",
    longDescription: d.longDescription ?? "",
    category: d.category,
    tags: d.tags ?? [],
    iconEmoji: d.iconEmoji ?? "",
    accentHex: d.accentHex ?? "#a855f7",
    screenshots: d.screenshots ?? [],
    pricePerCall: d.pricePerCall,
    isAsync: d.isAsync ?? false,
    inputSchema: d.inputSchema ?? null,
    outputSchema: d.outputSchema ?? null,
    exampleRequest: d.exampleRequest ?? null,
    exampleResponse: d.exampleResponse ?? null,
    ratingAverage: d.ratingAverage ?? 0,
    ratingCount: d.ratingCount ?? 0,
    invocationCount: d.invocationCount ?? 0,
    // Whether we can actually call it — without disclosing where.
    hasEndpoint: typeof d.endpointUrl === "string" && d.endpointUrl.length > 0,
    publishedAt: d.publishedAt,
  };
}

export const platformCatalogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/catalog/agents", async (req, reply) => {
    const q = req.query as {
      q?: string;
      category?: string;
      async?: string;
      sort?: string;
      limit?: string;
    };

    try {
      await connectMongoose();
    } catch (err) {
      app.log.warn({ err }, "GET /v1/catalog/agents — DB unreachable");
      return reply.code(503).send({
        error: "Database unreachable. Set MONGODB_URI and ensure Mongo is running.",
      });
    }

    // Mongoose 9 no longer exports FilterQuery as a usable named type here;
    // a plain record is enough since this query is built locally.
    const filter: Record<string, unknown> = { status: "approved" };

    const term = (q.q ?? "").trim();
    if (term) {
      // Regex rather than the text index: buyers type partial words
      // ("scrap", "chat") and $text only matches whole tokens.
      const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { tagline: rx }, { description: rx }, { tags: rx }];
    }
    if (q.category && q.category !== "All") filter.category = q.category;
    if (q.async === "true") filter.isAsync = true;
    if (q.async === "false") filter.isAsync = false;

    const sort: Record<string, 1 | -1> =
      q.sort === "price"
        ? { pricePerCall: 1 }
        : q.sort === "rating"
          ? { ratingAverage: -1, ratingCount: -1 }
          : q.sort === "newest"
            ? { publishedAt: -1 }
            : { invocationCount: -1, createdAt: -1 };

    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(q.limit) || DEFAULT_LIMIT));

    const docs = await AgentModel.find(filter).sort(sort).limit(limit).lean<AgentDoc[]>();
    const agents: PublicAgent[] = docs.map(toPublic);

    return reply.send({ count: agents.length, agents });
  });

  app.get("/catalog/agents/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };

    try {
      await connectMongoose();
    } catch (err) {
      app.log.warn({ err }, "GET /v1/catalog/agents/:slug — DB unreachable");
      return reply.code(503).send({ error: "Database unreachable." });
    }

    const doc = await AgentModel.findOne({
      slug: String(slug).toLowerCase(),
      status: "approved",
    }).lean<AgentDoc>();

    if (!doc) return reply.code(404).send({ error: `No agent named "${slug}".` });
    return reply.send({ agent: toPublic(doc) });
  });

  app.get("/catalog/categories", async (_req, reply) => {
    try {
      await connectMongoose();
    } catch {
      return reply.code(503).send({ error: "Database unreachable." });
    }
    const rows = await AgentModel.aggregate<{ _id: string; count: number }>([
      { $match: { status: "approved" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return reply.send({
      categories: rows.map((r) => ({ category: r._id, count: r.count })),
    });
  });
};
