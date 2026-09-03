# orqis — architecture

Last updated: 2026-09-03 (Sprint 19 decoupling, Sprint 20 auth rewrite + SEO).

## Repository layout

One monorepo, six folders. `orqis-frontend` and `orqis-backend` were separate
repos until Sprint 21; their pre-monorepo history lives in the archived
`malay5/orqis---agentic-shop` and `malay5/orqis-backend`.

## Three services

```
                        ┌────────────────────────┐
   browser / human ────►│    orqis-frontend      │  Next.js on Vercel.
                        │    (presentation)      │  No database. No models.
                        └───────────┬────────────┘  No auth framework.
                                    │
                                    │  HTTPS + Authorization: Bearer <jwt>
                                    │  ORQIS_API_URL
                                    ▼
   AI agent / SDK ─────────►┌────────────────────────┐
   Authorization:           │    orqis-backend       │  Fastify on Render.
   Bearer or_live_…         │    (platform API)      │  Owns MongoDB: users,
                            │                        │  credits, catalogue,
                            └───────────┬────────────┘  invocations, keys.
                                        │
                                        │  HTTPS POST + webhook headers
                                        ▼
                            ┌────────────────────────┐
                            │  orqis-owned-services  │  Fastify on Render.
                            │  (agent runtime)       │  40 agents. Stateless.
                            └────────────────────────┘  No user data, ever.
```

## Who owns what

| Concern | Service | Notes |
|---|---|---|
| Pages, UI, token cookie | `orqis-frontend` | stores the token it's handed; verifies nothing itself |
| Users, passwords, JWTs | `orqis-backend` | scrypt hashes, HS256 tokens, both hand-rolled on `node:crypto` |
| Credit ledger | `orqis-backend` | append-only `CreditTransaction`; `User.creditBalance` is a cache |
| Catalogue | `orqis-backend` | `GET /v1/catalog/*`, public, never returns `endpointUrl` |
| Invocation proxy | `orqis-backend` | charges, calls the agent, refunds/rebates, records the row |
| Agent execution | `orqis-owned-services` | pure functions over HTTP; the same contract a third-party seller uses |

The frontend has **no `mongoose` dependency and no `MONGODB_URI`**. If you
find yourself adding either, something is being built in the wrong service.

## Request paths

**A person browsing.** Browser → Next server component → `apiFetch` →
`GET /v1/catalog/agents`. The catalogue is cached for 30s; anything
user-specific is `no-store`.

**A person invoking.** Browser → `POST /api/agents/:slug/invoke` (Next) →
`POST /v1/invoke/:slug` (backend, with the user's JWT) → the seller's
endpoint. The Next route is a pass-through so the browser never holds the
backend credential.

**An AI agent invoking.** Client → `POST /api/v1/agents/:slug/invoke` with
`Authorization: Bearer or_live_…` → relayed verbatim to the backend, which
resolves the key. The documented public URL is unchanged from before the
split, so existing SDK and MCP clients keep working.

## Authentication

No auth framework. The flow is the ordinary one you'd write for a React SPA:

```
  login form
      │  POST /api/auth/login  { email, password }
      ▼
  Next route ──► POST /v1/auth/login ──► backend verifies the scrypt hash
      │                                   and returns { token, user }
      │  Set-Cookie: orqis_token (httpOnly)
      ▼
  every later request ──► Authorization: Bearer <token> ──► backend
```

Four routes, each a few lines: `/api/auth/register`, `/login`, `/logout`,
`/me`. There are no providers, callbacks, or session strategies — see
`src/lib/session.ts`.

Two credentials the backend accepts, both on `Authorization: Bearer`:

- **JWT** — issued by `POST /v1/auth/login`, 30-day expiry, HS256 signed
  with `AUTH_SECRET`. Verification hardcodes the algorithm and never reads
  `alg` from the token, which is the classic JWT forgery vector.
- **API key** — `or_live_…`, SHA-256 hashed at rest, distinguishable by
  prefix so a key is never mistaken for a JWT.

**Why the token is in a cookie and not localStorage.** A SPA would normally
keep it in localStorage. That doesn't work here: `/browse`, `/dashboard`,
every agent page and the admin screens are server components that need the
token *while rendering*, and the server cannot read localStorage — using it
would mean rewriting every page as a client component with its own loading
state. The cookie holds the same raw backend JWT a SPA would hold, is still
sent as a Bearer header, and being httpOnly it can't be read by XSS.

Client components get the session from a small React context
(`components/SessionProvider.tsx`) seeded from the server in the root
layout, so the header renders signed-in state on first paint with no loading
flash and no extra request.

Key minting and revocation are session-only: a key that can mint keys is a
privilege-escalation path.

## SEO surface

All generated at build time from code — no binary assets to keep in sync:

| Route | What it is |
|---|---|
| `/icon`, `/apple-icon` | favicon (32px) and iOS touch icon (180px), drawn from the orqis mark |
| `/opengraph-image` | site-wide 1200×630 social card |
| `/agents/[slug]/opengraph-image` | per-agent card with its emoji, accent, price and category |
| `/manifest.webmanifest` | PWA manifest |
| `/sitemap.xml` | static routes + every approved agent + canonical category slugs |
| `/robots.txt` | disallows /api, /admin, /dashboard, /signin, /signup |

Structured data lives in `components/seo/JsonLd.tsx`: Organization and
WebSite+SearchAction on home, ItemList on /browse, BreadcrumbList plus
SoftwareApplication on agent pages.

Two rules worth keeping: social platforms reject SVG, so any OG image must be
a real PNG; and `NEXT_PUBLIC_SITE_URL` drives `metadataBase`, the sitemap and
robots together, so a domain change is one variable.

## Deployment shape

The root `Dockerfile` builds frontend and backend into **one image**: Fastify
on loopback:4000, Next.js on `$PORT` as the only published port,
`docker/start.js` supervising both. That works because the frontend already
proxies every backend call through its own route handlers — the browser never
needs to reach Fastify directly. See DEPLOY.md.

Splitting later costs no code changes: point `ORQIS_API_URL` at a separately
deployed backend and the frontend stops caring that they ever shared a
process.

## Local development

```powershell
# 1. Mongo
mongod

# 2. Platform API + agents (one process today)
cd orqis-backend
#    .env needs MONGODB_URI and AUTH_SECRET or it refuses to start
npm run seed        # loads the 40-agent catalogue
npm run dev         # :4000

# 3. Frontend
cd orqis-frontend
#    .env.local needs only ORQIS_API_URL
npm run dev         # :3000
```

Use `127.0.0.1`, not `localhost`, in every service-to-service URL. Node's
`fetch` resolves `localhost` to `::1` first and both Fastify apps bind IPv4
only, so `localhost` fails with `ECONNREFUSED` — and it surfaces as a
refunded invocation, which looks like a broken agent rather than a DNS
problem.

## Verification

```powershell
cd orqis-backend
npm run typecheck
npm run smoke            # 34 agent tests, no DB, no keys
npm run smoke:platform   # 50 platform tests, needs Mongo
npm run smoke:openrouter # live OpenRouter calls, needs a key

cd orqis-frontend
npm run typecheck
npm run validate-seeds   # 80 schema checks over the catalogue
npm run build
```

## Known duplication

`orqis-backend` still contains a byte-identical copy of all 40 agent
runtimes from `orqis-owned-services`. It was left in place during Sprint 19
so the decoupling stayed reversible, and it's what makes local dev a single
process. Delete `orqis-backend/src/services/` and its `tier-*` routes once
`orqis-owned-services` is deployed and `OWNED_SERVICES_BASE_URL` points at
it — see SCALING-TODO.md → P0.
