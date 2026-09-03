# orqis — scaling to-do

Ordered by "what blocks the next thing."

- **H** = hackathon demo path. Render + Vercel, CPU-only agents live, the
  OpenRouter budget tier live, Razorpay in **test mode only**. This is the
  next two weeks.
- **P0** = can't take real users until done.
- **P1** = can't take real money until done.
- **P2** = growth / polish once P0+P1 are live.

Each line is meant to be checkable in an afternoon or split further.

Last reviewed: 2026-09-03.

---

## H — hackathon demo path

Scope decision: **only CPU-bound agents go live**, plus the OpenRouter LLM
tier. Everything Chromium-backed, ML-sidecar-backed, or dependent on an
Anthropic/OpenAI/Google key stays in mock mode. Payments are a Razorpay
**test-mode** integration — no KYC, no real settlement, no live keys.

### What actually goes live

Of the 40 catalogue agents, **18 run in real mode with zero keys plus one
OpenRouter key**; the other 22 stay honest mocks.

**Live, no key needed (15).** csv-mage, diagram-forge, exif-clean,
qr-toolkit, scrape-clean, ocr-vision, dns-trace, email-truth, og-card,
phone-truth, ssl-inspect, rng-uniform, sort-bench, img-shrink, and
doc-converter (if `pandoc` is installed in the image).

**Live with `OPENROUTER_API_KEY` (3).** deepseek-chat, mimo-chat,
budget-chat.

**Staying mock (22).** The six Playwright agents (page-shot, pdf-render,
scrape-render, site-crawl, lighthouse-audit, a11y-quick) — Chromium wants
~200 MB per call and won't fit a 512 MB Render instance. The two Python
sidecars (bg-strip / rembg, subtitle-bot / faster-whisper). tex-press
without `tectonic`. And every agent hardcoded to a key we're not buying:
claude-chat, gpt-chat, gemini-chat, nano-banana, landing-forge, resume-rx,
demo-forge, course-quill, poster-forge, text-summarize, entity-extract,
code-explain, compare-models.

- [ ] **Point the product-wrapper LLM agents at OpenRouter.** `text-summarize`, `entity-extract`, and `code-explain` are hardcoded to `ANTHROPIC_API_KEY` (`import Anthropic from "@anthropic-ai/sdk"`, `MODEL = "claude-haiku-4-5-20251001"`). Add an OpenRouter fallback in each — if `ANTHROPIC_API_KEY` is unset but `OPENROUTER_API_KEY` is set, route through `runOpenRouterChat` on a budget model. Turns 3 more agents real on the key you already have. Highest demo-value item on this list.
- [ ] **Re-point `compare-models` at the budget tier.** It currently fans out to claude-chat + gpt-chat + gemini-chat (three keys, all mock). Racing `deepseek/deepseek-chat` vs `xiaomi/mimo-v2-flash` vs `qwen/qwen3-30b-a3b` through one OpenRouter key is a *better* demo — same side-by-side UI, costs fractions of a cent, and shows off the thing that's actually novel.
- [ ] **Label mock mode in the UI.** Every agent response carries `mode: "mock" | "managed" | "byok"` but nothing in `orqis-frontend/src/components/` reads it. A judge who invokes page-shot and gets a placeholder PNG with no label will read it as broken or dishonest. Add a badge on the result panel and a "demo mode" chip on the catalogue card for the 22 mocked listings.

### Deploy — Render + Vercel

