# orqis — deployment

**One container, one deploy.** The whole platform ships as a single Docker
image. You need exactly two external things: a container host and a MongoDB.

```
                       ┌─────────────────────────────────┐
   browser ───────────►│  :$PORT   orqis-frontend        │
   AI agent / SDK      │           (Next.js)             │
                       │              │                  │
                       │              ▼ 127.0.0.1:4000   │   ┌──────────────┐
                       │           orqis-backend         │──►│ MongoDB      │
                       │           (Fastify + 40 agents) │   │ Atlas (M0)   │
                       └─────────────────────────────────┘   └──────────────┘
                          one container, one published port
```

The backend is **not published**. It binds loopback inside the container, and
the frontend proxies every call to it through its own route handlers — which
is what lets one port serve both the site and the public `/api/v1/*` API.

---

## 1. MongoDB Atlas (5 min)

1. Create a free **M0** cluster.
2. Database Access → add a user with *Read and write to any database*.
3. Network Access → allow `0.0.0.0/0`. Container hosts don't publish static
   egress IPs on the lower plans, so an allowlist won't work.
4. Connection string, with the database name appended:
   `mongodb+srv://USER:PASS@cluster.mongodb.net/orqis?retryWrites=true&w=majority`

## 2. Build and run

```bash
docker build -t orqis .
docker run -p 3000:3000 --env-file .env orqis
```

The only variables you must supply:

| Variable | Value |
|---|---|
| `MONGODB_URI` | the Atlas string from step 1 |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_SITE_URL` | your public domain — **set this before first deploy** |
| `ENCRYPTION_KEY` | another 32 random bytes, for sellers' stored auth headers |
| `ADMIN_EMAILS` | your email, comma-separated for several |
| `OPENROUTER_API_KEY` | optional — turns the budget LLM tier real. Put a spend limit on it. |

Everything else (`PORT`, `ORQIS_API_URL`, `OWNED_SERVICES_BASE_URL`,
`PUBLIC_BASE_URL`) has a working default baked into the image.

The backend refuses to start without `MONGODB_URI` and `AUTH_SECRET`, and the
supervisor reports which one is missing rather than hanging.

## 3. Deploy it

Any host that runs a container works. **Render**: New → Web Service → Docker,
health check path `/`. **Fly.io**: `fly launch` and it detects the Dockerfile.
**Railway**: same.

Take a paid instance, not a free tier that sleeps. Free tiers idle out after
~15 minutes and the next request takes ~50 seconds — and since every page read
goes through this container, a cold start stalls the entire site, not just
agent calls.

Memory: **1 GB minimum**, 2 GB comfortable. Two Node processes plus sharp.

### Seed the catalogue

Once it's running, from a shell in the container:

```bash
cd orqis-backend && npm run seed:prod
```

This writes all 40 agents and points each `endpointUrl` at
`OWNED_SERVICES_BASE_URL`. **Re-run it whenever that value changes** — the URL
is baked into the database at seed time, so a stale value makes every in-house
agent fail with `fetch failed You were refunded.`, which reads like a broken
agent rather than a config problem.

## 4. Verify

```bash
curl https://your-domain/                        # 200
curl https://your-domain/api/v1/agents | head    # catalogue JSON
```

Then in a browser: sign up → confirm 5 credits → `/browse` → invoke
`email-truth` → check `/dashboard/credits` shows the debit.

---

## Splitting it up later

The single container is a convenience, not a ceiling. When you outgrow it:

- **Frontend to Vercel** — two variables and one binding change, no code:
  1. On the frontend: `ORQIS_API_URL=https://your-backend-host`
  2. On the backend: `ORQIS_BACKEND_HOST=0.0.0.0` and publish port 4000. Inside
     the single container it binds loopback, which nothing outside can reach.
  3. On the backend: `CORS_ORIGINS=https://your-frontend-domain`

  **`ORQIS_API_URL` is the one people forget.** Without it the frontend falls
  back to its local-dev default and every request fails with
  `connect ECONNREFUSED 127.0.0.1:4000` — which reads as "the backend is down"
  when the app was simply never told where the backend lives. The frontend has
  no database of its own, so this breaks every page, not just agent calls. A
  deployed build now reports the real cause and names the variable.

  Worth weighing before splitting: 11 pages are server-rendered and call the
  backend on every request, so a cross-host round trip is added to each page
  load. Co-locating them avoids it entirely.
- **Agents to their own service** — `orqis-owned-services` is a standalone
  Fastify app with the same 40 agents. Deploy it, point
  `OWNED_SERVICES_BASE_URL` at it, re-seed, and delete the agent code from
  `orqis-backend`.

## Known limits

- **Browser agents will fail.** page-shot, pdf-render, scrape-render,
  site-crawl, lighthouse-audit and a11y-quick need Chromium, which this image
  deliberately does not install (it would add ~400 MB for agents that can't fit
  a small instance anyway). They fail at invoke and **auto-refund** the caller
  — correct behaviour, but not a good demo. `orqis-owned-services/Dockerfile`
  has the Chromium setup if you want them on a bigger box.
- **Artifacts are ephemeral.** Files written to `storage/r/` vanish on every
  redeploy. Every `previewUrl` from a file-emitting agent dies with it.
  Cloudflare R2 is the fix — P0 on the roadmap.
- **Third-party async agents can't call back.** The webhook URL points at
  loopback, which is fine while every agent is in-house and in-process. A
  real external seller would need the backend publicly reachable, or a
  passthrough webhook route on the frontend.
- **`FAKE_PAYMENTS` is on.** Checkout grants credits with no gateway. Don't
  point a real domain at this and call it commerce — see SCALING-TODO.md → P1.
