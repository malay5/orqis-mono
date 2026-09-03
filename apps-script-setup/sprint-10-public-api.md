# orqis — Sprint 10: poster-forge + public REST API + JS SDK

Three things ship together:

1. **poster-forge** — the second image-generating in-house agent (where AI image
   gen actually belongs). Mock mode generates a real-looking poster on the fly
   via sharp + an SVG layout — no external API needed.
2. **Public REST API** at `/api/v1/*` — search, get, invoke, jobs/:id, me. Accepts
   either a NextAuth session cookie (browser) or `Authorization: Bearer or_live_…`
   (programmatic clients).
3. **JS SDK** — `@orqis/sdk` source under `orqis-sdk/` (sibling folder). Built
   but not yet published to npm; that step is manual when you're ready.

No new env vars. No reseed required (poster-forge entry already had a stable
endpoint URL since Sprint 7's seed update).

---

## 1. API keys

**/dashboard/api-keys** is now a real page (Sprint 5's placeholder is gone).
Sign in, click **New key**, give it a label + scopes, copy the plaintext
**immediately** — we only store the SHA-256 hash, you can't recover it later.

Format: `or_live_<28 chars base64url>`. Auth header:

```
Authorization: Bearer or_live_…
```

Scopes:
- `read` — list / get agents, poll jobs, view your account.
- `invoke` — call agents (debits credits).

Rate limit: same 30 req/min budget as session calls, but bucketed **per key**
so each key gets its own quota independent of your browser session.

Keys can be revoked from the same page; revocation is immediate.

---

## 2. Public REST API

All routes accept either auth method.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/v1/agents?q=&category=` | GET | Public catalogue search. |
| `/api/v1/agents/:slug` | GET | Full agent detail (schema + examples + pricing). |
| `/api/v1/agents/:slug/invoke` | POST | Invoke an agent. Sync agents return inline; async agents return `{ status: "pending", invocationId }`. |
| `/api/v1/jobs/:invocationId` | GET | Poll an async job. |
| `/api/v1/me` | GET | Caller identity + balance. Smoke-test for an API key. |

All errors are `{ error: string }` with sensible HTTP codes (`401` unauth, `402`
out of credits, `403` scope missing, `404` agent missing, `429` rate limited,
`5xx` upstream / internal).

cURL smoke-test:

```bash
KEY=or_live_...

# Whoami
curl -H "Authorization: Bearer $KEY" https://orqis.xyz/api/v1/me

# Search
curl -H "Authorization: Bearer $KEY" "https://orqis.xyz/api/v1/agents?q=landing"

# Invoke
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"productName":"Bark","oneLiner":"A smart dog collar."}' \
  https://orqis.xyz/api/v1/agents/landing-forge/invoke
```

The internal `/api/agents/:slug/invoke` route still works (the dashboard uses
it). Both routes share the same handler — auth resolution is the only
difference.

---

## 3. JS SDK (`@orqis/sdk`)

Source lives at `orqis-sdk/` (sibling of `orqis-frontend` / `orqis-backend`).
Built TypeScript output lands in `orqis-sdk/dist/`.

Install + build locally:

```bash
cd ../orqis-sdk
npm install
npm run build
```

Smoke-test against your local dev server:

```ts
import { Orqis } from "../orqis-sdk/dist/index.js";

const orqis = new Orqis({
  apiKey: "or_live_...",
  baseUrl: "http://localhost:3000",
});

const me = await orqis.me();
console.log(`balance: ${me.user.creditBalance} credits`);
```

To publish to npm (manual step — when you're ready):

```bash
cd orqis-sdk
npm login            # one-time per machine
npm publish --access public
```

The package name is `@orqis/sdk` (scoped). You'll need to either own the
`orqis` org on npm or change the name in `package.json` if it's taken.

---

## 4. poster-forge

**/agents/poster-forge** → Run with the seed example (a "PARSE NIGHT 09"
flyer brief). In mock mode (default) you'll get back a real poster — gradient
background, accent-color hairline, large title with kerning, subtitle, event
details footer, mock watermark. The PNG is saved at `storage/r/<id>.png` and
served at `/r/<id>.png`.

To enable Gemini (`gemini-2.5-flash-image-preview`, codename "nano banana"):

1. `npm install @google/genai` in `orqis-backend`.
2. Set `GOOGLE_API_KEY=…` in `orqis-backend/.env`.
3. Replace the `runReal()` stub in `services/poster-forge.ts` with a Gemini
   `generateImages` call → buffer → sharp composite of the title text on top
   (image models still don't reliably render long titles).

Wire shape and route handler don't change.

---

## What's deferred to Sprint 11

- **`/docs` page** — Scalar-rendered OpenAPI spec at orqis.xyz/docs.
- **Seller analytics** — per-agent invocations chart + revenue + p50/p95
  latency on `/dashboard/agents/:slug/analytics`.
- **MCP server** — `npx @orqis/mcp` exposing the public API to Claude / Cursor.
- **Real npm publish of `@orqis/sdk`** — manual when you're ready.
- **Real Gemini wiring on poster-forge.**
