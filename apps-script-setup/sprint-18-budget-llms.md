# orqis — Sprint 18: Budget LLM tier via OpenRouter (3)

Cheap chat-completion listings so buyers can burn tokens without burning
credits. All three share one service (`openrouter-chat.ts`) and one key.

## Catalogue additions

| Slug | Default model | Managed allowlist | Price (managed) | Price (BYO) |
|---|---|---|---|---|
| `deepseek-chat` | `deepseek/deepseek-chat` | + `deepseek/deepseek-r1` | 2 | 1 |
| `mimo-chat` | `xiaomi/mimo-v2-flash` | that only | 2 | 1 |
| `budget-chat` | `deepseek/deepseek-chat` | full budget catalogue (8 models) | 2 | 1 |

**Catalogue total: 40 agents** (37 pre-existing + 3 new).

## Why OpenRouter, not per-vendor SDKs

One API key, OpenAI-compatible wire format, every cheap vendor (DeepSeek,
Xiaomi, Alibaba, Meta, Google, Moonshot, Zhipu) behind it. Adding a model
is a one-line change to `BUDGET_MODELS` in `openrouter-chat.ts` — no new
SDK, no new env var. OpenRouter also returns `usage.cost` per call, which
we surface as `usage.costUsd` so buyers see real upstream spend.

## Setup

```powershell
# orqis-backend/.env  AND  Railway env on orqis-owned-services
OPENROUTER_API_KEY=sk-or-v1-...

# optional — swap the budget-chat allowlist live, no redeploy
OPENROUTER_BUDGET_MODELS=deepseek/deepseek-chat,xiaomi/mimo-v2-flash,qwen/qwen3-30b-a3b
```

Mint a key at <https://openrouter.ai/keys>. Put a **spend limit on the
key** in the OpenRouter dashboard — this is the only hard ceiling on
managed-mode cost until per-user rate limits land (see "What's left").

Unset → mock mode, same as every other agent.

## Cost guard-rails baked in

- **Managed-mode allowlist.** `model` must be on the listing's allowlist
  when orqis's key is paying. `budget-chat` uses the full `BUDGET_MODELS`
  list (or the env override); the named listings pin one or two slugs.
  Off-list → 400 with the allowlist in the error message.
- **BYO key lifts the allowlist.** `apiKey` in the body = their OpenRouter
  account, their bill, any model (including `:free` variants).
- **`maxTokens` capped at 4096 in managed mode** (8192 BYO). Output tokens
  are where "cheap" stops being cheap.
- **Model-id regex** requires `vendor/model[:variant]` shape so a stray
  `gpt-4o` string can't be forwarded.

## Model slugs — verify before going live

Slugs in `BUDGET_MODELS` are from memory and OpenRouter renames releases
regularly (e.g. `deepseek-chat` → `deepseek-chat-v3-0324` → …). Before
flipping `OPENROUTER_API_KEY` on in prod, put the key in
`orqis-backend/.env` and run:

```powershell
cd orqis-backend
npm run smoke:openrouter -- --catalogue   # free: resolves every slug, prints live pricing
npm run smoke:openrouter                  # adds 3 real calls (~$0.00002) + guard-rail checks
```

The `--catalogue` phase hits `GET /api/v1/models` and fails any slug that
no longer resolves or that has drifted above the $1/M input budget band.
Fix drift in `BUDGET_MODELS` (both backends) **and** in the
`longDescription` / `model.description` strings in `seed-agents.ts`, then
`npm run seed`.

Or skip the redeploy: set `OPENROUTER_BUDGET_MODELS` to the corrected list
and only `budget-chat`'s allowlist changes.

## File layout

```
orqis-backend/src/  AND  orqis-owned-services/src/   (mirrored)
  services/openrouter-chat.ts   # ← new — dual-mode, allowlist, costUsd
  routes/v1/tier-d-llm.ts       # ← OPENROUTER_LISTINGS loop, 3 GETs + 3 POSTs
orqis-backend/scripts/smoke-tier-a-b.ts   # ← +4 tests (3 mock, 1 validation) — 34/34
orqis-frontend/src/data/seed-agents.ts    # ← 3 entries after gemini-chat
```

## What's left (inherits Sprint 17's list)

1. **BYO-mode rebate** in the invocation proxy — still bills `pricePerCall`
   regardless of `mode`. Matters less at 2 credits than at 10, but the
   docs promise 1.
2. **Per-user rate limits on managed passthroughs** — 100 signup credits
   at 2/call = 50 free LLM calls per throwaway account. OpenRouter key
   spend limit is the backstop until this lands.
3. **Streaming** — deferred platform-wide.
