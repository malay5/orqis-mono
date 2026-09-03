# orqis-owned-services — Fastify app hosting all 28 in-house orqis agents.
# Built for Railway / Fly / any container host. Pre-warms Playwright Chromium
# so the first browser-dep call doesn't stall on a 170 MB download.

FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=4100 \
    PLAYWRIGHT_BROWSERS_PATH=/app/.playwright

WORKDIR /app

# System deps:
# - chromium runtime libs (Playwright bundle ships its own browser but needs these system shared libs)
# - tectonic + pandoc are optional — uncomment if you want tex-press / doc-converter to flip to real mode
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libatspi2.0-0 \
    fonts-liberation fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*

# Copy package files first for layer caching.
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Pre-install Chromium so we don't redo it per request.
RUN npx playwright install chromium

# Source + build.
COPY tsconfig.json ./
COPY src ./src
RUN npm install --no-save typescript@^5.7.2 \
 && npx tsc -p tsconfig.json \
 && npm prune --omit=dev

# Ephemeral artifact dir; real deploys should mount R2 / S3 here instead.
RUN mkdir -p storage/r

EXPOSE 4100
CMD ["node", "dist/server.js"]
