# Show HN — orqis

## Title (≤ 80 chars)

Show HN: orqis – a marketplace for specialist AI agents (browsable + callable)

## Body

Hi HN — I'm Malay, sole dev of orqis (https://orqis.xyz).

orqis is a marketplace for specialist AI agents. The differentiator is that
every listing is both browsable by humans (Play-Store-style: categories,
verified reviews, screenshots, try-it-once) and callable by other AI agents
(Claude, Cursor, Claude Code) via a public REST API and an MCP server.

The why: generalist LLMs are great at reasoning and mediocre at long-tail
specialist work. Specialists already exist (landing-page generators, demo
video pipelines, resume reviewers) but they're scattered across one-off
GitHub repos and indie SaaS pages. There was no shared shelf, and certainly
nothing where one AI agent could discover and call another with metering.

What's actually built (12-week MVP, single dev):

- Public REST: /api/v1/agents (search), /api/v1/agents/:slug,
  /api/v1/agents/:slug/invoke (sync OR async via job polling),
  /api/v1/jobs/:id, /api/v1/me. API-key auth, scoped (read | invoke), per-key
  rate limit.
- @orqis/sdk on npm — search() / get() / invoke() / invokeAndWait() / me().
- @orqis/mcp on npm — drop-in MCP server. One config line in Claude Desktop
  / Claude Code / Cursor and the model can natively call any orqis agent.
- 9 in-house seed agents covering AI generation (landing-forge, demo-forge,
  course-quill, resume-rx, poster-forge) and non-AI utility (img-shrink,
  rng-uniform, sort-bench).
- Async runtime: per-invocation webhook secret (SHA-256 hashed at rest),
  auto-refund on every failure path, /dashboard/jobs polling.
- Per-agent seller analytics: 30-day stacked-bar + 8 KPIs + recent
  invocations + reviews.
- Credit ledger (idempotent grant/charge/refund, denormalized balance cache).
  No Stripe in v1 — 100 free credits on signup. Stripe + payouts ship Month 4.

Stack: Next 16 + Tailwind v4 + React 19.2 (web), Fastify 5 + Mongoose
(backend), MongoDB, Anthropic SDK with prompt caching + structured output via
Zod, AES-256-GCM for encrypting seller auth headers at rest, sharp +
pdf-parse for utility agents.

Hard things I had real opinions on:

- Per-invocation webhook secrets, not a shared env-var secret. If a seller's
  endpoint logs leak, the worst case is one replayable webhook for one
  invocation.
- Schema-first agent contracts — input + output JSON Schema (draft 2020-12),
  Ajv-validated on both sides, mismatch triggers automatic refund.
- Mock mode for every AI agent so I can smoke-test without burning credits
  and so the MVP runs end-to-end with zero AI keys configured.

Honest limits:

- Premium agents (demo-forge MP4, course-quill LaTeX, poster-forge PNG) are
  stubbed with realistic placeholders right now; real Anthropic / Gemini /
  ElevenLabs / Remotion wiring is the next milestone.
- File storage is local disk (orqis-backend/storage/r/); R2 swap is wired
  but not flipped.
- Search is MongoDB text index — fine for the seed catalogue, will need
  Meilisearch around 500 listings.

Would love feedback on the dual-audience framing, the MCP-as-distribution
angle, and what specialist agents you'd actually pay credits to invoke.

orqis.xyz · API docs at orqis.xyz/docs · npm: @orqis/sdk + @orqis/mcp

## Anticipated comment replies

**Q: How is this different from a Hugging Face space / GPT marketplace?**
A: Two things. First, we're not opinionated about the agent's stack — sellers
expose any HTTPS endpoint with an input/output JSON Schema, AI-backed or not
(rng-uniform and sort-bench prove it). Second, MCP is a first-class
distribution channel: an Anthropic or Cursor user adds one config line and
the model can search and invoke agents natively. Hugging Face spaces are a
hosting target, not a callable catalogue.

**Q: What stops a seller from just pointing to their own SaaS landing page?**
A: Nothing — and that's the point. We want sellers who already have working
endpoints to get distribution + analytics + billing rails for free. orqis
adds discoverability and per-call metering, not implementation.

**Q: Free credits forever?**
A: No — Stripe + payouts ship Month 4. Free credits in MVP let me validate
marketplace shape (which agents get used, what reviews look like, whether MCP
discovery works) before fighting payouts, KYC, tax, and chargebacks. Credit
ledger is real (append-only transactions, idempotent debits and refunds), so
flipping money on is a config change.

**Q: How do I list my agent?**
A: orqis.xyz/sell → sign in → /dashboard/agents/new. Five-step form: basics →
schemas → endpoint + auth header → pricing → preview. Approval is admin-gated
in v1; turnaround is under a day.

**Q: Stack details?**
A: orqis-frontend is Next 16 (App Router, Turbopack, React 19.2, Tailwind v4,
NextAuth v5 with Google OAuth + JWT). orqis-backend is Fastify 5 +
TypeScript ESM + Mongoose 9.5 on MongoDB. AI agents use the Anthropic SDK
with prompt caching and structured output via Zod. Storage is local disk for
now (R2-ready). Async work runs in-process behind the same interface a
BullMQ + Upstash swap would expose.
