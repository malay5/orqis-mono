import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_R_DIR = path.resolve(__dirname, "..", "storage", "r");

export type BuildAppOpts = {
  logger?: boolean;
  publicBaseUrl?: string;
};

/**
 * Build the owned-services Fastify app. Hosts all 28 in-house orqis agents
 * as a single deployable. orqis-backend (or orqis-frontend's invocation
 * proxy) calls these endpoints over HTTP — same shape any third-party
 * seller's agent gets called through.
 */
export async function buildApp(opts: BuildAppOpts = {}): Promise<FastifyInstance> {
  const PORT = Number(process.env.PORT ?? 4100);
  const PUBLIC_BASE_URL =
    opts.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`;

  const app = Fastify({
    bodyLimit: 32 * 1024 * 1024,
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

  // CORS is locked down by default — the invocation proxy / catalogue
  // backend is the only legitimate caller. Override via CORS_ORIGINS
  // (comma-separated, "*" allowed for dev).
  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:4000")
        .split(",")
        .map((s) => s.trim());
      if (!origin || allowed.includes("*") || allowed.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error("Not allowed by CORS"), false);
    },
  });

  app.get("/", async () => ({
    name: "orqis-owned-services",
    status: "ok",
    version: "0.1.0",
    agentCount: 37,
  }));

  app.get("/health", async () => ({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  // Generated artifacts (page-shot PNGs, pdf-render PDFs, tex-press PDFs,
  // poster-forge images, diagram-forge SVGs, qr PNGs, exif-clean PNGs, etc.)
  // Same /r/ convention as orqis-backend.
  await app.register(staticPlugin, {
    root: STORAGE_R_DIR,
    prefix: "/r/",
    decorateReply: false,
    list: false,
  });

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

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  const PORT = Number(process.env.PORT ?? 4100);
  const HOST = process.env.HOST ?? "0.0.0.0";
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
