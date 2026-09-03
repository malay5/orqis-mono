// Must be first: populates process.env from .env before anything reads config.
import "./platform/load-env.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import mongoose from "mongoose";
import { connectMongoose } from "./db/mongoose.js";
import { agentsRoutes } from "./routes/v1/agents.js";
import { mockRoutes } from "./routes/v1/mock.js";
import { makeLandingForgeRoutes } from "./routes/v1/landing-forge.js";
import { makeImgShrinkRoutes } from "./routes/v1/img-shrink.js";
import { demoForgeRoutes } from "./routes/v1/demo-forge.js";
import { resumeRxRoutes } from "./routes/v1/resume-rx.js";
import { courseQuillRoutes } from "./routes/v1/course-quill.js";
import { makePosterForgeRoutes } from "./routes/v1/poster-forge.js";
import { utilityAgentRoutes } from "./routes/v1/utility-agents.js";
import { makeTierARoutes } from "./routes/v1/tier-a-agents.js";
import { makeTierBRoutes } from "./routes/v1/tier-b-agents.js";
import { makeTierCBrowserRoutes } from "./routes/v1/tier-c-browser.js";
import { tierCUtilityRoutes } from "./routes/v1/tier-c-utility.js";
import { makeTierDLlmRoutes } from "./routes/v1/tier-d-llm.js";
// Sprint 19 — the platform API. These routes own users, credits and the
// catalogue; the frontend is a client of them and holds no database.
import { platformAuthRoutes } from "./routes/v1/platform-auth.js";
import { platformCreditRoutes } from "./routes/v1/platform-credits.js";
import { platformCatalogRoutes } from "./routes/v1/platform-catalog.js";
import { platformInvokeRoutes } from "./routes/v1/platform-invoke.js";
import { platformJobRoutes } from "./routes/v1/platform-jobs.js";
import { platformKeyRoutes } from "./routes/v1/platform-keys.js";
import { platformMiscRoutes } from "./routes/v1/platform-misc.js";
import { platformSellerRoutes } from "./routes/v1/platform-seller.js";
import { platformSellerCreateRoutes } from "./routes/v1/platform-seller-create.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_R_DIR = path.resolve(__dirname, "..", "storage", "r");

export type BuildAppOpts = {
  logger?: boolean;
  connectDb?: boolean;
  publicBaseUrl?: string;
};

/**
 * Build (but don't `listen`) the Fastify app. Factored out so the smoke
 * test in `scripts/smoke-tier-a-b.ts` can drive routes via `app.inject(…)`
 * without opening a port.
 */
export async function buildApp(opts: BuildAppOpts = {}): Promise<FastifyInstance> {
  const PORT = Number(process.env.PORT ?? 4000);
  const PUBLIC_BASE_URL =
    opts.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`;

  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            transport:
              process.env.NODE_ENV === "production"
                ? undefined
                : { target: "pino-pretty", options: { colorize: true } },
          },
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
        .split(",")
        .map((s) => s.trim());
      if (!origin || allowed.includes("*") || allowed.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error("Not allowed by CORS"), false);
    },
  });

  if (opts.connectDb !== false) {
    try {
      if (process.env.MONGODB_URI) {
        await connectMongoose();
        app.log.info({ db: "mongo" }, "connected to MongoDB");
      } else {
        app.log.warn("MONGODB_URI is not set — running without a database (Sprint 2 placeholder).");
      }
    } catch (err) {
      app.log.warn({ err }, "could not connect to MongoDB at boot — will retry on first DB request");
    }
  }

  app.get("/", async () => ({
    name: "orqis-backend",
    status: "ok",
    message: "hello from orqis",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  }));

  app.get("/health", async () => ({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: {
      state: mongoose.connection.readyState,
      name: mongoose.connection.name ?? null,
    },
  }));

  await app.register(staticPlugin, {
    root: STORAGE_R_DIR,
    prefix: "/r/",
    decorateReply: false,
    list: false,
  });

  // Platform API (Sprint 19) — registered before the agent runtimes so a
  // route-name collision surfaces at boot rather than as a silent shadow.
  await app.register(platformAuthRoutes, { prefix: "/v1" });
  await app.register(platformCreditRoutes, { prefix: "/v1" });
  await app.register(platformCatalogRoutes, { prefix: "/v1" });
  await app.register(platformInvokeRoutes, { prefix: "/v1" });
  await app.register(platformJobRoutes, { prefix: "/v1" });
  await app.register(platformKeyRoutes, { prefix: "/v1" });
  await app.register(platformMiscRoutes, { prefix: "/v1" });
  await app.register(platformSellerRoutes, { prefix: "/v1" });
  await app.register(platformSellerCreateRoutes, { prefix: "/v1" });

  await app.register(agentsRoutes, { prefix: "/v1" });
  await app.register(mockRoutes, { prefix: "/v1" });
  await app.register(
    makeLandingForgeRoutes({ storageDir: STORAGE_R_DIR, publicBaseUrl: PUBLIC_BASE_URL }),
    { prefix: "/v1" }
  );
  await app.register(
    makeImgShrinkRoutes({ storageDir: STORAGE_R_DIR, publicBaseUrl: PUBLIC_BASE_URL }),
    { prefix: "/v1" }
  );
  await app.register(demoForgeRoutes, { prefix: "/v1" });
  await app.register(resumeRxRoutes, { prefix: "/v1" });
  await app.register(courseQuillRoutes, { prefix: "/v1" });
  await app.register(
    makePosterForgeRoutes({ storageDir: STORAGE_R_DIR, publicBaseUrl: PUBLIC_BASE_URL }),
    { prefix: "/v1" }
  );
  await app.register(utilityAgentRoutes, { prefix: "/v1" });
  await app.register(
    makeTierARoutes({ storageDir: STORAGE_R_DIR, publicBaseUrl: PUBLIC_BASE_URL }),
    { prefix: "/v1" }
  );
  await app.register(
    makeTierBRoutes({ storageDir: STORAGE_R_DIR, publicBaseUrl: PUBLIC_BASE_URL }),
    { prefix: "/v1" }
  );
  await app.register(
    makeTierCBrowserRoutes({ storageDir: STORAGE_R_DIR, publicBaseUrl: PUBLIC_BASE_URL }),
    { prefix: "/v1" }
  );
  await app.register(tierCUtilityRoutes, { prefix: "/v1" });
  await app.register(
    makeTierDLlmRoutes({ storageDir: STORAGE_R_DIR, publicBaseUrl: PUBLIC_BASE_URL }),
    { prefix: "/v1" }
  );

  return app;
}

// Boot when this module is the entrypoint. Skipped when imported by the
// smoke test, which drives routes via app.inject().
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  // Sprint 19: fail fast on secrets that are set-but-empty. AUTH_SECRET was
  // blank in the frontend's .env.local and the only symptom was an opaque 500
  // on every auth route — hours to diagnose, one line to catch.
  const required = ["AUTH_SECRET", "MONGODB_URI"] as const;
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    console.error(
      `\norqis-backend cannot start: ${missing.join(", ")} ${
        missing.length === 1 ? "is" : "are"
      } missing or empty.\n` +
        `Set ${missing.length === 1 ? "it" : "them"} in orqis-backend/.env — see .env.example.\n`
    );
    process.exit(1);
  }

  const PORT = Number(process.env.PORT ?? 4000);
  const HOST = process.env.HOST ?? "0.0.0.0";
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
