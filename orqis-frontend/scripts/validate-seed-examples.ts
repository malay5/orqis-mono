/**
 * Validate every seed agent's `exampleRequest` against its own `inputSchema`.
 *
 * The tester flagged that per-agent Try-It rendering across the full
 * catalogue was untested manually. This script catches the same class of
 * regressions automatically: any seed entry whose canned example doesn't
 * parse against its declared schema would 400 the moment a user hits "Run"
 * with the example pre-filled.
 *
 * Run:
 *   npm run validate-seeds
 *
 * Exits 0 if every agent's exampleRequest is valid; non-zero (with a
 * per-agent breakdown) on any failure. Schemas with no exampleRequest are
 * skipped with a warning, not a failure.
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { SEED_AGENTS } from "../src/data/seed-agents";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

type Result = { slug: string; ok: boolean; note: string; errors?: string[] };

function summarizeAjvErrors(errors: unknown): string[] {
  if (!Array.isArray(errors)) return ["(no error detail)"];
  return errors.slice(0, 5).map((e) => {
    const path = (e as { instancePath?: string }).instancePath || "/";
    const message = (e as { message?: string }).message ?? "validation failed";
    return `${path} ${message}`.trim();
  });
}

function checkPair(
  slug: string,
  schema: unknown,
  example: unknown,
  side: "input" | "output"
): Result {
  if (!schema || typeof schema !== "object") {
    return { slug, ok: true, note: `skipped ${side} — no schema` };
  }
  if (!example || typeof example !== "object") {
    return { slug, ok: true, note: `skipped ${side} — no example` };
  }
  try {
    const validate = ajv.compile(schema);
    if (validate(example)) {
      return { slug, ok: true, note: `${side} ok` };
    }
    return {
      slug,
      ok: false,
      note: `example${side === "input" ? "Request" : "Response"} fails ${side}Schema`,
      errors: summarizeAjvErrors(validate.errors),
    };
  } catch (err) {
    return {
      slug,
      ok: false,
      note: `${side}Schema did not compile`,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

function check(agent: (typeof SEED_AGENTS)[number]): Result[] {
  return [
    checkPair(agent.slug, agent.inputSchema, agent.exampleRequest, "input"),
    checkPair(agent.slug, agent.outputSchema, agent.exampleResponse, "output"),
  ];
}

function main(): void {
  console.log(
    `\n${DIM}Validating ${SEED_AGENTS.length} seed agents (input + output)…${RESET}\n`
  );
  const results = SEED_AGENTS.flatMap(check);

  let passed = 0;
  let skipped = 0;
  let failed = 0;
  for (const r of results) {
    const marker = r.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const noteColor = r.note.startsWith("skipped") ? DIM : "";
    console.log(`  ${marker}  ${r.slug.padEnd(28)} ${noteColor}${r.note}${RESET}`);
    if (r.errors) {
      for (const e of r.errors) {
        console.log(`     ${YELLOW}↳ ${e}${RESET}`);
      }
    }
    if (!r.ok) failed++;
    else if (r.note.startsWith("skipped")) skipped++;
    else passed++;
  }

  console.log(
    `\n${failed === 0 ? GREEN : RED}${passed} passed${RESET}, ${DIM}${skipped} skipped${RESET}, ${failed === 0 ? DIM : RED}${failed} failed${RESET}\n`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main();