- [ ] Render web service for `orqis-owned-services` from its Dockerfile
- [ ] **Strip Playwright out of the deployed image.** The Dockerfile pre-installs Chromium (~400 MB); with the browser agents mocked it's pure build time and disk. Gate it behind a build arg so the hackathon image skips it.
- [ ] Set on Render: `PUBLIC_BASE_URL`, `CORS_ORIGINS`, `OPENROUTER_API_KEY`, and optionally `OPENROUTER_BUDGET_MODELS`
- [ ] **Free tier spins down after 15 min idle** — first request then takes ~50 s. That will happen during judging. Either take the $7/mo Starter instance or add an external cron ping every 10 min. Decide before demo day.
- [x] ~~`render.yaml` blueprint committed~~ **done** — `orqis-backend/render.yaml` plus `.node-version`, and DEPLOY.md walks the whole thing. Note it deploys **one** service: orqis-backend serves the platform API *and* all 40 agents, so orqis-owned-services is not deployed yet.
- [ ] Health check path set to `/` in the Render dashboard
- [ ] **Artifacts are ephemeral on Render too** — no persistent disk on free tier, and redeploys wipe it regardless. For the hackathon that's survivable (artifacts only need to outlive the demo); note it and move on. R2 is the real fix, in P0.
- [ ] Point the catalogue at the deployed agent host: `OWNED_SERVICES_BASE_URL=https://… npm run seed` from **orqis-backend** (the seed script moved there with the database in Sprint 19)
- [x] ~~**Change `DEFAULT_BASE` in `seed-endpoint.ts` to `127.0.0.1`**~~ **done, Sprint 19** — now `http://127.0.0.1:4100` in `orqis-backend/src/platform/seed-endpoint.ts`. Node's `fetch` resolves `localhost` to `::1` first and both Fastify apps bind IPv4 only, so the invocation proxy got `ECONNREFUSED` on every in-house agent. It surfaced as `{"error":"fetch failed You were refunded."}`, which reads like a broken agent rather than a name-resolution problem.
- [ ] **Render service for the platform API** (`orqis-backend`) with `MONGODB_URI`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `ADMIN_EMAILS`, `OWNED_SERVICES_BASE_URL`. Since Sprint 19 this is a second Render service alongside the agent host — and it's the one that must not cold-start during judging, because every page read goes through it.
- [ ] Vercel: frontend deploy with **just `ORQIS_API_URL`** pointing at that Render service (plus `HOME_MODE`). After Sprint 20 the frontend needs no secrets at all — `MONGODB_URI`, `AUTH_SECRET`, `ENCRYPTION_KEY` and `ADMIN_EMAILS` all live on `orqis-backend`. Nice side effect: a leaked Vercel env exposes nothing.
- [ ] Set `CORS_ORIGINS` on the platform API to the Vercel domain. The browser never calls it directly today (everything routes through Next handlers), but that header is the backstop if it ever does.
- [ ] End-to-end smoke on the deployed stack: sign in → browse → invoke `email-truth` → invoke `budget-chat` → check the ledger decremented

### Razorpay — test mode

- [ ] Razorpay account in **Test Mode**; use `rzp_test_*` key ID + secret. No KYC needed, no bank account, no business documents.
- [ ] Checkout on a `/credits` page: 3 SKUs (₹99 / ₹499 / ₹1999 → 500 / 3000 / 15000 credits). Use Razorpay Checkout.js, not the server-side Orders API alone.
- [ ] Verify `razorpay_signature` server-side (HMAC-SHA256 of `order_id|payment_id` with the key secret) before crediting. Never credit on the client callback alone — that's the one Razorpay bug everyone ships.
- [ ] Webhook → `CreditTransaction` with `source: "razorpay"`, idempotent on `payment_id`
- [ ] Banner on `/credits`: "Payments are in test mode. Use card 4111 1111 1111 1111, any future expiry, any CVV. No money moves." Judges will try to pay.
- [ ] Keep the admin `grant-credits` path working as the fallback if Checkout fails live

### Legal — the hackathon-safe minimum

Test mode means no KYC and no regulator in the loop, but the site still
stores passwords, collects emails, and forwards user input to third-party
APIs. These five are the floor, and they're an afternoon:

- [ ] **Privacy Policy** — what's collected (email, name, a scrypt password hash, invocation inputs/outputs, IP in logs), who it goes to (OpenRouter, MongoDB Atlas, Vercel, Render, Resend), how long it's kept, how to get it deleted. Since Sprint 19 orqis stores credentials itself, so this is no longer a Google requirement — it's our own obligation.
- [ ] **Terms of Service** — credits are a prepaid, non-cash, non-refundable balance; no warranty on agent output; we can suspend abuse.
- [ ] **AI output disclaimer** — one line near every result panel: outputs are model-generated, may be wrong, and are the user's responsibility to verify. Cheap, and it's the first thing a careful judge looks for.
- [ ] **"Test mode, no real payments"** stated on `/credits` and in the ToS.
- [ ] Contact email that resolves (`hello@orqis.xyz`) in the footer

