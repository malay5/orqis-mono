# orqis-backend

Backend service for [orqis](https://orqis.xyz) — a marketplace for AI agents.

> **Role as of Sprint 16: local-dev only.** Not deployed to Railway. The
> production agent host is [`orqis-owned-services/`](../orqis-owned-services/)
> — a leaner Fastify app that ships the 28 in-house agents over HTTP, the
> same way third-party seller agents will be exposed.
>
> orqis-backend continues to live here because (a) the seed catalogue's
> `endpointUrl` fields still point at `http://localhost:4000/...` in dev, and
> (b) the `/v1/_mock/{echo,fail,slow}` endpoints are useful when exercising
> the invocation proxy locally. Treat any agent-handler edits you make here
> as "must mirror into `orqis-owned-services/`" until/unless we collapse one
> into the other.

This was the Sprint 1 placeholder: just a Fastify server with a `/health` endpoint. Real functionality (auth, agent invocation proxy, REST search API, MCP server) landed in Sprints 2-11. Agent code itself moved to `orqis-owned-services/` in Sprint 16.

## Stack

- Node 20 + TypeScript (ESM)
- Fastify 5
- pino logging (pretty in dev, JSON in prod)
- CORS configured via `CORS_ORIGINS` env

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Then:

```bash
curl http://localhost:4000/health
# { "status": "ok", "uptime": ..., "timestamp": "..." }
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Run with hot-reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled output (use in production) |
| `npm run typecheck` | Type-check without emitting |

## Deploy to Railway (planned, Sprint 2)

This project is set up to deploy to Railway. Railway auto-detects Node + the `start` script. Set these env vars in Railway:

- `NODE_ENV=production`
- `CORS_ORIGINS=https://orqis.xyz,https://www.orqis.xyz`
- `PORT` is provided by Railway automatically.

## Roadmap

See the full 12-week sprint plan in the founder's planning doc. Short version:

- **Sprint 2:** Postgres (Neon) + Prisma + auth bridge
- **Sprint 4:** Credit ledger
- **Sprint 6:** Agent invocation proxy + metering
- **Sprint 10:** Public REST search/invoke API + OpenAPI docs
- **Sprint 11:** MCP server (`npx @orqis/mcp`)
