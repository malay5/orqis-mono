import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { runOcrVision, type OcrVisionInput } from "../../services/ocr-vision.js";
import { runScrapeClean, type ScrapeCleanInput } from "../../services/scrape-clean.js";
import { runQrToolkit, type QrInput } from "../../services/qr-toolkit.js";
import { runExifClean, type ExifCleanInput } from "../../services/exif-clean.js";
import { runDiagramForge, type DiagramForgeInput } from "../../services/diagram-forge.js";
import { runCsvMage, type CsvMageInput } from "../../services/csv-mage.js";
import { statusForThrown } from "../../lib/errors.js";

export type TierARoutesOpts = {
  storageDir: string;
  publicBaseUrl: string;
};

// Legacy validation-message regex — fallback for services that still throw
// plain Error for input issues. New code throws ValidationError (typed),
// which statusForThrown picks up before this pattern runs.
const VALIDATION_PATTERN =
  /required|valid URL|too large|Refusing to fetch|Pass only one|Only http|Expected image\/|must be|too long|too many rows|No QR code|nomnoml parse/;

const MAX_BODY_BYTES = 12 * 1024 * 1024;

async function writeArtifact(opts: TierARoutesOpts, ext: string, buf: Buffer | string): Promise<string> {
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  const fileName = `${id}.${ext}`;
  const filePath = path.join(opts.storageDir, fileName);
  await fs.mkdir(opts.storageDir, { recursive: true });
  await fs.writeFile(filePath, buf);
  return `${opts.publicBaseUrl.replace(/\/$/, "")}/r/${fileName}`;
}