---

## P0 — get the real stack on the internet

The code is well ahead of the deployment. Today nothing but the landing
page is actually live; every `endpointUrl` in the catalogue still points at
`localhost:4000`.

### Source control & repo hygiene
- [ ] `git init` + GitHub repo for `orqis-owned-services` (README step 1 has been pending since Sprint 16)
- [ ] `git init` + GitHub repo for `orqis-sdk`
- [ ] `git init` + GitHub repo for `orqis-mcp`
- [x] ~~Decide: collapse `orqis-backend` into `orqis-owned-services`~~ **decided, Sprint 19.** `orqis-backend` became the **platform API** — it owns MongoDB, auth (email + password, HS256 JWTs), the credit ledger, the catalogue, the invocation proxy, API keys and admin. `orqis-frontend` is now a pure client with no `mongoose` dependency and no `MONGODB_URI`.
- [ ] **Finish the split: delete the 40 duplicated agent runtimes from `orqis-backend`.** They're byte-identical copies of `orqis-owned-services` and still drift on every change (`services/*.ts` + `routes/v1/tier-*.ts`). Left in place during Sprint 19 so the migration stayed reversible. Once `orqis-owned-services` is deployed, point `OWNED_SERVICES_BASE_URL` at it, re-seed, and delete `src/services/` and the `tier-*` routes from `orqis-backend`.
- [ ] Add a CI workflow per repo: `npm ci && npm run typecheck` minimum; backend also runs `scripts/smoke-tier-a-b.ts`; frontend also runs `validate-seeds`
- [ ] Commit after every sprint, not every 15. (Sept 2 push was 80+ files / ~30k lines across two commits.)

### Deploy the rest of the agent host
Everything the hackathon build deliberately left mocked.

