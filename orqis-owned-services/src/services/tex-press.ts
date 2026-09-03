/**
 * tex-press — LaTeX source → PDF, via tectonic.
 *
 * Two modes:
 *   - "mock" (default) → returns a tiny canned PDF without invoking any
 *     external binary. Lets us smoke-test the full pipeline in CI without
 *     installing a TeX engine.
 *   - "real" → spawns `tectonic` against a temp source tree. Tectonic is a
 *     single-binary LaTeX compiler that auto-downloads needed packages on
 *     first build (cached in TECTONIC_CACHE_DIR). Required env: `TEX_PIPELINE=real`,
 *     plus `tectonic` on PATH (or `TECTONIC_BIN=/abs/path/to/tectonic`).
 *
 * Input contract: the caller hands us one or more files as
 *   `{ files: [{ name, contentBase64 }] }`. Exactly one file must be the
 *   entrypoint (defaulting to `main.tex`, override via `entrypoint`).
 *   We assemble those into a temp dir, run tectonic, return the PDF bytes.
 *
 * Output contract: PDF bytes (the route layer writes them to /r/ and returns
 * a previewUrl / downloadUrl).
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export type TexPressFile = {
  name: string;
  contentBase64: string;
};

export type TexPressInput = {
  files: TexPressFile[];
  entrypoint?: string;
};

export type TexPressResult = {
  pdfBuffer: Buffer;
  pageCount: number | null;
  pdfBytes: number;
  filesUsed: string[];
  entrypoint: string;
  engineUsed: "tectonic" | "mock";
  durationMs: number;
};

export type TexPressMode = "mock" | "real";

const MAX_FILES = 32;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const SAFE_FILENAME = /^[a-zA-Z0-9_./-]+$/;
const COMPILE_TIMEOUT_MS = 60_000;

export function detectMode(): TexPressMode {
  return (process.env.TEX_PIPELINE ?? "").toLowerCase() === "real" ? "real" : "mock";
}

function validateFiles(files: TexPressFile[]): { entries: { name: string; bytes: Buffer }[]; totalBytes: number } {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("files must be a non-empty array of { name, contentBase64 }");
  }
  if (files.length > MAX_FILES) {
    throw new Error(`Too many files: ${files.length} (max ${MAX_FILES})`);
  }
  const entries: { name: string; bytes: Buffer }[] = [];
  let total = 0;
  for (const f of files) {
    if (!f || typeof f.name !== "string" || typeof f.contentBase64 !== "string") {
      throw new Error("each file must be { name, contentBase64 }");
    }
    const normalised = f.name.replace(/\\/g, "/");
    if (!SAFE_FILENAME.test(normalised) || normalised.includes("..") || normalised.startsWith("/")) {
      throw new Error(`unsafe file name: ${f.name}`);
    }
    const m = f.contentBase64.match(/^data:[^;]+;base64,(.+)$/);
    const buf = Buffer.from(m ? m[1] : f.contentBase64, "base64");
    if (buf.byteLength === 0) {
      throw new Error(`file ${normalised} decoded to zero bytes`);
    }
    total += buf.byteLength;
    if (total > MAX_TOTAL_BYTES) {
      throw new Error(`Total input bytes too large: ${total} (max ${MAX_TOTAL_BYTES})`);
    }
    entries.push({ name: normalised, bytes: buf });
  }
  return { entries, totalBytes: total };
}

async function runMock(
  input: TexPressInput,
  entries: { name: string; bytes: Buffer }[],
  entrypoint: string
): Promise<TexPressResult> {
  const startedAt = Date.now();
  await new Promise((r) => setTimeout(r, 200));

  const entryFile = entries.find((e) => e.name === entrypoint);
  if (!entryFile) {
    throw new Error(`entrypoint ${entrypoint} not found among files`);
  }
  const title = String(entryFile.bytes.toString("utf8").match(/\\title\{([^}]+)\}/)?.[1] ?? "Untitled");

  // Minimal valid single-page PDF — enough that pdf-parse / a viewer renders
  // "tex-press mock". Real PDFs are hand-assembled byte streams; this one is
  // the classic "smallest valid PDF" template adapted with a custom title.
  const escTitle = title.replace(/([()\\])/g, "\\$1").slice(0, 80);
  const body = `BT /F1 24 Tf 72 720 Td (tex-press mock: ${escTitle}) Tj ET`;
  const stream = `q\n${body}\nQ`;
  const lengthOfStream = Buffer.byteLength(stream, "binary");
  const header = "%PDF-1.4\n";
  const objects = [
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n",
    "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n",
    `4 0 obj<</Length ${lengthOfStream}>>stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n",
  ];
  // Compute xref offsets.
  let offset = Buffer.byteLength(header, "binary");
  const offsets: number[] = [];
  for (const o of objects) {
    offsets.push(offset);
    offset += Buffer.byteLength(o, "binary");
  }
  const xrefStart = offset;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (const off of offsets) {
    xref += off.toString().padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  const pdfBuffer = Buffer.from(header + objects.join("") + xref + trailer, "binary");

  return {
    pdfBuffer,
    pageCount: 1,
    pdfBytes: pdfBuffer.byteLength,
    filesUsed: entries.map((e) => e.name),
    entrypoint,
    engineUsed: "mock",
    durationMs: Date.now() - startedAt,
  };
}

async function runReal(
  entries: { name: string; bytes: Buffer }[],
  entrypoint: string
): Promise<TexPressResult> {
  const startedAt = Date.now();
  const bin = process.env.TECTONIC_BIN ?? "tectonic";

  const workDir = path.join(tmpdir(), `texpress-${randomUUID().slice(0, 8)}`);
  await fs.mkdir(workDir, { recursive: true });
  try {
    for (const e of entries) {
      const dest = path.join(workDir, e.name);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, e.bytes);
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        bin,
        ["-X", "compile", "--keep-logs", "--outdir", workDir, entrypoint],
        { cwd: workDir, stdio: ["ignore", "pipe", "pipe"] }
      );
      let stderr = "";
      child.stderr.on("data", (c: Buffer) => {
        stderr += c.toString("utf8");
      });
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`tectonic timed out after ${COMPILE_TIMEOUT_MS}ms`));
      }, COMPILE_TIMEOUT_MS);
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`failed to spawn tectonic: ${err.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`tectonic exited ${code}: ${stderr.slice(0, 1500)}`));
        } else {
          resolve();
        }
      });
    });

    const pdfName = entrypoint.replace(/\.tex$/i, ".pdf");
    const pdfPath = path.join(workDir, pdfName);
    const pdfBuffer = await fs.readFile(pdfPath);

    return {
      pdfBuffer,
      pageCount: null,
      pdfBytes: pdfBuffer.byteLength,
      filesUsed: entries.map((e) => e.name),
      entrypoint,
      engineUsed: "tectonic",
      durationMs: Date.now() - startedAt,
    };
  } finally {
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function runTexPress(input: TexPressInput): Promise<TexPressResult> {
  const { entries } = validateFiles(input.files);
  const entrypoint = (input.entrypoint ?? "main.tex").replace(/\\/g, "/");
  if (!SAFE_FILENAME.test(entrypoint) || entrypoint.includes("..")) {
    throw new Error(`unsafe entrypoint: ${entrypoint}`);
  }
  if (!entries.some((e) => e.name === entrypoint)) {
    throw new Error(`entrypoint ${entrypoint} not present in files[]`);
  }

  if (detectMode() === "real") return runReal(entries, entrypoint);
  return runMock(input, entries, entrypoint);
}
