# orqis — Sprint 7: landing-forge

orqis's first in-house agent. Generates a self-contained HTML landing page from
a one-paragraph brief. Lives inside `orqis-backend` (no separate service yet)
and is registered on the marketplace as the seed agent `landing-forge`.

## 1. Pick a mode

The agent has two modes, controlled by `ANTHROPIC_API_KEY` in `orqis-backend/.env`:

| `ANTHROPIC_API_KEY` value | Mode | What happens |
| --- | --- | --- |
| unset, or literally `mock` | **mock** | Returns a hand-written sample HTML page. Free. Use this to smoke-test the full pipeline (auth, credit debit, file save, iframe preview) without burning tokens. The default. |
| a real `sk-ant-...` key | **real** | Calls `claude-sonnet-4-6` with prompt caching + structured output. Costs roughly the price of one Sonnet call (a few cents at most; subsequent calls hit the prompt cache). |

For local development start in `mock` — flip to a real key only when you want
to see what the model actually produces.

## 2. Reseed

Sprint 7 adds a new seed entry (`landing-forge`) and the seed script writes the
new `endpointUrl` field. Re-run after pulling Sprint 7 changes:

```bash
cd orqis-frontend
npm run seed
```

You should see `landing-forge (new)` in the log.

## 3. Run both apps

The agent's endpoint is `http://localhost:4000/v1/agents/landing-forge/run`,
so the **backend** must be running:

```bash
# terminal 1
cd orqis-backend && npm run dev   # → http://localhost:4000

# terminal 2
cd orqis-frontend && npm run dev  # → http://localhost:3000
```

Then sign in, go to **/agents/landing-forge**, edit the JSON in the Try-it panel
(the example has a smart dog collar — change to whatever), hit **Run agent**.

You should see:
- A green success card with latency, `5` credits charged, new balance.
- A **sandboxed iframe preview** showing the actual rendered landing page.
- "↓ download" and "↗ open" links above the iframe.
- Raw JSON response collapsed underneath.

The HTML file is saved at `orqis-backend/storage/r/<id>.html` and served at
`http://localhost:4000/r/<id>.html`. The `storage/` directory is gitignored.

## 4. Failure paths

The route returns `502` when the underlying generation fails (Anthropic outage,
schema validation error, etc.). The orqis invocation proxy then **refunds the
credits automatically** (Sprint 6 behavior — verify on `/dashboard/credits`).

You can deliberately trigger a failure by setting `ANTHROPIC_API_KEY=sk-ant-bad`
in `orqis-backend/.env`, restarting, and clicking Run.

## 5. Bonus — img-shrink (utility API, not an agent)

Sprint 7 also ships `img-shrink` — a sharp-powered image compressor / format
converter exposed at `POST /v1/agents/img-shrink/run`. **It does not call an
LLM.** Listing it on orqis is the deliberate signal that the marketplace is
for any callable specialist API, not just AI.

- 1 credit per call. Sync. ~200ms typical for a 1MB JPEG.
- Inputs: `imageUrl` (https only, SSRF-guarded, 25 MB cap) **or** `imageBase64`,
  plus `format` (`jpeg|png|webp|avif|auto`, default `webp`), `maxWidth`
  (default 1920), `quality` (default 80).
- Outputs: `previewUrl` (rendered inline in the Try-it panel as an `<img>` on
  a checkerboard so transparency is visible), `downloadUrl`, `outputFormat`,
  `originalBytes`, `outputBytes`, `compressionRatio`, `width`, `height`.

Try it with the seed example (an Unsplash JPEG → 1280px WebP) — should compress
to roughly 20% of the original size.

## 6. Production notes (post-MVP)

- **Storage:** Files currently live on the backend's local disk. For prod, swap
  the file write in `services/landing-forge.ts` for an R2 upload and update
  `previewUrl` to point at the R2 public bucket. One-file change.
- **Endpoint URL:** The seed entry hardcodes `http://localhost:4000/...`. When
  the backend deploys to Railway, update either via the seed file + reseed or
  directly in MongoDB (`db.agents.updateOne({slug: "landing-forge"}, {$set: {endpointUrl: "https://api.orqis.xyz/..."}})`).
- **Prompt caching:** The system prompt is cached with `cache_control: ephemeral`.
  Don't edit `SYSTEM_PROMPT_DESIGN_RULES` in `services/landing-forge.ts`
  casually — every byte change invalidates the cache and the next request pays
  the full ~3K-token write cost again. Verify with `meta.cacheReadTokens` in
  the response (should be > 0 after the second call).
