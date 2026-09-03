import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { FastifyPluginAsync } from "fastify";
import * as pdfParseNs from "pdf-parse";
import {
  detectMode,
  runResumeRx,
  type ResumeRxInput,
} from "../../services/resume-rx.js";

// pdf-parse exposes either a default export or a named one depending on build.
// Probe lazily at first use so a probe miss doesn't crash module loading
// (which would take the entire app down at boot, including agents that
// never touch PDFs).
type PdfParseFn = (buf: Buffer) => Promise<{ text: string }>;
let pdfParseCache: PdfParseFn | null = null;
function pdfParse(buf: Buffer): Promise<{ text: string }> {
  if (pdfParseCache) return pdfParseCache(buf);
  const mod = pdfParseNs as unknown as Record<string, unknown>;
  const candidate =
    typeof mod.default === "function"
      ? (mod.default as PdfParseFn)
      : typeof mod.pdf === "function"
      ? (mod.pdf as PdfParseFn)
      : typeof pdfParseNs === "function"
      ? (pdfParseNs as unknown as PdfParseFn)
      : null;
  if (!candidate) {
    return Promise.reject(new Error("pdf-parse: could not resolve a callable export"));
  }
  pdfParseCache = candidate;
  return candidate(buf);
}

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB — generous for base64-encoded PDFs
const MAX_RESUME_TEXT = 60_000;
const MAX_JD_TEXT = 30_000;
const PDF_MAGIC = Buffer.from("%PDF-");

// Reuse the same SSRF guard pattern as img-shrink. Inlined here (rather than
// hoisted into a shared module) because the rule sets are identical and tiny.
const PRIVATE_V4_BLOCKS: [bigint, bigint][] = [
  ["0.0.0.0", "0.255.255.255"],
  ["10.0.0.0", "10.255.255.255"],
  ["100.64.0.0", "100.127.255.255"],
  ["127.0.0.0", "127.255.255.255"],
  ["169.254.0.0", "169.254.255.255"],
  ["172.16.0.0", "172.31.255.255"],
  ["192.0.0.0", "192.0.0.255"],
  ["192.168.0.0", "192.168.255.255"],
  ["198.18.0.0", "198.19.255.255"],
  ["224.0.0.0", "239.255.255.255"],
  ["240.0.0.0", "255.255.255.255"],
].map(([a, b]) => [v4ToBigInt(a), v4ToBigInt(b)] as [bigint, bigint]);

function v4ToBigInt(addr: string): bigint {
  return addr
    .split(".")
    .map((p) => BigInt(Number(p)))
    .reduce((acc, p) => (acc << 8n) | p, 0n);
}

function isBlockedV4(addr: string): boolean {
  if (isIP(addr) !== 4) return false;
  const n = v4ToBigInt(addr);
  return PRIVATE_V4_BLOCKS.some(([lo, hi]) => n >= lo && n <= hi);
}

function isBlockedV6(addr: string): boolean {
  if (isIP(addr) !== 6) return false;
  const norm = addr.toLowerCase();
  return (
    norm === "::1" ||
    norm.startsWith("fc") ||
    norm.startsWith("fd") ||
    norm.startsWith("fe8") ||
    norm.startsWith("fe9") ||
    norm.startsWith("fea") ||
    norm.startsWith("feb") ||
    norm.includes("::ffff:127.")
  );
}

