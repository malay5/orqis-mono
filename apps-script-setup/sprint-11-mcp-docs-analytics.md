# orqis — Sprint 11: MCP server + /docs + seller analytics

Three substantial pieces shipped together.

No new env vars on the orqis stack itself. The MCP server has its own
two env vars (`ORQIS_API_KEY`, optional `ORQIS_BASE_URL`) but those live
in the **MCP host's** config (Claude Desktop / Cursor / Claude Code), not
in `orqis-frontend/.env.local`.

---

## 1. `/docs` — Scalar-rendered API reference

Public API docs at <http://localhost:3000/docs> in dev (and `https://orqis.xyz/docs` in prod).

Source: `public/openapi.json` is hand-written (5 endpoints + Bearer auth +
shared schemas). [`/docs/page.tsx`](../orqis-frontend/src/app/docs/page.tsx)
loads Scalar's React renderer and points it at the spec.

If you change a public endpoint, **edit the spec** — there's no codegen yet.
Scripted generation from the route handlers is post-MVP.

---

## 2. `@orqis/mcp` — MCP server

Lives at `orqis-mcp/` (sibling folder, gitignored like `orqis-sdk/`).

### Build + smoke test

```bash
cd orqis-sdk && npm run build       # required: orqis-mcp depends on the SDK via file: link
cd ../orqis-mcp && npm install && npm run build
npm run smoke                        # 8 tests, no servers needed
```

The smoke test wires the MCP server to an in-memory transport with a
stubbed orqis SDK and exercises every tool. Useful as a regression guard
the next time we touch either the MCP wiring or the underlying tool
descriptors.

### Install in Claude Desktop

```bash
# 1. Mint a key in the dashboard
open http://localhost:3000/dashboard/api-keys

# 2. Add to ~/Library/Application Support/Claude/claude_desktop_config.json
#    (or %APPDATA%\Claude\claude_desktop_config.json on Windows)
{
  "mcpServers": {
    "orqis-local": {
      "command": "node",
      "args": [
        "D:\\startups\\agentic-shop-orchis\\orqis-mcp\\bin\\orqis-mcp.js"
      ],
      "env": {
        "ORQIS_API_KEY": "or_live_...",
        "ORQIS_BASE_URL": "http://localhost:3000"
      }
    }
  }
}

# 3. Restart Claude Desktop. Five new tools appear in the picker.
```

For production (after `npm publish --access public`), swap to
`"command": "npx"` + `"args": ["-y", "@orqis/mcp"]`. README in the
`orqis-mcp/` folder has the full instructions for Claude Code, Cursor too.

### What Claude can now do

In a fresh chat:

> Find an orqis agent that generates landing pages, and use it to make
> one for a smart dog collar called Bark.

Claude calls `orqis_search_agents("landing page")` → picks `landing-forge`
→ calls `orqis_get_agent("landing-forge")` to read the input schema →
calls `orqis_invoke_agent("landing-forge", { productName: "Bark", ... })`
→ relays the `previewUrl` from the result.

---

## 3. Seller analytics — `/dashboard/agents/:slug/analytics`

Per-agent dashboard for sellers (and admins). Available at:

```
/dashboard/agents/landing-forge/analytics
```

Server-renders the last 30 days of activity for an agent the caller owns
(or any agent if `role === "admin"`). Slugs you don't own / don't exist
both 404 — by design, no enumeration.

### What's on the page

- 8 stat cards: invocations, credits earned, success rate, refund rate,
  p50 / p95 latency (samples capped at 5k for cheap math; t-digest later
  if scale demands), average rating, pending count.
- Stacked bar chart, 30 days, three colors (cyan succeeded / pink
  failed+refunded / violet pending). **Hand-drawn SVG** — no chart
  library. Polish with recharts or similar later if the dashboard becomes
  a daily-use surface.
- Recent 15 invocations + recent 8 reviews, side by side.

### Where the data comes from

Single Mongo aggregation in [`lib/seller-analytics.ts`](../orqis-frontend/src/lib/seller-analytics.ts). Five parallel queries:

1. `$group` invocations by status → counts + credits.
2. `$group` invocations by `($dateToString, status)` → daily stack data.
3. `find` succeeded invocations with latencies (capped 5k, sorted client-side
   for percentiles).
4. `find` recent 15 invocations.
5. `find` recent 8 reviews.

Permission check (`isOwner || isAdmin`) happens before the aggregation runs.

### Linking in

`/dashboard/agents` now shows an **Analytics** link next to the **View
public listing** link on every row. No schema changes — purely a new view
on data we already had.

---

## What's deferred to Sprint 12 (final sprint)

- Bug bash, Lighthouse pass, empty/error states, onboarding tour.
- `/changelog` page, blog (MDX).
- Resend email blast to waitlist on launch day.
- Status page, ProductHunt assets, X/HN/LinkedIn launch posts.
- Open-sourcing the SDK + MCP repos publicly.

Plus carry-overs that need real infra:

- R2 storage for landing-forge / poster-forge / img-shrink output.
- BullMQ + Upstash Redis to replace the in-process async runner.
- Real Anthropic / Gemini / ElevenLabs wiring on the three premium agents.
- `npm publish --access public` on `@orqis/sdk` and `@orqis/mcp`.
