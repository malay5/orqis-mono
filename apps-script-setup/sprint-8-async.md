# orqis — Sprint 8: async runtime + demo-forge

Sprint 8 wires the async invocation pipeline end-to-end (the path that
**every** async agent — demo-forge, course-quill, lead-loom — goes through)
and ships the in-house **demo-forge** product-demo video generator on top of it.

There are no new env vars to set for the basic flow. Real video rendering is
deferred (mock mode is the default, and it's enough to demo the whole loop).

## What changed

**Async invocation (works for every async agent now):**

1. You hit Run on an async agent. The orqis frontend invoke proxy charges credits + creates an `Invocation` row with `isAsync: true` and a per-invocation webhook secret hash.
2. It POSTs to the seller's endpoint with two new headers — `X-Orqis-Webhook-Url` (where to call back) and `X-Orqis-Webhook-Secret` (the secret to echo). Seller has 10s to ack with **202 Accepted**.
3. The TryItPanel gets back `{ status: "pending", invocationId }` and switches to a "Job pending" card that polls `/api/jobs/:id` every 2s.
4. The seller does its work in the background. When done it POSTs the result to `X-Orqis-Webhook-Url` with the secret echoed in the header.
5. Webhook handler verifies the secret (via SHA-256 hash compare), marks the invocation succeeded (or refunds + marks `refunded` on `ok: false`), bumps the agent's `invocationCount`, flips the user's reviews to `verifiedUse: true`.
6. Polling sees the new state, swaps to a success / error card. `/dashboard/jobs` updates the row in place.

**Failure paths (all auto-refunded):**

- Seller doesn't respond within 10s → `async_ack_timeout`.
- Seller acks but never webhooks back → row stays `pending` (no auto-fail yet — covered when we add the BullMQ worker with TTLs).
- Seller webhooks `ok: false` → refunded, error message surfaced in the UI + on `/dashboard/jobs`.

## demo-forge — try it

After reseeding (the seed entry now points at `http://localhost:4000/v1/agents/demo-forge/run` and uses `previewUrl` in the output schema):

```bash
cd orqis-frontend && npm run seed
```

Then in two terminals:

```bash
cd orqis-backend  && npm run dev
cd orqis-frontend && npm run dev
```

Sign in, go to **/agents/demo-forge**, hit Run. You should see:

- Frontend returns `{ status: "pending" }` ~instantly.
- TryItPanel shows a violet "Job pending" card with a live elapsed-time counter.
- After ~8 seconds, the card flips to a success panel with a video preview (the placeholder is a tiny Big-Buck-Bunny MP4 — replaced once the real Anthropic + ElevenLabs + Remotion pipeline lands).
- Open **/dashboard/jobs** in another tab while it runs — the row appears as `pending`, then auto-flips to `succeeded` without you reloading.

## Mock mode vs real

The backend's demo-forge service uses `MEDIA_PIPELINE` to switch:

- `MEDIA_PIPELINE=mock` (default) — sleeps 8s, returns a stable placeholder MP4 URL. Zero external API cost.
- `MEDIA_PIPELINE=real` — Claude → ElevenLabs voiceover → Remotion render. **Currently falls back to mock** with a TODO; the real implementation needs three keys + a render farm and lands as a follow-up. The wire shape and webhook contract don't change.

## Webhook auth model

The webhook secret is **per-invocation**, not shared. The frontend generates 24 random bytes per call, sends the plaintext to the seller in `X-Orqis-Webhook-Secret`, and stores only the SHA-256 hash on the `Invocation` row (`webhookSecretHash`). On callback, the handler hashes the presented secret and compares to the stored hash with `timingSafeEqual`. Plaintext is never persisted; rotation is implicit (every invocation gets a fresh secret).

This means **no `ORQIS_WEBHOOK_SECRET` env var is needed**. Original plan had a shared one; per-invocation is simpler and more secure.

## Production notes (post-MVP)

- **In-process worker** is fine for dev + low-volume in-house agents. `JOB_WORKER_MODE=bullmq` + Upstash Redis is a one-file swap inside `src/lib/async-runner.ts`. Same `runLater`, `webhookSuccess`, `webhookFailure` API.
- **Webhook delivery** retries 3x with exponential backoff (500 ms, 1 s, 2 s). Beyond that we drop and log. Real BullMQ swap adds at-least-once + a dead-letter queue.
- **Pending-job TTL** — currently absent. A pending invocation that never receives a webhook will sit there forever. Sweep job lands with the BullMQ swap.
- **Resume + re-poll on reload** — `/dashboard/jobs` polls fresh on every mount, so even after a hard reload pending jobs continue updating live.