export function makeTierARoutes(opts: TierARoutesOpts): FastifyPluginAsync {
  return async (app) => {
    // ---------- ocr-vision ----------
    app.get("/agents/ocr-vision", async () => ({
      name: "ocr-vision",
      kind: "utility",
      version: "0.13.0",
      doc: "POST /v1/agents/ocr-vision/run with { imageUrl | imageBase64, language? }",
    }));
    app.post(
      "/agents/ocr-vision/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: OcrVisionInput = {
          imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() : undefined,
          imageBase64: typeof body.imageBase64 === "string" ? body.imageBase64 : undefined,
          language: typeof body.language === "string" ? body.language : undefined,
        };
        try {
          return await runOcrVision(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "ocr-vision failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- scrape-clean ----------
    app.get("/agents/scrape-clean", async () => ({
      name: "scrape-clean",
      kind: "utility",
      version: "0.13.0",
      doc: "POST /v1/agents/scrape-clean/run with { url, includeHtml? }",
    }));
    app.post("/agents/scrape-clean/run", async (req, reply) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const input: ScrapeCleanInput = {
        url: typeof body.url === "string" ? body.url : "",
        includeHtml: body.includeHtml === true,
      };
      try {
        return await runScrapeClean(input);
      } catch (err) {
        const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "scrape-clean failed");
        return reply.code(code).send({ error: message });
      }
    });

    // ---------- qr-toolkit ----------
    app.get("/agents/qr-toolkit", async () => ({
      name: "qr-toolkit",
      kind: "utility",
      version: "0.13.0",
      doc: "POST /v1/agents/qr-toolkit/run with { mode: 'encode' | 'decode', ... }",
    }));
    app.post(
      "/agents/qr-toolkit/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const mode = body.mode;
        if (mode !== "encode" && mode !== "decode") {
          return reply.code(400).send({ error: "mode must be 'encode' or 'decode'" });
        }
        const input: QrInput =
          mode === "encode"
            ? {
                mode: "encode",
                text: typeof body.text === "string" ? body.text : "",
                errorCorrection: typeof body.errorCorrection === "string"
                  ? (body.errorCorrection as "L" | "M" | "Q" | "H")
                  : undefined,
                margin: typeof body.margin === "number" ? body.margin : undefined,
                scale: typeof body.scale === "number" ? body.scale : undefined,
                darkColor: typeof body.darkColor === "string" ? body.darkColor : undefined,
                lightColor: typeof body.lightColor === "string" ? body.lightColor : undefined,
              }
            : {
                mode: "decode",
                imageBase64: typeof body.imageBase64 === "string" ? body.imageBase64 : undefined,
              };
        try {
          const result = await runQrToolkit(input);
          if (result.mode === "encode") {
            const previewUrl = await writeArtifact(opts, "png", result.pngBuffer);
            return {
              mode: "encode" as const,
              svg: result.svg,
              previewUrl,
              downloadUrl: previewUrl,
              payloadKind: result.payloadKind,
              length: result.length,
              durationMs: result.durationMs,
            };
          }
          return result;
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "qr-toolkit failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- exif-clean ----------
    app.get("/agents/exif-clean", async () => ({
      name: "exif-clean",
      kind: "utility",
      version: "0.13.0",
      doc: "POST /v1/agents/exif-clean/run with { imageBase64, outputFormat? }",
    }));
    app.post(
      "/agents/exif-clean/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: ExifCleanInput = {
          imageBase64: typeof body.imageBase64 === "string" ? body.imageBase64 : "",
          outputFormat:
            body.outputFormat === "preserve" ||
            body.outputFormat === "jpeg" ||
            body.outputFormat === "png" ||
            body.outputFormat === "webp"
              ? body.outputFormat
              : undefined,
        };
        try {
          const result = await runExifClean(input);
          const previewUrl = await writeArtifact(opts, result.extension, result.buffer);
          return {
            previewUrl,
            downloadUrl: previewUrl,
            outputFormat: result.outputFormat,
            width: result.width,
            height: result.height,
            originalBytes: result.originalBytes,
            outputBytes: result.outputBytes,
            savedBytes: Math.max(0, result.originalBytes - result.outputBytes),
            removed: result.removed,
            durationMs: result.durationMs,
          };
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "exif-clean failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- diagram-forge ----------
    app.get("/agents/diagram-forge", async () => ({
      name: "diagram-forge",
      kind: "utility",
      version: "0.13.0",
      doc: "POST /v1/agents/diagram-forge/run with { source, direction?, style? }",
    }));
    app.post("/agents/diagram-forge/run", async (req, reply) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const input: DiagramForgeInput = {
        source: typeof body.source === "string" ? body.source : "",
        direction:
          body.direction === "down" || body.direction === "right" ? body.direction : undefined,
        style:
          body.style === "default" ||
          body.style === "ink" ||
          body.style === "vintage" ||
          body.style === "minimal"
            ? body.style
            : undefined,
      };
      try {
        const result = runDiagramForge(input);
        const previewUrl = await writeArtifact(opts, "svg", result.svg);
        return {
          previewUrl,
          downloadUrl: previewUrl,
          svg: result.svg,
          width: result.width,
          height: result.height,
          styleApplied: result.styleApplied,
          sourceLength: result.sourceLength,
          durationMs: result.durationMs,
        };
      } catch (err) {
        const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "diagram-forge failed");
        return reply.code(code).send({ error: message });
      }
    });

    // ---------- csv-mage ----------
    app.get("/agents/csv-mage", async () => ({
      name: "csv-mage",
      kind: "utility",
      version: "0.13.0",
      doc: "POST /v1/agents/csv-mage/run with { csv, format?, tableName?, dedupe? }",
    }));
    app.post(
      "/agents/csv-mage/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: CsvMageInput = {
          csv: typeof body.csv === "string" ? body.csv : "",
          format:
            body.format === "json" || body.format === "ndjson" || body.format === "sql"
              ? body.format
              : undefined,
          tableName: typeof body.tableName === "string" ? body.tableName : undefined,
          delimiter: typeof body.delimiter === "string" ? body.delimiter : undefined,
          hasHeader: body.hasHeader === false ? false : undefined,
          dedupe: body.dedupe === true,
          sampleRows: typeof body.sampleRows === "number" ? body.sampleRows : undefined,
        };
        try {
          return runCsvMage(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "csv-mage failed");
          return reply.code(code).send({ error: message });
        }
      }
    );
  };
}
