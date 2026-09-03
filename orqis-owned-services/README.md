# orqis-owned-services

The Fastify app that hosts every orqis-in-house agent endpoint. Deployed
independently from `orqis-backend` so the platform-level code (catalogue,
invocation proxy, billing, webhooks) can ship on its own cadence and
scale independently from the agent runtimes.

**Why it exists**

The whole orqis pitch is "every listing is just an HTTPS endpoint with a
JSON Schema". To prove that contract works end-to-end, we eat our own
dog food: our 28 agents are exposed exactly the way a third-party seller
would expose theirs — via this service — and `orqis-backend`'s invocation
proxy treats them like any other seller agent.

Practically that means:

- Independent deploys (push landing-forge fixes without redeploying the
  catalogue API).
- Independent scaling (page-shot spins Chromium; rng-uniform doesn't —
  scale them differently).
- Failure isolation (a Playwright crash in pdf-render doesn't take
  email-truth down).
- The seller flow has a real, in-production reference implementation —
  third-party sellers can read these route handlers as examples.

## Architecture

```
                 ┌──────────────────┐
buyer browser ──►│  orqis-frontend  │   Next.js. Auth, catalogue UI,
or AI agent      │  (Vercel)        │   invocation proxy, ledger.
                 └────────┬─────────┘
                          │  POST /v1/agents/:slug/invoke
                          ▼
                 ┌──────────────────┐
                 │  orqis-backend   │   Fastify. (Optional intermediate
                 │  (Railway)       │   layer if/when we split routing
                 └────────┬─────────┘   off the frontend.)
                          │  HTTPS POST with input + webhook headers
                          ▼
                 ┌──────────────────┐
                 │  orqis-owned-    │   THIS SERVICE.
                 │  services        │   28 agents over HTTP. Stateless
                 │  (Railway/Fly)   │   except artifact storage at /r/.
                 └──────────────────┘
```

For now `orqis-frontend` points its in-house agent `endpointUrl` fields at
`http://localhost:4000/v1/agents/<slug>/run` (i.e. `orqis-backend`'s
in-process copy). To flip over to this service, update each seed entry's
`endpointUrl` to point here — or `OWNED_SERVICES_BASE_URL` env var if you
introduce one.

## What's hosted

All 28 in-house agents. Same code, same handlers, same input/output
schemas as the catalogue advertises:

- **AI generation** (5) — landing-forge, demo-forge, course-quill, resume-rx, poster-forge
- **Image utility** (4) — img-shrink, exif-clean, bg-strip, page-shot
- **Document utility** (4) — csv-mage, tex-press, doc-converter, pdf-render
- **Web / scraping** (4) — scrape-clean, scrape-render, og-card, lighthouse-audit
- **Validation / inspection** (4) — email-truth, phone-truth, dns-trace, ssl-inspect
- **Data / numeric** (3) — rng-uniform, sort-bench, qr-toolkit
- **Audio** (1) — subtitle-bot
- **Vision / a11y** (2) — ocr-vision, a11y-quick
- **Visual** (1) — diagram-forge

Mock-mode discipline is identical to `orqis-backend` — no API keys required
to run end-to-end; flip to real mode per agent via env vars.

## Local dev

```powershell
cd orqis-owned-services
npm install
npx playwright install chromium
npm run dev
# Fastify listens on http://localhost:4100
# Health: GET /
# Agent: POST /v1/agents/<slug>/run
```

Point `orqis-frontend` / `orqis-backend` at `http://localhost:4100` for
end-to-end testing.

## Production deploy (Railway)

