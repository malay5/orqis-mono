/**
 * Seed script — upserts SEED_AGENTS into MongoDB.
 *
 * Moved here from orqis-frontend in Sprint 19: the database belongs to this
 * service now, so the script that populates it does too.
 *
 * Usage:
 *   cd orqis-backend
 *   npm run seed
 *
 *   # point the catalogue at a different agent host
 *   OWNED_SERVICES_BASE_URL=https://owned-services.orqis.xyz npm run seed
 *
 * Idempotent — safe to re-run. Updates documents in place rather than
 * deleting and re-inserting, so reviews and invocation counts on a seeded
 * agent survive a re-seed.
 */

import "../src/platform/load-env.js";
import mongoose from "mongoose";
import { connectMongoose } from "../src/db/mongoose.js";
import { AgentModel } from "../src/models/Agent.js";
import { SEED_AGENTS } from "../src/data/seed-agents.js";
import { resolveSeedEndpoint } from "../src/platform/seed-endpoint.js";

async function main(): Promise<void> {
  await connectMongoose();
  console.log(`[seed] connected to ${process.env.MONGODB_URI}`);

  let upserted = 0;
  for (const a of SEED_AGENTS) {
    const res = await AgentModel.updateOne(
      { slug: a.slug },
      {
        $set: {
          name: a.name,
          tagline: a.tagline,
          description: a.description,
          longDescription: a.longDescription,
          category: a.category,
          tags: a.tags,
          iconEmoji: a.iconEmoji,
          accentHex: a.accentHex,
          screenshots: a.screenshots,
          pricePerCall: a.pricePerCall,
          isAsync: a.isAsync,
          inputSchema: a.inputSchema,
          outputSchema: a.outputSchema,
          exampleRequest: a.exampleRequest,
          exampleResponse: a.exampleResponse,
          ratingAverage: a.ratingAverage,
          ratingCount: a.ratingCount,
          invocationCount: a.invocationCount,
          // Seeded agents are ours, so they skip review. The schema default
          // is "pending" precisely so nothing else can self-approve.
          status: "approved",
          endpointUrl: resolveSeedEndpoint(a.endpointUrl),
        },
        $setOnInsert: { publishedAt: new Date() },
      },
      { upsert: true }
    );
    if (res.upsertedCount > 0) upserted++;
    console.log(`[seed] ${a.slug} ${res.upsertedCount > 0 ? "(new)" : "(updated)"}`);
  }

  console.log(`[seed] done — ${SEED_AGENTS.length} agents (${upserted} new).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
