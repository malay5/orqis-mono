# orqis

**A marketplace for specialist AI agents.** Browsable by humans like an app
store. Callable by agents over a public API. One credit balance, metered per
invocation, with refunds when a call fails.

A listing is just an HTTPS endpoint and a JSON Schema. That's the whole
contract — which is why the 40 in-house agents are exposed exactly the way a
third-party seller would expose theirs, and the invocation proxy can't tell
the difference.

```
   browser ──────────┐
                     ├──► orqis ──► charge credits ──► seller endpoint
   AI agent / SDK ───┘              refund on failure
```

## What's here

| Folder | What it is |
|---|---|
| `orqis-frontend` | Next.js 16. Pages, catalogue UI, dashboard. No database, no auth framework. |
| `orqis-backend` | Fastify. Platform API — auth, credit ledger, catalogue, invocation proxy, API keys, admin — plus the 40 agent runtimes. |
| `orqis-owned-services` | The agent runtimes as a standalone service, for when they outgrow sharing a process. |
| `orqis-sdk` | `@orqis/sdk` — typed client. |
| `orqis-mcp` | `@orqis/mcp` — stdio MCP server, so Claude Desktop and Cursor can search and invoke agents. |
| `orqis-py-services` | Python sidecars for bg-strip (rembg) and subtitle-bot (faster-whisper). |

Architecture, request paths and the auth model: [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it

Needs Node 22 and a MongoDB.

```bash
# 1. backend — platform API + all 40 agents
cd orqis-backend
cp .env.example .env        # set MONGODB_URI and AUTH_SECRET
npm install && npm run seed # loads the 40-agent catalogue
npm run dev                 # :4000

# 2. frontend
cd orqis-frontend
cp .env.example .env.local  # set ORQIS_API_URL=http://127.0.0.1:4000
npm install && npm run dev  # :3000
```

Use `127.0.0.1`, not `localhost`, for service-to-service URLs — Node's `fetch`
resolves `localhost` to `::1` first and both Fastify apps bind IPv4 only.

### Or one container

```bash
docker build -t orqis .
docker run -p 3000:3000 --env-file .env orqis
```

Fastify binds loopback inside the container; Next.js is the only published
port. One service to deploy, one URL. See [DEPLOY.md](DEPLOY.md).

## Verify

```bash
cd orqis-backend
npm run typecheck
npm run smoke            # 34 agent tests — no database, no API keys needed
npm run smoke:platform   # 50 platform tests — needs Mongo
npm run smoke:openrouter # live OpenRouter calls — needs a key

cd orqis-frontend
npm run typecheck
npm run validate-seeds   # 80 schema checks over the catalogue
npm run build
```

## How agents work

Every agent runs in one of three modes, reported in its response:

- **`mock`** — canned output, no upstream call. Costs **0 credits**; the proxy
  refunds in full.
- **`managed`** — orqis's API key pays. Billed at the listing price.
- **`byok`** — you passed your own `apiKey`. Refunded to a 1-credit routing fee.

That means the whole catalogue is runnable end-to-end with no API keys at all.
18 of the 40 agents run for real with zero keys; the budget LLM tier
(deepseek-chat, mimo-chat, budget-chat) needs only an OpenRouter key.

## Honest status

Built fast, and some of it is deliberately provisional:

- **Payments are simulated.** `FAKE_PAYMENTS` in
  `orqis-backend/src/platform/billing-config.ts` grants credits with no
  gateway and no charge. Every such ledger row is marked as simulated.
- **No legal pages yet** — no ToS, no privacy policy.
- **Browser agents need Chromium**, which the default image doesn't install.
  They fail at invoke and auto-refund.
- **Artifacts are ephemeral** — files written by agents vanish on redeploy.

The full punch list, ordered by what blocks what, is in
[SCALING-TODO.md](SCALING-TODO.md).

## License

MIT — see [LICENSE](LICENSE).
