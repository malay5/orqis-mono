import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { runPageShot, type PageShotInput } from "../../services/page-shot.js";
import { runPdfRender, type PdfRenderInput } from "../../services/pdf-render.js";
import { runScrapeRender, type ScrapeRenderInput } from "../../services/scrape-render.js";
import { runLighthouseAudit, type LighthouseAuditInput } from "../../services/lighthouse-audit.js";
import { runSiteCrawl, type SiteCrawlInput } from "../../services/site-crawl.js";
import { statusForThrown } from "../../lib/errors.js";

export type TierCBrowserRoutesOpts = {
  storageDir: string;
  publicBaseUrl: string;
};

const MAX_BODY_BYTES = 12 * 1024 * 1024;

// Legacy fallback for plain Error services. ValidationError is the typed path.
const VALIDATION_PATTERN =
  /required|invalid|must be|not a valid|too large|too long|Pass only one|Either |Only http|Refusing to fetch|may include|categories must/;

async function writeArtifact(opts: TierCBrowserRoutesOpts, ext: string, buf: Buffer | string): Promise<string> {
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  const fileName = `${id}.${ext}`;
  const filePath = path.join(opts.storageDir, fileName);
  await fs.mkdir(opts.storageDir, { recursive: true });
  await fs.writeFile(filePath, buf);
  return `${opts.publicBaseUrl.replace(/\/$/, "")}/r/${fileName}`;
}

