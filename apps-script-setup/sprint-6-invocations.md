# orqis — Sprint 6: invocations end-to-end

Sprint 6 wires the invocation proxy: clicking **Run agent** on a detail page
actually POSTs to the seller's endpoint, debits credits, validates against
their JSON Schema, and refunds on failure.

No new env vars. Two operational chores.

## 1. Reseed

The seed file has a new agent — `mock-echo` — and the seed script writes the
new `endpointUrl` field. Re-run it after pulling Sprint-6 changes:

```bash
cd orqis-frontend
npm run seed
```

You should see `mock-echo (new)` in the log.

## 2. Run both apps

The `mock-echo` agent points at `http://localhost:4000/v1/_mock/echo`, which is
served by the **backend**. So both have to be running:

```bash
# terminal 1
cd orqis-backend && npm run dev   # → http://localhost:4000

# terminal 2
cd orqis-frontend && npm run dev  # → http://localhost:3000
```

Then sign in, go to **/agents/mock-echo**, edit the JSON if you like, hit
**Run agent**. You should see:

- A green success card with the round-trip latency, `1` credit charged, and
  your new balance.
- The pretty-printed echo response (your input plus `receivedAt` + `orqisInvocationId`).
- The agent's `invocationCount` ticks up by 1 (visible above the "Try it"
  panel after the page refreshes).
- **/dashboard** Activity now lists the run.
- **/dashboard/credits** has a new `-1` row labelled "Agent invocation".

## What's intentionally not done yet

- **Async agents** (`isAsync=true` — currently `lead-loom` and the in-house
  agents we'll build in Sprints 8–9) return `501` from the invoke route. Real
  async invocation needs a queue (BullMQ + Redis) which arrives in Sprint 8.
- **API-key auth** for programmatic clients lands in Sprint 10 with the public
  REST surface. The invoke route currently only accepts the NextAuth session.
- **Redis-backed rate limiting.** The current limiter is in-memory and per-process
  (defaults: 30 req/min per user). Same `take()` API will swap to Upstash in Sprint 8.

## Failure-path smoke tests

The backend also exposes `/v1/_mock/fail` (always 500) and `/v1/_mock/slow`
(sleeps 35s, past the 30s proxy timeout). Temporarily edit the `mock-echo`
seed agent's `endpointUrl` to either, reseed, and click Run — you should see:

- `_mock/fail` → red error card with the upstream 500 + a refund row in
  /dashboard/credits + a `failed` invocation row with errorCode `upstream_500`
  in /dashboard.
- `_mock/slow` → after ~30s, red error card with "Upstream did not respond
  within 30s" + a refund + an invocation row with errorCode `timeout`.

Don't forget to revert and reseed afterwards.
