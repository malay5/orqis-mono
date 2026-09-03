# orqis — the whole platform in one container.
#
# Runs two Node processes side by side:
#
#   orqis-backend   Fastify. Platform API + all 40 agent runtimes.
#                   Bound to 127.0.0.1:4000 — NOT published.
#   orqis-frontend  Next.js standalone. Listens on $PORT. The only way in.
#
# The frontend already proxies every backend call through its own route
# handlers, so the browser never needs to reach Fastify directly. That's what
# makes a single published port possible: one service to deploy, one URL, one
# TLS certificate.
#
# MongoDB is NOT in here. A database in the same container as the app dies
# with every redeploy; point MONGODB_URI at Atlas.
#
# Build:  docker build -t orqis .
# Run:    docker run -p 3000:3000 --env-file .env orqis

# ── Stage 1: build the backend ───────────────────────────────────────
FROM node:22-bookworm-slim AS backend-build
WORKDIR /build/orqis-backend

COPY orqis-backend/package*.json ./
# Dev deps needed here — the build is `tsc`.
RUN npm ci

COPY orqis-backend/tsconfig.json ./
COPY orqis-backend/src ./src
COPY orqis-backend/scripts ./scripts
RUN npm run build

# Re-resolve to production dependencies only, so the runtime stage doesn't
# carry typescript, tsx and the @types tree.
RUN npm ci --omit=dev

# ── Stage 2: build the frontend ──────────────────────────────────────
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /build

COPY orqis-frontend/package*.json ./orqis-frontend/
WORKDIR /build/orqis-frontend
RUN npm ci

COPY orqis-frontend/ ./
# `output: "standalone"` emits a self-contained server plus only the
# node_modules the traced import graph actually reaches — 31 MB instead of the
# full tree, which includes an 89 MB API-reference package.
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# Shared libraries the image genuinely needs:
#   - sharp (image agents) wants libvips' runtime deps
#   - fonts-noto-color-emoji so generated OG cards render agent emoji rather
#     than tofu boxes
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    # Backend listens on loopback only. Even if someone published 4000, it
    # would refuse the connection.
    ORQIS_BACKEND_PORT=4000 \
    ORQIS_BACKEND_HOST=127.0.0.1 \
    # How the frontend reaches the backend, in-container.
    ORQIS_API_URL=http://127.0.0.1:4000 \
    # Agents live inside the backend process, so its invocation proxy calls
    # back into itself over loopback.
    OWNED_SERVICES_BASE_URL=http://127.0.0.1:4000 \
    PUBLIC_BASE_URL=http://127.0.0.1:4000

WORKDIR /app

# Backend: compiled output + production deps.
COPY --from=backend-build /build/orqis-backend/dist          ./orqis-backend/dist
COPY --from=backend-build /build/orqis-backend/node_modules  ./orqis-backend/node_modules
COPY --from=backend-build /build/orqis-backend/package.json  ./orqis-backend/package.json
# The seed entry point lives in src/cli/seed.ts, so it compiles into dist/
# alongside everything else. It used to sit in scripts/ and run through tsx —
# which does not survive `npm ci --omit=dev`, so `npm run seed` was broken in
# the image. Run it here with: npm run seed:prod

# Frontend: the standalone server, plus the two things standalone does NOT
# include — static assets and public/.
COPY --from=frontend-build /build/orqis-frontend/.next/standalone/          ./
COPY --from=frontend-build /build/orqis-frontend/.next/static               ./orqis-frontend/.next/static
COPY --from=frontend-build /build/orqis-frontend/public                     ./orqis-frontend/public

COPY docker/start.js ./docker/start.js

# Artifact scratch space for file-emitting agents. Ephemeral by nature —
# every redeploy wipes it, which is why R2 is on the roadmap.
RUN mkdir -p /app/orqis-backend/storage/r \
 && chown -R node:node /app

USER node
EXPOSE 3000

# No shell wrapper: node is PID 1 so SIGTERM reaches it directly and the
# supervisor can shut both children down cleanly.
CMD ["node", "docker/start.js"]
