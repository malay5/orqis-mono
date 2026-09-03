/**
 * Live smoke test for the budget LLM tier (deepseek-chat / mimo-chat /
 * budget-chat) against the real OpenRouter API.
 *
 * Unlike scripts/smoke-tier-a-b.ts — which runs everything in mock mode and
 * spends nothing — this script makes real, billable calls. It is deliberately
 * a separate entry point so `npm run typecheck` + the normal smoke run stay
 * free and offline.
 *
 * Three phases:
 *
 *   1. CATALOGUE — GET /api/v1/models and confirm every slug in BUDGET_MODELS
 *      still resolves, printing current per-1M pricing. Free (no tokens).
 *      This is the "verify slugs before going live" check from
 *      apps-script-setup/sprint-18-budget-llms.md.
 *   2. LIVE CALLS — one tiny completion per listing via app.inject (no port
 *      opened), capped at 64 output tokens. Costs a fraction of a cent.
 *   3. GUARD-RAILS — confirm the managed-mode allowlist and slug regex still
 *      reject bad input while a real key is present (mock mode can hide this).
 *
 * Run:
 *   cd orqis-backend
 *   npx tsx scripts/smoke-openrouter-live.ts              # all three phases
 *   npx tsx scripts/smoke-openrouter-live.ts --catalogue  # phase 1 only, free
 *
 * Reads OPENROUTER_API_KEY from the environment or from orqis-backend/.env.
 * Exits 0 if all pass, non-zero on any failure. Exits 0 with a notice if no
 * key is configured, so CI can run it unconditionally.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.js";
import { BUDGET_MODELS, OPENROUTER_BASE_URL, budgetModelSlugs } from "../src/services/openrouter-chat.js";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

/** Minimal .env reader — the project has no dotenv dependency and doesn't need one. */
function loadDotEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "..", ".env");
  let raw: string;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Real environment always wins over the file.
    if (value && process.env[key] === undefined) process.env[key] = value;
  }
}

type Row = { name: string; ok: boolean; note: string; error?: string };
const rows: Row[] = [];

function pass(name: string, note: string): void {
  rows.push({ name, ok: true, note });
  console.log(`  ${GREEN}✓${RESET}  ${name.padEnd(30)} ${DIM}${note}${RESET}`);
}

function fail(name: string, note: string, error?: string): void {
  rows.push({ name, ok: false, note, error });
  console.log(`  ${RED}✗${RESET}  ${name.padEnd(30)} ${DIM}${note}${RESET}`);
  if (error) console.log(`     ${RED}${error}${RESET}`);
}

/** OpenRouter's /models payload — only the fields we care about. */
type ModelsResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    pricing?: { prompt?: string; completion?: string };
  }>;
};

function perMillion(raw: string | undefined): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "?";
  if (n === 0) return "free";
  return `$${(n * 1_000_000).toFixed(3)}`;
}

async function phaseCatalogue(apiKey: string): Promise<void> {
  console.log(`\n${YELLOW}1. Catalogue — do the slugs still resolve?${RESET}\n`);

  let body: ModelsResponse;
  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      fail("GET /models", `HTTP ${res.status}`, (await res.text()).slice(0, 300));
      return;
    }
    body = (await res.json()) as ModelsResponse;
  } catch (err) {
    fail("GET /models", "request failed", err instanceof Error ? err.message : String(err));
    return;
  }

  const live = new Map<string, { prompt?: string; completion?: string }>();
  for (const m of body.data ?? []) {
    if (m.id) live.set(m.id, m.pricing ?? {});
  }
  pass("GET /models", `${live.size} models visible on this account`);

  // BUDGET_MODELS is the compiled-in list; budgetModelSlugs() honours the
  // OPENROUTER_BUDGET_MODELS override, so check whichever is actually in force.
  const configured = budgetModelSlugs();
  const overridden = process.env.OPENROUTER_BUDGET_MODELS ? " (env override active)" : "";
  console.log(`${DIM}     checking ${configured.length} configured slugs${overridden}${RESET}`);

  for (const slug of configured) {
    const pricing = live.get(slug);
    const label = BUDGET_MODELS.find((m) => m.slug === slug)?.label ?? slug;
    if (!pricing) {
      fail(
        slug,
        "not on OpenRouter",
        `"${label}" — slug does not resolve. Fix BUDGET_MODELS in both backends, or set OPENROUTER_BUDGET_MODELS.`,
      );
      continue;
    }
    const inp = perMillion(pricing.prompt);
    const out = perMillion(pricing.completion);
    const promptCost = Number(pricing.prompt) * 1_000_000;
    const budgetBand = !Number.isFinite(promptCost) || promptCost <= 1;
    if (budgetBand) pass(slug, `in ${inp}/M · out ${out}/M`);
    else fail(slug, `in ${inp}/M · out ${out}/M`, "above the $1/M input budget band — reprice or drop it");
  }
}

