# orqis — Sprint 17: Tier D LLM agents (8)

Three product shapes shipped together: markup-resell (A), product wrappers
(B), and BYO-key bundling (C). Same code paths handle A and C — the input
`apiKey` field toggles between them.

## Catalogue additions

| Slug | Shape | Provider | Mode toggle | Price (managed) | Price (BYO) |
|---|---|---|---|---|---|
| `claude-chat` | A + C | Anthropic | `ANTHROPIC_API_KEY` or input.apiKey | 10 | 1 |
| `gpt-chat` | A + C | OpenAI | `OPENAI_API_KEY` or input.apiKey | 10 | 1 |
| `gemini-chat` | A + C | Google | `GEMINI_API_KEY` or input.apiKey | 5 | 1 |
| `nano-banana` | A + C | Google (image-gen) | `GEMINI_API_KEY` or input.apiKey | 15 | 1 |
| `text-summarize` | B | Claude Haiku (internal) | `ANTHROPIC_API_KEY` | 3 | — |
| `entity-extract` | B | Claude Sonnet (internal) | `ANTHROPIC_API_KEY` | 5 | — |
| `code-explain` | B | Claude Sonnet (internal) | `ANTHROPIC_API_KEY` | 5 | — |
| `compare-models` | B | All three (parallel) | All three keys | 25 | — |

**Catalogue total: 36 agents** (28 pre-existing + 8 new).

## TOS reminder

Shapes **A + C** sit in legally grey territory. Anthropic / OpenAI / Google
TOS generally prohibit reselling API access. Risk:

- **A (markup resell)** — highest risk. Worst case: provider revokes our
  API key without warning, killing every premium agent.
- **C (BYO-key)** — low risk. We're not reselling access, we're routing
  the buyer's own credentials. Same legal posture as Cursor / Continue.dev.
- **B (product wrappers)** — minimal risk. We're building products that
  *use* the API, not reselling it. Same posture as 80% of AI startups.

User instruction (Sprint 17): "I will check with legal later when I go
live." Don't surface A as a marketing angle pre-legal-clearance — the
BYO-key (C) and product-wrapper (B) framings are safe to lead with.

## New backend deps

```powershell
cd orqis-backend && npm install --save openai @google/genai
cd ..\orqis-owned-services && npm install --save openai @google/genai
```

`@anthropic-ai/sdk` already installed in both backends from Sprint 7.

## File layout

```
orqis-backend/src/  AND  orqis-owned-services/src/
  services/
    claude-chat.ts        # ← new — dual-mode managed/BYO/mock
    gpt-chat.ts           # ← new — dual-mode
    gemini-chat.ts        # ← new — dual-mode
    nano-banana.ts        # ← new — dual-mode + SVG mock placeholder
    text-summarize.ts     # ← new — Claude Haiku + extractive mock
    entity-extract.ts     # ← new — Claude Sonnet + regex mock for emails/urls/phones/dates
    code-explain.ts       # ← new — Claude Sonnet, 4 audiences
    compare-models.ts     # ← new — Promise.all over the three chat agents
  routes/v1/
    tier-d-llm.ts         # ← new — single plugin, 8 GETs + 8 POSTs
  server.ts               # ← registers makeTierDLlmRoutes in both backends
```

Both backends carry copies (per the option-C decision from earlier this
sprint — orqis-backend is dev-only, orqis-owned-services is the prod
target, files mirror until we collapse them).

## Mode dispatch logic

For dual-mode agents (claude-chat / gpt-chat / gemini-chat / nano-banana),
`detectMode()` runs this decision:

```
if (input.apiKey?.trim())            return "byok";
if (process.env.<PROVIDER>_API_KEY)  return "managed";
return "mock";
```

The route layer doesn't see the mode until the service returns — the
result includes `mode: "byok" | "managed" | "mock"` so the orqis billing
layer can apply the right credit price at refund time.

**Credit-pricing implication**: the seed catalogue's `pricePerCall` is the
managed price. The invocation proxy needs to inspect the response's `mode`
field and rebate the difference for BYO-mode calls (full price − 1 routing
fee). That logic doesn't exist yet — currently every call is billed at
`pricePerCall` regardless. **Open item** for the invocation-proxy work,
ideally before any of these go live.

