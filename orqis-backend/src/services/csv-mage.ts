/**
 * csv-mage — CSV → JSON / NDJSON / SQL with schema inference.
 *
 * Pure-JS via PapaParse. Detects each column's type from sampled rows
 * (integer / number / boolean / date / string), reports a row-count
 * summary, and optionally deduplicates.
 */

import Papa from "papaparse";

export type CsvMageInput = {
  csv: string;
  format?: "json" | "ndjson" | "sql";
  tableName?: string;
  delimiter?: string;
  hasHeader?: boolean;
  dedupe?: boolean;
  sampleRows?: number;
};

type ColumnType = "integer" | "number" | "boolean" | "date" | "string";

export type CsvMageColumn = {
  name: string;
  type: ColumnType;
  nullable: boolean;
};

export type CsvMageResult = {
  format: "json" | "ndjson" | "sql";
  output: string;
  rowsParsed: number;
  rowsOutput: number;
  rowsDropped: number;
  columns: CsvMageColumn[];
  errors: string[];
  durationMs: number;
};

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 100_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function inferType(samples: string[]): ColumnType {
  const seen = { int: 0, num: 0, bool: 0, date: 0, str: 0, total: 0 };
  for (const raw of samples) {
    if (raw === "" || raw == null) continue;
    seen.total++;
    const v = raw.trim();
    if (/^-?\d+$/.test(v)) {
      seen.int++;
      continue;
    }
    if (/^-?\d*\.\d+$/.test(v) || /^-?\d+(\.\d+)?[eE]-?\d+$/.test(v)) {
      seen.num++;
      continue;
    }
    if (/^(true|false)$/i.test(v)) {
      seen.bool++;
      continue;
    }
    if (ISO_DATE.test(v)) {
      seen.date++;
      continue;
    }
    seen.str++;
  }
  if (seen.total === 0) return "string";
  if (seen.str > 0) return "string";
  if (seen.date === seen.total) return "date";
  if (seen.bool === seen.total) return "boolean";
  if (seen.int === seen.total) return "integer";
  if (seen.int + seen.num === seen.total) return "number";
  return "string";
}

function sqlIdentifier(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^(\d)/, "_$1");
  return `"${safe || "col"}"`;
}

function sqlLiteral(value: unknown, type: ColumnType): string {
  if (value === null || value === undefined || value === "") return "NULL";
  const s = String(value);
  if (type === "integer" || type === "number") return s;
  if (type === "boolean") return /^true$/i.test(s) ? "TRUE" : "FALSE";
  return `'${s.replace(/'/g, "''")}'`;
}

export function runCsvMage(input: CsvMageInput): CsvMageResult {
  if (!input.csv || typeof input.csv !== "string") {
    throw new Error("csv is required");
  }
  if (Buffer.byteLength(input.csv, "utf8") > MAX_INPUT_BYTES) {
    throw new Error(`csv too large: ${Buffer.byteLength(input.csv, "utf8")} bytes (max ${MAX_INPUT_BYTES})`);
  }

  const format = input.format ?? "json";
  if (format !== "json" && format !== "ndjson" && format !== "sql") {
    throw new Error("format must be one of json | ndjson | sql");
  }
  if (format === "sql" && input.tableName && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.tableName)) {
    throw new Error("tableName must be a valid SQL identifier (letters / digits / underscore)");
  }

  const startedAt = performance.now();
  const hasHeader = input.hasHeader !== false;
  const parsed = Papa.parse<Record<string, string>>(input.csv, {
    header: hasHeader,
    delimiter: input.delimiter,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rawRows = (parsed.data as Record<string, string>[]) ?? [];
  if (rawRows.length > MAX_ROWS) {
    throw new Error(`csv too many rows: ${rawRows.length} (max ${MAX_ROWS})`);
  }
  const errors = (parsed.errors ?? []).slice(0, 10).map((e) => `${e.code}: ${e.message}`);

  // Synthesize headers if absent.
  let headers: string[];
  if (hasHeader) {
    headers = parsed.meta.fields ?? [];
  } else {
    const first = rawRows[0];
    const arrLen = Array.isArray(first) ? (first as unknown as string[]).length : 0;
    headers = Array.from({ length: arrLen }, (_, i) => `col_${i + 1}`);
  }

  // Sample for type inference.
  const sampleN = clampInt(input.sampleRows ?? 200, 10, 2000);
  const columns: CsvMageColumn[] = headers.map((h) => {
    const samples = rawRows.slice(0, sampleN).map((r) => String((r as Record<string, string>)[h] ?? ""));
    const nullable = samples.some((s) => s === "");
    return { name: h, type: inferType(samples), nullable };
  });

  // Deduplicate (by JSON stringification of the row).
  let workingRows = rawRows;
  if (input.dedupe === true) {
    const seen = new Set<string>();
    workingRows = rawRows.filter((r) => {
      const key = JSON.stringify(r);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const rowsDropped = rawRows.length - workingRows.length;

  // Render.
  let output: string;
  if (format === "json") {
    output = JSON.stringify(workingRows, null, 2);
  } else if (format === "ndjson") {
    output = workingRows.map((r) => JSON.stringify(r)).join("\n");
  } else {
    const table = input.tableName ?? "imported";
    const colsSql = columns.map((c) => sqlIdentifier(c.name)).join(", ");
    const create = `CREATE TABLE ${sqlIdentifier(table)} (\n${columns
      .map((c) => `  ${sqlIdentifier(c.name)} ${sqlTypeOf(c.type)}${c.nullable ? "" : " NOT NULL"}`)
      .join(",\n")}\n);`;
    const inserts = workingRows
      .slice(0, MAX_ROWS)
      .map(
        (r) =>
          `INSERT INTO ${sqlIdentifier(table)} (${colsSql}) VALUES (${columns
            .map((c) => sqlLiteral((r as Record<string, string>)[c.name], c.type))
            .join(", ")});`
      )
      .join("\n");
    output = `${create}\n\n${inserts}\n`;
  }

  return {
    format,
    output,
    rowsParsed: rawRows.length,
    rowsOutput: workingRows.length,
    rowsDropped,
    columns,
    errors,
    durationMs: Math.round(performance.now() - startedAt),
  };
}

function sqlTypeOf(t: ColumnType): string {
  switch (t) {
    case "integer":
      return "INTEGER";
    case "number":
      return "DOUBLE PRECISION";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "TIMESTAMP";
    case "string":
      return "TEXT";
  }
}

function clampInt(n: unknown, lo: number, hi: number) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
