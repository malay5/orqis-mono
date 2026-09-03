/**
 * entity-extract — pull structured entities from free text.
 *
 * Two modes:
 *   - "schema" — caller hands us a JSON Schema describing the fields they
 *     want. We instruct Claude to return JSON matching it.
 *   - "preset" — common kinds: "people", "places", "dates", "emails",
 *     "phones", "urls", "money", "products". Schema is built server-side.
 *
 * Output is always a JSON object (or array of objects when the preset is
 * cardinality-many). Mock falls back to regex-based extraction for the
 * primitive presets (emails / urls / phones / dates) — surprisingly useful.
 */

import Anthropic from "@anthropic-ai/sdk";

export type EntityPreset = "people" | "places" | "dates" | "emails" | "phones" | "urls" | "money" | "products";

export type EntityExtractInput = {
  text: string;
  preset?: EntityPreset;
  schema?: Record<string, unknown>;
};

export type EntityExtractResult = {
  entities: unknown;
  preset: EntityPreset | "custom";
  mode: "managed" | "mock";
  modelUsed: string;
  durationMs: number;
};

const MODEL = "claude-sonnet-4-6";

export type EntityExtractMode = "managed" | "mock";

export function detectMode(): EntityExtractMode {
  return process.env.ANTHROPIC_API_KEY ? "managed" : "mock";
}

const PRESET_SCHEMAS: Record<EntityPreset, Record<string, unknown>> = {
  people: { type: "array", items: { type: "object", required: ["name"], properties: { name: { type: "string" }, role: { type: ["string", "null"] }, organization: { type: ["string", "null"] } } } },
  places: { type: "array", items: { type: "object", required: ["name"], properties: { name: { type: "string" }, kind: { type: "string", enum: ["city", "country", "region", "venue", "address", "other"] } } } },
  dates: { type: "array", items: { type: "string", description: "ISO 8601 date or date-range" } },
  emails: { type: "array", items: { type: "string", format: "email" } },
  phones: { type: "array", items: { type: "string", description: "Free-form phone number; run phone-truth to normalize" } },
  urls: { type: "array", items: { type: "string", format: "uri" } },
  money: { type: "array", items: { type: "object", required: ["amount", "currency"], properties: { amount: { type: "number" }, currency: { type: "string", description: "ISO 4217 code or symbol" }, context: { type: ["string", "null"] } } } },
  products: { type: "array", items: { type: "object", required: ["name"], properties: { name: { type: "string" }, brand: { type: ["string", "null"] }, price: { type: ["number", "null"] } } } },
};

function validate(input: EntityExtractInput): { text: string; preset: EntityPreset | "custom"; schema: Record<string, unknown> } {
  if (!input.text || typeof input.text !== "string") {
    throw new Error("text is required");
  }
  if (input.text.length > 100_000) {
    throw new Error(`text too long: ${input.text.length} chars (max 100k)`);
  }
  if (input.preset && input.schema) {
    throw new Error("pass either preset or schema, not both");
  }
  if (!input.preset && !input.schema) {
    throw new Error("either preset or schema is required");
  }
  if (input.preset && !PRESET_SCHEMAS[input.preset]) {
    throw new Error(`preset must be one of: ${Object.keys(PRESET_SCHEMAS).join(", ")}`);
  }
  if (input.schema && typeof input.schema !== "object") {
    throw new Error("schema must be a JSON Schema object");
  }
  const preset = input.preset ?? "custom";
  const schema = input.preset ? PRESET_SCHEMAS[input.preset] : (input.schema as Record<string, unknown>);
  return { text: input.text, preset, schema };
}

async function runReal(input: EntityExtractInput): Promise<EntityExtractResult> {
  const startedAt = Date.now();
  const { text, preset, schema } = validate(input);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `Extract entities from the user's text. Respond with ONLY a JSON value matching this schema, no preamble, no markdown fences:\n\n${JSON.stringify(schema)}`,
    messages: [{ role: "user", content: text }],
  });
  const block = res.content.find((b) => b.type === "text");
  const raw = (block && "text" in block ? block.text : "").trim();
  let entities: unknown;
  try {
    entities = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    entities = { _parseError: "model output was not JSON", _raw: raw.slice(0, 500) };
  }
  return {
    entities,
    preset,
    mode: "managed",
    modelUsed: res.model,
    durationMs: Date.now() - startedAt,
  };
}

const REGEX_PATTERNS: Partial<Record<EntityPreset, RegExp>> = {
  emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g,
  urls: /\bhttps?:\/\/[^\s)]+/g,
  phones: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g,
  dates: /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/g,
};

async function runMock(input: EntityExtractInput): Promise<EntityExtractResult> {
  const startedAt = Date.now();
  const { text, preset } = validate(input);
  let entities: unknown = [];
  if (preset !== "custom" && REGEX_PATTERNS[preset]) {
    entities = Array.from(new Set(text.match(REGEX_PATTERNS[preset]!) ?? []));
  } else {
    entities = { _note: "mock mode: regex-based extraction only available for emails / urls / phones / dates. Set ANTHROPIC_API_KEY for the full extractor." };
  }
  return {
    entities,
    preset,
    mode: "mock",
    modelUsed: "mock-regex",
    durationMs: Date.now() - startedAt,
  };
}

export async function runEntityExtract(input: EntityExtractInput): Promise<EntityExtractResult> {
  return detectMode() === "managed" ? runReal(input) : runMock(input);
}
