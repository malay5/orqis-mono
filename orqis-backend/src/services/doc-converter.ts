/**
 * doc-converter — any-format → any-format document conversion via pandoc.
 *
 * Supported formats: md, html, docx, epub, latex, rst, org, plaintext.
 * (PDF *output* requires a TeX engine; deferred to tex-press for now.)
 *
 * Modes:
 *   - "mock" (default) → produces a deterministic stub for each conversion
 *     so the smoke tests pass without pandoc on PATH.
 *   - "real" → set `PANDOC_PIPELINE=real` and ensure `pandoc` is on PATH (or
 *     `PANDOC_BIN=/abs/path`). Pandoc is a single binary, ~120 MB installed.
 */

import { spawn } from "node:child_process";

export type DocFormat = "md" | "html" | "docx" | "epub" | "latex" | "rst" | "org" | "plaintext";

const PANDOC_FROM: Record<DocFormat, string> = {
  md: "markdown",
  html: "html",
  docx: "docx",
  epub: "epub",
  latex: "latex",
  rst: "rst",
  org: "org",
  plaintext: "plain",
};
const PANDOC_TO: Record<DocFormat, string> = { ...PANDOC_FROM };
const BINARY_FORMATS = new Set<DocFormat>(["docx", "epub"]);

export type DocConverterInput = {
  from: DocFormat;
  to: DocFormat;
  /** Text or base64 content; base64 required when `from` is a binary format. */
  content: string;
  /** Required when `content` is base64 (binary inputs). */
  base64?: boolean;
};

export type DocConverterResult = {
  /** UTF-8 string when output is text; base64 string when binary. */
  output: string;
  outputIsBase64: boolean;
  outputBytes: number;
  outputFormat: DocFormat;
  inputFormat: DocFormat;
  engineUsed: "pandoc" | "mock";
  durationMs: number;
};

export type DocConverterMode = "mock" | "real";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const CONVERT_TIMEOUT_MS = 30_000;

export function detectMode(): DocConverterMode {
  return (process.env.PANDOC_PIPELINE ?? "").toLowerCase() === "real" ? "real" : "mock";
}

function decode(content: string, base64: boolean): Buffer {
  if (base64) {
    const m = content.match(/^data:[^;]+;base64,(.+)$/);
    const buf = Buffer.from(m ? m[1] : content, "base64");
    if (buf.byteLength === 0) throw new Error("base64 content decoded to zero bytes");
    if (buf.byteLength > MAX_INPUT_BYTES) {
      throw new Error(`content too large: ${buf.byteLength} bytes (max ${MAX_INPUT_BYTES})`);
    }
    return buf;
  }
  const buf = Buffer.from(content, "utf8");
  if (buf.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`content too large: ${buf.byteLength} bytes (max ${MAX_INPUT_BYTES})`);
  }
  return buf;
}

async function runReal(input: DocConverterInput): Promise<DocConverterResult> {
  const startedAt = Date.now();
  const bin = process.env.PANDOC_BIN ?? "pandoc";
  const from = PANDOC_FROM[input.from];
  const to = PANDOC_TO[input.to];
  const outIsBinary = BINARY_FORMATS.has(input.to);

  const inBuf = decode(input.content, input.base64 === true);

  // pandoc -f X -t Y --standalone --output - (binary outputs)  or  - (text)
  const args = ["-f", from, "-t", to, "--standalone"];
  // For binary outputs, pandoc requires --output but writes to stdout if it's `-`.
  args.push("-o", "-");

  const buf = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`pandoc timed out after ${CONVERT_TIMEOUT_MS}ms`));
    }, CONVERT_TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`failed to spawn pandoc: ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`pandoc exited ${code}: ${stderr.slice(0, 1500)}`));
      else resolve(Buffer.concat(chunks));
    });
    child.stdin.end(inBuf);
  });

  return {
    output: outIsBinary ? buf.toString("base64") : buf.toString("utf8"),
    outputIsBase64: outIsBinary,
    outputBytes: buf.byteLength,
    outputFormat: input.to,
    inputFormat: input.from,
    engineUsed: "pandoc",
    durationMs: Date.now() - startedAt,
  };
}

async function runMock(input: DocConverterInput): Promise<DocConverterResult> {
  const startedAt = Date.now();
  const inBuf = decode(input.content, input.base64 === true);
  const outIsBinary = BINARY_FORMATS.has(input.to);

  // Mock conversions favour readability over fidelity — enough that callers
  // can see the pipeline worked end-to-end before they install pandoc.
  let out: Buffer;
  if (outIsBinary) {
    // 4-byte stub for DOCX/EPUB. Real conversion writes a valid zip; the
    // mock signals "this is a placeholder" via a tiny base64 payload.
    out = Buffer.from(
      `mock-${input.to}-of-${inBuf.byteLength}-bytes-${Date.now().toString(36)}`,
      "utf8"
    );
  } else {
    const text = inBuf.toString("utf8");
    let converted = text;
    if (input.from === "md" && input.to === "html") {
      converted = text
        .replace(/^### (.*)$/gm, "<h3>$1</h3>")
        .replace(/^## (.*)$/gm, "<h2>$1</h2>")
        .replace(/^# (.*)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>");
      converted = `<!doctype html>\n<html><body>\n<!-- mock pandoc render -->\n${converted}\n</body></html>`;
    } else if (input.from === "html" && input.to === "md") {
      converted = text
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1")
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1")
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1")
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
        .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
        .replace(/<[^>]+>/g, "")
        .trim();
      converted = `<!-- mock pandoc render -->\n${converted}`;
    } else if (input.to === "latex") {
      converted = `% mock pandoc render — from ${input.from}\n\\documentclass{article}\n\\begin{document}\n${text.replace(/[#_]/g, "")}\n\\end{document}\n`;
    } else if (input.to === "plaintext") {
      converted = text.replace(/<[^>]+>/g, "").replace(/[#*_`>]/g, "").trim();
    } else {
      converted = `[mock pandoc] from=${input.from} to=${input.to}\n\n${text}`;
    }
    out = Buffer.from(converted, "utf8");
  }

  return {
    output: outIsBinary ? out.toString("base64") : out.toString("utf8"),
    outputIsBase64: outIsBinary,
    outputBytes: out.byteLength,
    outputFormat: input.to,
    inputFormat: input.from,
    engineUsed: "mock",
    durationMs: Date.now() - startedAt,
  };
}

export async function runDocConverter(input: DocConverterInput): Promise<DocConverterResult> {
  if (!input || !input.from || !input.to || !input.content) {
    throw new Error("from, to, content are all required");
  }
  if (!PANDOC_FROM[input.from]) throw new Error(`unsupported from: ${input.from}`);
  if (!PANDOC_TO[input.to]) throw new Error(`unsupported to: ${input.to}`);
  if (BINARY_FORMATS.has(input.from) && input.base64 !== true) {
    throw new Error(`from=${input.from} is a binary format; pass base64: true`);
  }

  if (detectMode() === "real") return runReal(input);
  return runMock(input);
}