async function phaseLiveCalls(app: FastifyInstance): Promise<void> {
  console.log(`\n${YELLOW}2. Live calls — one tiny completion per listing${RESET}\n`);

  const listings = [
    { slug: "deepseek-chat", expect: "deepseek/deepseek-chat" },
    { slug: "mimo-chat", expect: "xiaomi/mimo-v2-flash" },
    { slug: "budget-chat", expect: "deepseek/deepseek-chat" },
  ] as const;

  let totalCost = 0;

  for (const { slug, expect } of listings) {
    const started = Date.now();
    const res = await app.inject({
      method: "POST",
      url: `/v1/agents/${slug}/run`,
      payload: {
        messages: [{ role: "user", content: "Reply with exactly: orqis live check ok" }],
        maxTokens: 64,
        temperature: 0,
      },
    });
    const ms = Date.now() - started;

    if (res.statusCode !== 200) {
      fail(slug, `HTTP ${res.statusCode} in ${ms}ms`, res.body.slice(0, 400));
      continue;
    }

    const json = res.json() as {
      mode?: string;
      text?: string;
      model?: string;
      usage?: { costUsd?: number | null; promptTokens?: number; completionTokens?: number };
    };

    if (json.mode !== "managed") {
      fail(slug, `mode was "${json.mode}", expected "managed"`, "the key isn't reaching the service");
      continue;
    }
    if (!json.text) {
      fail(slug, "empty text", JSON.stringify(json).slice(0, 300));
      continue;
    }
    if (json.model !== expect) {
      fail(slug, `model was "${json.model}"`, `expected default "${expect}"`);
      continue;
    }

    const cost = json.usage?.costUsd;
    if (typeof cost === "number") totalCost += cost;
    const costLabel = typeof cost === "number" ? `$${cost.toFixed(6)}` : "cost not reported";
    const preview = json.text.replace(/\s+/g, " ").trim().slice(0, 48);
    pass(slug, `${ms}ms · ${costLabel} · "${preview}"`);
  }

  console.log(`${DIM}     total spend this run: $${totalCost.toFixed(6)}${RESET}`);
}

async function phaseGuardRails(app: FastifyInstance): Promise<void> {
  console.log(`\n${YELLOW}3. Guard-rails — still enforced with a real key present${RESET}\n`);

  const cases = [
    {
      name: "rejects non-slug model id",
      payload: { messages: [{ role: "user", content: "hi" }], model: "gpt-4o-mini" },
      slug: "budget-chat",
    },
    {
      name: "rejects off-allowlist model",
      payload: { messages: [{ role: "user", content: "hi" }], model: "openai/gpt-4o" },
      slug: "mimo-chat",
    },
    {
      name: "rejects empty messages",
      payload: { messages: [] },
      slug: "deepseek-chat",
    },
    {
      name: "rejects bad role",
      payload: { messages: [{ role: "root", content: "hi" }] },
      slug: "budget-chat",
    },
  ] as const;

  // Note: MANAGED_MAX_TOKENS is a clamp, not a rejection — an over-cap
  // `maxTokens` returns 200 with the value silently reduced. Proving the
  // ceiling from outside would need a deliberately long generation, so it
  // isn't asserted here; the clamp lives in validate() in the service.

  for (const c of cases) {
    const res = await app.inject({
      method: "POST",
      url: `/v1/agents/${c.slug}/run`,
      payload: c.payload,
    });
    if (res.statusCode === 400) {
      pass(`${c.slug} (${c.name})`, "400 as expected");
    } else {
      fail(
        `${c.slug} (${c.name})`,
        `got ${res.statusCode}, expected 400`,
        res.body.slice(0, 300),
      );
    }
  }
}

async function main(): Promise<void> {
  loadDotEnv();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log(
      `\n${YELLOW}OPENROUTER_API_KEY is not set — nothing to test live.${RESET}\n\n` +
        `  Mint a key at https://openrouter.ai/keys, put a spend limit on it, then:\n\n` +
        `    ${DIM}# orqis-backend/.env${RESET}\n` +
        `    OPENROUTER_API_KEY=sk-or-v1-...\n\n` +
        `  Mock-mode coverage for these agents already runs in ${DIM}scripts/smoke-tier-a-b.ts${RESET}.\n`,
    );
    return;
  }

  console.log(
    `\n${YELLOW}orqis — OpenRouter live smoke${RESET}  ${DIM}key ...${apiKey.slice(-4)} · real calls, real money${RESET}`,
  );

  await phaseCatalogue(apiKey);

  if (process.argv.includes("--catalogue")) {
    console.log(`\n${DIM}--catalogue: skipping live calls and guard-rails.${RESET}`);
  } else {
    const app = await buildApp();
    try {
      await phaseLiveCalls(app);
      await phaseGuardRails(app);
    } finally {
      await app.close();
    }
  }

  const failed = rows.filter((r) => !r.ok);
  const colour = failed.length ? RED : GREEN;
  console.log(
    `\n${colour}${rows.length - failed.length} passed, ${failed.length} failed${RESET}\n`,
  );
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`${RED}fatal:${RESET}`, err);
  process.exitCode = 1;
});