- [ ] Move the six Playwright agents onto their own Render service with ≥1 GB RAM (or Railway/Fly if Render's memory pricing is worse) — page-shot, pdf-render, scrape-render, site-crawl, lighthouse-audit, a11y-quick
- [ ] Swap artifact storage from `storage/r/` on local disk to Cloudflare R2. Every host wipes disk on redeploy — every `previewUrl` dies. ~5 files in `routes/v1/`, design is already storage-agnostic.
- [ ] Deploy `orqis-py-services/bg-strip` and `subtitle-bot` as their own services; set `*_SIDECAR_URL` + `*_PIPELINE=real`
- [ ] Add `tectonic` (tex-press) and confirm `pandoc` (doc-converter) in the image
- [ ] Buy the remaining provider keys — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` — and un-mock claude-chat, gpt-chat, gemini-chat, nano-banana, landing-forge, resume-rx, demo-forge, course-quill, poster-forge. Only worth it once P1 billing correctness is done.
- [ ] Health checks + restart policy on every service
- [ ] Bind `owned-services.orqis.xyz` to the agent host

### Deploy the platform
- [ ] MongoDB Atlas — set `MONGODB_URI` on **orqis-backend** (not the frontend), then `cd orqis-backend && npm run seed`. The seed script moved with the database in Sprint 19.
- [x] ~~Google OAuth consent screen → "in production"~~ **obsolete.** Sprint 19 replaced Google with orqis's own email + password auth (credentials provider in `src/lib/auth.ts`, scrypt hashes in `src/lib/password.ts`, registration in `/api/auth/register`). No consent screen, no 100-user cap, no per-environment redirect URI to register — which is also what unblocked running the app on a non-3000 port.
- [ ] **Own-auth hardening**: rate-limit failed logins per email and per IP, add a password-reset flow via Resend, and decide whether email verification gates the signup credit grant. Right now a throwaway address gets its credits immediately with no confirmation. (Sprint 20 removed NextAuth entirely — auth is now four small routes over the backend's /v1/auth/*, so there is no framework to fight when adding these.)
- [x] ~~**Fail fast on missing secrets at boot.**~~ **Done, Sprint 19.** `orqis-backend/src/server.ts` asserts `AUTH_SECRET` and `MONGODB_URI` are non-empty before listening and exits naming the missing one. It also now loads `.env` itself (`src/platform/load-env.ts`) — the project carries no dotenv dependency, and without that the assertion fired even with a correct .env file.
- [x] ~~Decommission the Apps Script / Google Sheet intake~~ **done, Sprint 20.** `lib/apps-script.ts` and the waitlist route are deleted; `/api/list-agent` relays to the backend, which writes to Mongo. `APPS_SCRIPT_URL` can come out of the Vercel env.
- [ ] Custom domain + `www` redirect on Vercel confirmed working with OAuth callback URLs

### Publish the developer surface
- [ ] `npm publish @orqis/sdk` (READMEs already say `npm install @orqis/sdk` — verify it's actually on the registry)
- [ ] `npm publish @orqis/mcp` (READMEs say `npx -y @orqis/mcp`)
- [ ] `public/openapi.json` regenerated from the real prod base URL, `/docs` (Scalar) points at it
- [ ] Smoke-test the whole loop from a clean machine: mint key → `orqis.search()` → `orqis.invoke("email-truth")` → result

---

## P1 — before real money moves

### Billing correctness
- [x] **BYO-key rebate + mock rebate — already done.** Sprint 18 (M6), in `src/app/api/agents/[slug]/invoke/route.ts`; `/api/v1/agents/[slug]/invoke` re-exports the same handler, so both surfaces share it. `mode: "mock"` refunds the full `pricePerCall`; `mode: "byok"` refunds all but the 1-credit routing fee. Verified end-to-end 2026-09-02 — a mock `budget-chat` call reported `creditsCharged: 0`. Listed so nobody re-implements it.
- [ ] **Gate the mode rebate to trusted endpoints before seller payouts ship.** A third-party seller can forge `mode: "mock"` in their response and dodge billing entirely. Harmless today (a rebate only credits the buyer; nothing is debited from a seller), but it becomes free money the moment payouts exist. The code comment already flags this — turn it into an allowlist of orqis-owned endpoint hosts.
- [ ] **Per-user rate limits on managed LLM passthroughs.** 100 signup credits ÷ 2 credits = 50 free DeepSeek calls per throwaway Gmail. `src/lib/rate-limit.ts` exists — confirm it wraps `/api/v1/agents/[slug]/invoke` and `/api/agents/[slug]/invoke`, and add a per-user-per-day cap on `category: "LLM"` agents specifically.
- [ ] Spend limit on the OpenRouter key in their dashboard. This is the only hard ceiling until the above lands — set it before the demo, not after.
- [ ] Ledger reconciliation job: sum of `CreditTransaction` per user == `creditBalance`; alert on drift
- [ ] Refund path tested end-to-end for async agents (webhook fails → credits back)

### Payments — going live
Everything here is what test-mode Razorpay lets you skip. None of it is
needed for the hackathon; all of it is needed before a real rupee moves.

- [ ] **Razorpay KYC / account activation.** They require, on the live site: Terms & Conditions, Privacy Policy, Refund & Cancellation Policy, Shipping/Delivery Policy (state "digital delivery, instant"), Contact Us with a real email + phone + address, and a Pricing page. Accounts get rejected for missing any one of these — build all six before applying.
- [ ] Business entity + PAN + bank account in the same legal name as the Razorpay account
- [ ] GST position: digital services sold to Indian consumers attract GST once you cross the registration threshold. Decide whether prices are GST-inclusive and show it on the invoice.
- [ ] Swap `rzp_test_*` for live keys behind an env flag; keep test mode working for staging
- [ ] Payment failure + retry UX (Razorpay returns a lot of soft declines on Indian cards)
- [ ] Seller payout model: monthly, orqis take-rate configurable per agent. Razorpay Route is the Indian equivalent of Stripe Connect — needs separate activation. Don't build the UI yet; just the ledger side, so seller earnings accrue from day one.
- [ ] International buyers: Razorpay needs separate international-payments activation, or add Stripe as a second gateway for non-INR. Decide which before marketing outside India.
- [ ] Replace `RequestCreditsButton` / admin `grant-credits` flow with "buy credits" for non-admin users

### Legal & trust
The H list has the four-item floor. This is the full set.

**Policy pages**
- [ ] **Terms of Service** — credits are prepaid, non-cash, non-refundable, non-transferable and expire per policy; no warranty on agent output; suspension and termination grounds; limitation of liability; governing law + jurisdiction (name the city).
- [ ] **Privacy Policy** — categories collected, purpose, legal basis, retention, third-party recipients, user rights, contact for requests.
- [ ] **Refund & Cancellation Policy** — required by Razorpay. Cover: unused credits, failed invocations, duplicate charges, and the SLA for processing a refund (state a number of days).
- [ ] **Shipping / Delivery Policy** — Razorpay requires one even for digital goods. One paragraph: credits are delivered to the account instantly on payment confirmation.
- [ ] **Acceptable Use Policy** — no illegal content, no scraping sites you don't control, no using agents to attack third parties, no PII of others without basis. Give yourself the right to kill a key.
- [ ] **Pricing page** — per-agent credit price, what a credit costs, what happens when the balance hits zero. Razorpay wants this; buyers want it more.
- [ ] **Contact page** — email, phone, registered address. Razorpay verifies these resolve.

**India-specific**
- [ ] **DPDP Act 2023 compliance** — consent notice at signup stating purpose, a named **Grievance Officer** with a published email (this is a hard requirement under both DPDP and the IT Rules 2021), and a working data-deletion request path.
- [ ] Data-principal rights in practice: an account-deletion endpoint that actually deletes invocations + artifacts, and an export endpoint. Don't publish the promise before the button exists.

**Trust & disclosure**
- [ ] **Subprocessor list** — a page naming OpenRouter, Anthropic, OpenAI, Google, MongoDB Atlas, Vercel, Render, Cloudflare R2, Resend, Razorpay, and what each one sees. Buyers sending prompts through you will ask.
- [ ] **Disclose the seller data flow in the listing UI** — "your input is sent to this seller's endpoint" on every third-party agent page, before invoke. It's the single most surprising thing about the product.
- [ ] **AI output disclaimer** near every result panel.
- [ ] **BYO-key handling statement** — keys are pass-through, never persisted, never logged — *and an audit proving it*. Grep the request-logging path in the proxy and both backends for anywhere `input` is logged wholesale; `apiKey` lives inside the input object.
- [ ] **Log redaction audit** more broadly: prompts, emails, and uploaded file contents shouldn't land in Render/Vercel logs in plaintext.
- [ ] Data retention policy with real numbers: invocation inputs/outputs kept N days, R2 artifacts N days, then hard-deleted. Wire the R2 lifecycle rule to match what the policy says.
- [ ] Cookie / analytics notice once PostHog is wired; consent gate for EU visitors.
- [ ] **Legal review of the markup-resell shape** (`claude-chat`, `gpt-chat`, `gemini-chat`, `nano-banana`) — provider TOS generally prohibits reselling raw API access. The OpenRouter-backed budget tier is lower risk (OpenRouter is itself a reseller) but check their TOS too. Until cleared: lead marketing with BYO-key + product-wrapper framings only.
- [ ] **Model attribution** — where a listing resells a named model, check whether that vendor's brand guidelines allow using the name in the listing title. "deepseek-chat" as a slug is fine; a DeepSeek logo on a card is not.
- [ ] **Seller agreement** — endpoint uptime expectations, what happens when their endpoint 500s, who owns the output, indemnity for what their endpoint does with buyer input, takedown and delisting process.
- [ ] **Age / eligibility clause** (18+, or 13+ with the usual carve-outs) in the ToS.
- [ ] **Trademark sanity check on "orqis"** before spending on the domain and launch assets.
- [ ] `.well-known/security.txt` + a responsible-disclosure line so a researcher has somewhere to write.
- [ ] Encrypt-at-rest audit: `crypto-server.ts` + `ENCRYPTION_KEY` for seller auth headers — key rotation story?

### Security
- [x] Webhook auth on `/api/webhooks/jobs/[invocationId]` — already done (per-invocation secret, SHA-256 hashed at rest, timing-safe compare, idempotent on terminal state). Listed so nobody re-audits it.
- [ ] SSRF guard (`url-guard.ts`) applied to *every* agent that fetches a caller-supplied URL — audit scrape-clean, og-card, dns-trace, ssl-inspect now (they're in the live CPU set), and page-shot, scrape-render, site-crawl, lighthouse-audit, a11y-quick, subtitle-bot `audioUrl` before those go live
- [ ] Seller `endpointUrl` validated against the same guard at submission time (no `localhost`, no RFC-1918, no cloud metadata IPs)
- [ ] Body-size limits on Next.js invoke routes (backend has `MAX_BODY_BYTES`; does the proxy?)
- [ ] Dependency audit + Dependabot on all repos

### Observability
- [ ] Sentry on frontend + owned-services (planned since Sprint 1, not wired)
- [ ] PostHog: `agent_invoked`, `agent_viewed`, `key_minted`, `credits_out` events
- [ ] Per-agent cost dashboard: `usage.costUsd` from OpenRouter + estimated cost from Anthropic/OpenAI/Google token counts → margin per listing. You need this before you can price anything rationally.
- [ ] Uptime monitor on `/health` of every service + the Vercel app (doubles as the Render keep-alive ping)

---

## P2 — growth

### Product
- [ ] Streaming responses (SSE) for the LLM tier — deferred across Sprints 17-18, but it's the #1 thing an LLM buyer expects
- [ ] Seller self-serve onboarding without admin approval for low-risk categories; automated health check (hit `exampleRequest`, validate against `outputSchema`) before listing goes live
- [ ] Periodic health probe on every listed endpoint; auto-delist after N consecutive failures; seller notified via Resend
- [ ] Search quality: today it's free-text over name/tagline/tags. Add category facets, "async" filter, price sort, and an embedding-backed semantic search so `orqis_search_agents` from the MCP server returns the right agent for a vague query
- [ ] Agent versioning (`inputSchema` changes shouldn't silently break buyers)
- [ ] Reviews: require ≥1 invocation before a user can review; moderation queue in admin
- [ ] Usage-based pricing option for sellers (per-token / per-second) alongside flat `pricePerCall`

### Distribution
- [ ] Execute `launch-assets/` (HN, Product Hunt, Twitter thread) — written already, but the Resend *waitlist* email no longer applies: Sprint 20 removed the waitlist, so rewrite that one as a launch announcement.
- [x] ~~Waitlist → invite flow~~ **removed, Sprint 20.** The pre-launch waitlist landing, modal, API route and Google-Sheet intake are gone; the marketplace is the home page and signup is open. Track acquisition with PostHog on the signup event instead.
- [ ] Submit `@orqis/mcp` to the MCP registries / Claude Desktop directory / Cursor MCP list
- [x] ~~**Technical SEO baseline**~~ **done, Sprint 20.** Real PNG social cards (the old `og-image.svg` was ignored by every platform), per-agent OG cards, favicon + apple-touch-icon + web manifest, canonical URLs on every public page, `noindex` on auth/dashboard/admin, JSON-LD (Organization, WebSite+SearchAction, ItemList, BreadcrumbList, SoftwareApplication), and a sitemap fix that was emitting mixed-case category URLs.
- [ ] **Content SEO** — the part tooling can't do: write real copy for the category pages (they're currently a grid and one line), and give each agent a longer `longDescription`. Thin pages are what stops 40 agent pages ranking, not markup.
- [ ] Verify the domain in Google Search Console + Bing Webmaster Tools and submit `/sitemap.xml`. Nothing gets indexed on schedule without this.
- [ ] Blog cadence: one post per new agent tier; the two existing posts are a good template
- [ ] Case study per in-house agent showing a real workflow (e.g. "scrape-clean → deepseek-chat → csv-mage in one MCP session")
- [ ] WebMCP integration on the browse + agent detail pages — nice-to-have, not a priority, but it's ~1 file and makes the site itself agent-callable in Chrome/Edge

### Ops
- [ ] Async agents (demo-forge, course-quill, subtitle-bot) onto BullMQ + Upstash Redis instead of in-process `async-runner.ts` — survives redeploys, gives you retries
- [ ] Backups: Atlas continuous backup on; R2 lifecycle rule for artifacts older than 30 days (match the retention policy)
- [ ] Staging environment (Vercel preview + a second Render env) so seed/schema changes get tested against real infra before prod