1. **Push** this folder to its own Git repo (e.g. `malay5/orqis-owned-services`).
2. **Railway → New service → Deploy from GitHub repo** → pick that repo.
3. **Set env vars** on the service:
   - `PORT` — Railway sets this for you; leave as is.
   - `PUBLIC_BASE_URL` — `https://owned-services.orqis.xyz` (or whatever
     domain you bind). Used by file-emitting agents to build `/r/<id>` URLs.
   - `CORS_ORIGINS` — `https://orqis.xyz,https://api.orqis.xyz` (the
     domains that legitimately call this service).
   - **Optional, per agent:**
     - `ANTHROPIC_API_KEY` — flips landing-forge / resume-rx / course-quill /
       demo-forge script-gen out of mock.
     - `GEMINI_API_KEY` — flips poster-forge image-gen out of mock.
     - `OPENROUTER_API_KEY` — flips glm-chat / nemotron-chat / budget-chat
       (the free LLM tier) out of mock. Optional
       `OPENROUTER_BUDGET_MODELS` (comma-separated slugs) overrides the
       managed-mode allowlist without a redeploy.
     - `ELEVENLABS_API_KEY` + Remotion runtime — flips demo-forge full pipe.
     - `TEX_PIPELINE=real` + `tectonic` on PATH — flips tex-press.
     - `PANDOC_PIPELINE=real` + `pandoc` on PATH — flips doc-converter.
     - `BG_STRIP_PIPELINE=real` + `BG_STRIP_SIDECAR_URL` — flips bg-strip
       to the Python sidecar (deployed separately, see `orqis-py-services/`).
     - `WHISPER_PIPELINE=real` + `WHISPER_SIDECAR_URL` — same for subtitle-bot.
4. **Bind a custom domain** (e.g. `owned-services.orqis.xyz`).
5. **Update `orqis-frontend/src/data/seed-agents.ts`** — change every
   in-house agent's `endpointUrl` from `http://localhost:4000/...` to
   `https://owned-services.orqis.xyz/...`.

Railway picks the Dockerfile automatically; the build pre-installs
Chromium so the first browser-dep call doesn't stall.

## Storage

Artifacts (PDFs, PNGs, SVGs, MP4s) currently write to `storage/r/` on
local disk and are served via `/r/<id>.<ext>`. **This is ephemeral on
Railway** — redeploys wipe it. For prod we'll either:

1. Mount an R2 / S3 client and write there instead (the planned move,
   already on the punch list), or
2. Use Railway volumes (less portable, no CDN).

Storage swap touches ~5 files in `routes/v1/`; design is intentionally
agnostic.

## Cost / scaling notes

| Agent | Resource profile | Scaling lever |
|---|---|---|
| AI generation (5) | API-call bound | Memory: low. Cost: API token spend dominates |
| sharp-using (img-shrink, exif-clean, bg-strip mock, poster-forge) | CPU + RAM for sharp decode | Memory: 256-512 MB |
| Playwright (page-shot, pdf-render, scrape-render, lighthouse, a11y-quick) | Chromium per call (~200 MB RAM) | Memory: 1 GB recommended; concurrency-bound |
| Pure-Node utility (csv-mage, qr-toolkit, …) | Tiny | Memory: <100 MB |
| Async (demo-forge, course-quill, subtitle-bot) | Long-running; talks to webhooks | Should split into its own worker once real-mode lands |

On Railway, ~$5-15/mo for a single-instance 1 GB RAM service covers
the catalogue at MVP traffic. Real load will want to split the Playwright
group from the rest.

## When to split this service further

Triggers to break this into multiple deploys:

1. **Async agents move out of mock.** demo-forge + course-quill + subtitle-bot
   real-mode pipelines are heavy (Anthropic streaming, ElevenLabs audio,
   tectonic / faster-whisper). They want their own worker.
2. **Playwright concurrency caps hit.** Browser-dep agents (5 of them)
   contend for Chromium. Worth pulling those into a dedicated browser
   service.
3. **Per-agent SLAs diverge.** If `email-truth` needs sub-50ms P99 and
   `lighthouse-audit` is fine at 20s, they shouldn't share a pool.

None of these matter at MVP scale; revisit at the first sign of pain.