async function safeFetchText(url: string, maxBytes: number): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("jobDescription URL is not valid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("jobDescription URL must be http(s)");
  }
  // Resolve all host addresses; reject if any is private.
  if (isIP(parsed.hostname)) {
    if (isBlockedV4(parsed.hostname) || isBlockedV6(parsed.hostname)) {
      throw new Error("Refusing to fetch jobDescription from a private / loopback IP");
    }
  } else {
    const records = await dnsLookup(parsed.hostname, { all: true });
    for (const r of records) {
      if (r.family === 4 ? isBlockedV4(r.address) : isBlockedV6(r.address)) {
        throw new Error(
          `Refusing to fetch jobDescription from ${parsed.hostname}: resolves to a private / loopback address`
        );
      }
    }
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(parsed, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`jobDescription fetch returned HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > maxBytes) {
      throw new Error(`jobDescription too large: ${text.length} bytes`);
    }
    // Crude HTML → text strip for fetched JD pages.
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } finally {
    clearTimeout(t);
  }
}

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function decodeBase64Pdf(input: string): Buffer {
  const m = input.match(/^data:application\/pdf;base64,(.+)$/i);
  const b64 = m ? m[1] : input;
  return Buffer.from(b64, "base64");
}

export const resumeRxRoutes: FastifyPluginAsync = async (app) => {
  app.get("/agents/resume-rx", async () => ({
    name: "resume-rx",
    kind: "ai-agent",
    isAsync: false,
    mode: detectMode(),
    version: "0.9.0",
    doc: "POST /v1/agents/resume-rx/run with the input schema published on orqis.",
  }));

  app.post(
    "/agents/resume-rx/run",
    { bodyLimit: MAX_BODY_BYTES },
    async (req, reply) => {
      const body = (req.body ?? {}) as Record<string, unknown>;

      // ---- Resume normalization ----
      const rawResume = typeof body.resume === "string" ? body.resume : "";
      if (!rawResume) {
        return reply.code(400).send({ error: "resume is required" });
      }
      const resumeFormat = body.resumeFormat === "pdf" ? "pdf" : "text";

      let resumeText = "";
      if (resumeFormat === "pdf") {
        try {
          const buf = decodeBase64Pdf(rawResume);
          if (buf.byteLength === 0) {
            return reply
              .code(400)
              .send({ error: "resume base64 decoded to zero bytes" });
          }
          if (!buf.subarray(0, 5).equals(PDF_MAGIC)) {
            return reply
              .code(400)
              .send({ error: "resume bytes do not start with %PDF-" });
          }
          const parsed = await pdfParse(buf);
          resumeText = parsed.text ?? "";
        } catch (err) {
          return reply.code(400).send({
            error: `Could not parse PDF resume: ${(err as Error).message}`,
          });
        }
      } else {
        resumeText = rawResume;
      }
      resumeText = resumeText.trim().slice(0, MAX_RESUME_TEXT);
      if (!resumeText) {
        return reply
          .code(400)
          .send({ error: "Resume content is empty after parsing." });
      }

      // ---- JD normalization (text or URL) ----
      let jdText: string | undefined;
      const rawJd = typeof body.jobDescription === "string" ? body.jobDescription : "";
      if (rawJd.trim()) {
        if (looksLikeUrl(rawJd)) {
          try {
            jdText = (await safeFetchText(rawJd.trim(), 200_000)).slice(0, MAX_JD_TEXT);
          } catch (err) {
            return reply.code(400).send({ error: (err as Error).message });
          }
        } else {
          jdText = rawJd.trim().slice(0, MAX_JD_TEXT);
        }
      }

      const input: ResumeRxInput = {
        resume: resumeText,
        jobDescription: jdText,
        targetRole:
          typeof body.targetRole === "string" ? body.targetRole.slice(0, 200) : undefined,
        targetSeniority: ((): ResumeRxInput["targetSeniority"] => {
          const v = body.targetSeniority;
          if (
            v === "intern" ||
            v === "junior" ||
            v === "mid" ||
            v === "senior" ||
            v === "staff" ||
            v === "principal" ||
            v === "manager" ||
            v === "director"
          )
            return v;
          return undefined;
        })(),
        industryHint:
          typeof body.industryHint === "string" ? body.industryHint.slice(0, 200) : undefined,
        evaluationMode: ((): ResumeRxInput["evaluationMode"] => {
          const v = body.evaluationMode;
          if (v === "ats" || v === "human" || v === "both") return v;
          return "both";
        })(),
        rubricFocus: Array.isArray(body.rubricFocus)
          ? (body.rubricFocus as unknown[])
              .filter((x): x is string => typeof x === "string")
              .slice(0, 12)
          : undefined,
        redLines: Array.isArray(body.redLines)
          ? (body.redLines as unknown[])
              .filter((x): x is string => typeof x === "string")
              .slice(0, 8)
          : undefined,
        tone: ((): ResumeRxInput["tone"] => {
          const v = body.tone;
          if (v === "blunt" || v === "constructive" || v === "encouraging") return v;
          return "constructive";
        })(),
        outputFormat: ((): ResumeRxInput["outputFormat"] => {
          const v = body.outputFormat;
          if (v === "json" || v === "markdown" || v === "both") return v;
          return "both";
        })(),
        includeRewriteSuggestions: body.includeRewriteSuggestions !== false,
        includeKeywordGaps: body.includeKeywordGaps !== false,
        includeAtsBreakdown: body.includeAtsBreakdown !== false,
        includeRedFlags: body.includeRedFlags !== false,
        redactPii: body.redactPii === true,
        language: typeof body.language === "string" ? body.language : "en",
      };

      const startedAt = Date.now();
      let result;
      try {
        result = await runResumeRx(input);
      } catch (err) {
        app.log.error({ err }, "resume-rx generation failed");
        return reply.code(502).send({
          error: err instanceof Error ? err.message : "resume-rx failed",
        });
      }

      // PII redaction (best-effort regex on contact fields in the markdownReport
      // and summary). Real PII detection would use a dedicated library; this is
      // enough for the "share with a colleague" use case.
      if (input.redactPii) {
        const emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
        const phoneRe = /\+?\d[\d\s().-]{7,}\d/g;
        result.summary = result.summary.replace(emailRe, "[redacted-email]").replace(phoneRe, "[redacted-phone]");
        result.markdownReport = result.markdownReport
          .replace(emailRe, "[redacted-email]")
          .replace(phoneRe, "[redacted-phone]");
      }

      return {
        ...result,
        meta: {
          modelUsed: result.modelUsed,
          generatedInMs: Date.now() - startedAt,
          jdSource: jdText ? (looksLikeUrl(rawJd) ? "url" : "text") : "none",
          piiRedacted: input.redactPii === true,
          ...(typeof result.cacheReadTokens === "number"
            ? { cacheReadTokens: result.cacheReadTokens }
            : {}),
        },
      };
    }
  );
};