## Smoke test status — 29/29 passing

All 8 Tier D agents tested in mock mode (no API keys present in CI). Sample:

```
✓ claude-chat (mock)        [200]  75ms
✓ gpt-chat (mock)           [200]  78ms
✓ gemini-chat (mock)        [200]  78ms
✓ nano-banana (mock)        [200]  1904ms — SVG placeholder rasterised via sharp
✓ text-summarize (mock)     [200]   3ms — extractive heuristic
✓ entity-extract (mock)     [200]   2ms — regex preset extracted email correctly
✓ code-explain (mock)       [200]   2ms
✓ compare-models (mock)     [200]  68ms — all 3 providers responded, all 3 ok
```

Real-mode dispatch can't be smoke-tested without setting API keys (we
don't ship those in CI / dev), but the code path is identical to the
existing landing-forge / resume-rx / poster-forge real-mode paths that
already use the same SDKs.

## Per-agent design notes

### claude-chat / gpt-chat / gemini-chat (shared shape)

All three accept the same `messages[]` array — `{role, content}` pairs.
gpt-chat additionally accepts `system` role (matches OpenAI's native
shape); claude-chat / gemini-chat use a top-level `systemPrompt` field
(matches Anthropic / Google's native shape).

`apiKey` in input → BYO mode. Never logged. Never persisted. Used only
for the single request, then dropped.

Non-streaming. Streaming would require either:
- Server-Sent Events response (orqis invocation contract is currently JSON)
- Polling pattern (defeats the point of streaming)
Deferred.

### nano-banana

Direct Gemini image-gen passthrough. Distinct from `poster-forge` —
poster-forge wraps Gemini in a typographic pipeline (Claude plans
layout, Gemini renders artwork, sharp composites real text on top).
nano-banana just hands you the raw image-gen output.

Mock mode rasterises an SVG placeholder via sharp — gradient background +
prompt text + "MOCK" badge. Real PNG, ~30 KB, valid for `previewUrl`
preview-rendering in the catalogue.

### text-summarize

Claude Haiku (not Sonnet) for prose summarisation — quality gap is small,
cost gap is significant. Four styles (`neutral` / `executive` / `bulleted` /
`casual`) shape the prompt; output respects `maxWords`.

Mock mode = first / middle / last sentence extractive heuristic. Crude
but actually fine for short articles.

### entity-extract

Claude Sonnet (not Haiku) for structured-output reliability. Two
extraction modes:

- `preset` — 8 common kinds (people / places / dates / emails / phones /
  urls / money / products). Schema is built server-side.
- `schema` — caller supplies a JSON Schema, model is instructed to match it.

Mock mode covers the four primitive presets via regex (emails / urls /
phones / dates). Object-shaped presets (people / places / money /
products) need an LLM and return a stub in mock.

### code-explain

Claude Sonnet. Four audience presets shape the prompt:
- `beginner` — defines jargon, walks line-by-line
- `intermediate` (default) — assumes language fluency
- `senior` — leads with architecture + trade-offs
- `tech-lead` — leads with review-blocker risks

Returns prose `explanation` + extracted `bullets[]` for the top takeaways.

### compare-models

Fans `claude-chat` + `gpt-chat` + `gemini-chat` out in parallel via
`Promise.all`. Per-provider failures are non-fatal — the failing slot
returns `ok: false` + error message, others continue. `fastest` field
identifies the quickest successful provider.

No BYO key (would need three keys; confusing). Use the individual chat
agents for BYO.

## What's left

1. **Invocation-proxy BYO-mode billing**: needs to read `mode` from the
   response and rebate to 1-credit pricing for `mode === "byok"` calls.
   Currently every call bills at `pricePerCall`.
2. **Legal review** before public marketing of A-shape agents.
3. **Abuse rate-limits** on the managed-mode passthroughs — without it,
   100 free signup credits = abuse magnet.
4. **Streaming response support** — deferred.