export function makeTierCBrowserRoutes(opts: TierCBrowserRoutesOpts): FastifyPluginAsync {
  return async (app) => {
    // ---------- page-shot ----------
    app.get("/agents/page-shot", async () => ({
      name: "page-shot",
      kind: "utility",
      version: "0.15.0",
      doc: "POST /v1/agents/page-shot/run with { url, width?, height?, fullPage?, device?, format?, ... }",
    }));
    app.post(
      "/agents/page-shot/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: PageShotInput = {
          url: typeof body.url === "string" ? body.url : "",
          width: typeof body.width === "number" ? body.width : undefined,
          height: typeof body.height === "number" ? body.height : undefined,
          fullPage: body.fullPage === true,
          device:
            body.device === "desktop" || body.device === "mobile" || body.device === "tablet"
              ? body.device
              : undefined,
          format:
            body.format === "png" || body.format === "jpeg" ? body.format : undefined,
          quality: typeof body.quality === "number" ? body.quality : undefined,
          waitUntil:
            body.waitUntil === "load" || body.waitUntil === "domcontentloaded" || body.waitUntil === "networkidle"
              ? body.waitUntil
              : undefined,
          darkMode: body.darkMode === true,
          hideAds: body.hideAds === true,
          delayMs: typeof body.delayMs === "number" ? body.delayMs : undefined,
        };
        try {
          const result = await runPageShot(input);
          const previewUrl = await writeArtifact(opts, result.extension, result.buffer);
          return {
            previewUrl,
            downloadUrl: previewUrl,
            width: result.width,
            height: result.height,
            fullPage: result.fullPage,
            device: result.device,
            format: result.extension === "jpg" ? "jpeg" : result.extension,
            finalUrl: result.finalUrl,
            outputBytes: result.outputBytes,
            durationMs: result.durationMs,
          };
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "page-shot failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- pdf-render ----------
    app.get("/agents/pdf-render", async () => ({
      name: "pdf-render",
      kind: "utility",
      version: "0.15.0",
      doc: "POST /v1/agents/pdf-render/run with { url | html, format?, landscape?, marginInches?, ... }",
    }));
    app.post(
      "/agents/pdf-render/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: PdfRenderInput = {
          url: typeof body.url === "string" ? body.url : undefined,
          html: typeof body.html === "string" ? body.html : undefined,
          format: typeof body.format === "string" ? (body.format as PdfRenderInput["format"]) : undefined,
          landscape: body.landscape === true,
          printBackground: body.printBackground !== false,
          marginInches:
            body.marginInches && typeof body.marginInches === "object"
              ? (body.marginInches as PdfRenderInput["marginInches"])
              : undefined,
          scale: typeof body.scale === "number" ? body.scale : undefined,
          waitUntil:
            body.waitUntil === "load" || body.waitUntil === "domcontentloaded" || body.waitUntil === "networkidle"
              ? body.waitUntil
              : undefined,
          delayMs: typeof body.delayMs === "number" ? body.delayMs : undefined,
          headerHtml: typeof body.headerHtml === "string" ? body.headerHtml : undefined,
          footerHtml: typeof body.footerHtml === "string" ? body.footerHtml : undefined,
        };
        try {
          const result = await runPdfRender(input);
          const previewUrl = await writeArtifact(opts, result.extension, result.buffer);
          return {
            previewUrl,
            downloadUrl: previewUrl,
            pageCount: result.pageCount,
            outputBytes: result.outputBytes,
            formatUsed: result.formatUsed,
            landscape: result.landscape,
            finalUrl: result.finalUrl,
            durationMs: result.durationMs,
          };
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "pdf-render failed");
          return reply.code(code).send({ error: message });
        }
      }
    );

    // ---------- scrape-render ----------
    app.get("/agents/scrape-render", async () => ({
      name: "scrape-render",
      kind: "utility",
      version: "0.15.0",
      doc: "POST /v1/agents/scrape-render/run with { url, extractText?, selectorMap?, ... }",
    }));
    app.post("/agents/scrape-render/run", async (req, reply) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const input: ScrapeRenderInput = {
        url: typeof body.url === "string" ? body.url : "",
        waitUntil:
          body.waitUntil === "load" || body.waitUntil === "domcontentloaded" || body.waitUntil === "networkidle"
            ? body.waitUntil
            : undefined,
        delayMs: typeof body.delayMs === "number" ? body.delayMs : undefined,
        device:
          body.device === "desktop" || body.device === "mobile" ? body.device : undefined,
        extractText: body.extractText === true,
        selectorMap:
          body.selectorMap && typeof body.selectorMap === "object"
            ? (body.selectorMap as Record<string, string>)
            : undefined,
      };
      try {
        return await runScrapeRender(input);
      } catch (err) {
        const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "scrape-render failed");
        return reply.code(code).send({ error: message });
      }
    });

    // ---------- lighthouse-audit ----------
    app.get("/agents/lighthouse-audit", async () => ({
      name: "lighthouse-audit",
      kind: "utility",
      version: "0.15.0",
      doc: "POST /v1/agents/lighthouse-audit/run with { url, device?, categories? }",
    }));
    app.post("/agents/lighthouse-audit/run", async (req, reply) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const input: LighthouseAuditInput = {
        url: typeof body.url === "string" ? body.url : "",
        device: body.device === "desktop" || body.device === "mobile" ? body.device : undefined,
        categories: Array.isArray(body.categories)
          ? (body.categories as LighthouseAuditInput["categories"])
          : undefined,
      };
      try {
        return await runLighthouseAudit(input);
      } catch (err) {
        const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "lighthouse-audit failed");
        return reply.code(code).send({ error: message });
      }
    });

    // ---------- site-crawl ----------
    app.get("/agents/site-crawl", async () => ({
      name: "site-crawl",
      kind: "utility",
      version: "0.19.0",
      doc: "POST /v1/agents/site-crawl/run with { startUrl, maxPages?, maxDepth?, allowExternal?, extractText? }",
    }));
    app.post(
      "/agents/site-crawl/run",
      { bodyLimit: MAX_BODY_BYTES },
      async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const input: SiteCrawlInput = {
          startUrl: typeof body.startUrl === "string" ? body.startUrl : "",
          maxPages: typeof body.maxPages === "number" ? body.maxPages : undefined,
          maxDepth: typeof body.maxDepth === "number" ? body.maxDepth : undefined,
          allowExternal: body.allowExternal === true,
          device: body.device === "desktop" || body.device === "mobile" ? body.device : undefined,
          waitUntil:
            body.waitUntil === "load" || body.waitUntil === "domcontentloaded" || body.waitUntil === "networkidle"
              ? body.waitUntil
              : undefined,
          extractText: body.extractText !== false,
          perPageDelayMs: typeof body.perPageDelayMs === "number" ? body.perPageDelayMs : undefined,
        };
        try {
          return await runSiteCrawl(input);
        } catch (err) {
          const { code, message } = statusForThrown(err, 502, VALIDATION_PATTERN, "site-crawl failed");
          return reply.code(code).send({ error: message });
        }
      }
    );
  };
}
