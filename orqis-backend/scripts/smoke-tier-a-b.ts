/**
 * Smoke test for the 10 Tier A + Tier B agents.
 *
 * Boots the Fastify app in-process via buildApp(), then drives every new
 * /v1/agents/<slug>/run endpoint with a minimal valid payload using
 * `app.inject(…)` (no port opened, no `npm run dev` needed).
 *
 * Run:
 *   npx tsx scripts/smoke-tier-a-b.ts
 *
 * Exits 0 if all pass; non-zero if any fail.
 */

import sharp from "sharp";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.js";

type TestResult = {
  name: string;
  ok: boolean;
  status?: number;
  durationMs: number;
  note: string;
  error?: string;
};

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

async function makeWhiteImagePng(): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
}

async function makeColoredImagePng(): Promise<Buffer> {
  // Solid background + a single black dot in the middle — enough that the
  // bg-strip mock has something to key against.
  const base = sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 240, g: 240, b: 240 } },
  });
  const dot = Buffer.from(
    '<svg width="64" height="64"><circle cx="32" cy="32" r="10" fill="#111"/></svg>'
  );
  return base.composite([{ input: dot, top: 0, left: 0 }]).png().toBuffer();
}

async function makeJpegWithExif(): Promise<Buffer> {
  // sharp can write metadata when given an EXIF buffer. The keep-metadata
  // path is the easiest way to be sure exif-clean has something to strip.
  return sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 200, g: 100, b: 100 } },
  })
    .withExif({
      IFD0: {
        Make: "orqis-smoke",
        Model: "test",
      },
    })
    .jpeg()
    .toBuffer();
}

async function makeQrPng(text: string): Promise<Buffer> {
  // Use qrcode lib through the same package the service uses.
  const QRCode = (await import("qrcode")).default;
  return QRCode.toBuffer(text, { type: "png", scale: 6, margin: 2 });
}

async function run(
  app: FastifyInstance,
  name: string,
  url: string,
  payload: Record<string, unknown>,
  validate: (body: unknown) => string | null,
  headers: Record<string, string> = {}
): Promise<TestResult> {
  const startedAt = Date.now();
  try {
    const res = await app.inject({
      method: "POST",
      url,
      payload,
      headers,
    });
    const durationMs = Date.now() - startedAt;
    if (res.statusCode >= 500) {
      return {
        name,
        ok: false,
        status: res.statusCode,
        durationMs,
        note: "5xx",
        error: res.body.slice(0, 400),
      };
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      return {
        name,
        ok: false,
        status: res.statusCode,
        durationMs,
        note: "non-JSON body",
        error: res.body.slice(0, 400),
      };
    }
    if (res.statusCode >= 400) {
      const err = (parsed as { error?: string }).error ?? "(no error message)";
      return {
        name,
        ok: false,
        status: res.statusCode,
        durationMs,
        note: `4xx`,
        error: err,
      };
    }
    const why = validate(parsed);
    if (why) {
      return {
        name,
        ok: false,
        status: res.statusCode,
        durationMs,
        note: "shape mismatch",
        error: why,
      };
    }
    return { name, ok: true, status: res.statusCode, durationMs, note: "ok" };
  } catch (err) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - startedAt,
      note: "threw",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function hasFields(...fields: string[]): (body: unknown) => string | null {
  return (body) => {
    if (!body || typeof body !== "object") return "body is not an object";
    for (const f of fields) {
      if (!(f in (body as Record<string, unknown>))) return `missing field: ${f}`;
    }
    return null;
  };
}

async function main() {
  const app = await buildApp({ logger: false, connectDb: false });
  const results: TestResult[] = [];

  console.log(`\n${DIM}Booting Fastify in-process…${RESET}\n`);

  // ---------- Tier A ----------

  // 1. ocr-vision — first call downloads ~10 MB of Tesseract language data;
  // accept any result that isn't a 5xx. Empty text on a blank image is fine.
  const whitePng = await makeWhiteImagePng();
  results.push(
    await run(
      app,
      "ocr-vision",
      "/v1/agents/ocr-vision/run",
      {
        imageBase64: whitePng.toString("base64"),
        language: "eng",
      },
      hasFields("text", "language", "confidence", "wordCount", "durationMs")
    )
  );

  // 2. scrape-clean — exercise validation path only (avoids network
  // dependency / flake). 400 on missing url is the success criterion.
  results.push(
    await (async () => {
      const r = await app.inject({
        method: "POST",
        url: "/v1/agents/scrape-clean/run",
        payload: {},
      });
      if (r.statusCode === 400) {
        return {
          name: "scrape-clean (validation)",
          ok: true,
          status: 400,
          durationMs: 0,
          note: "rejects missing url (network path skipped)",
        } satisfies TestResult;
      }
      return {
        name: "scrape-clean (validation)",
        ok: false,
        status: r.statusCode,
        durationMs: 0,
        note: "expected 400 on missing url",
        error: r.body.slice(0, 200),
      } satisfies TestResult;
    })()
  );

  // 3. qr-toolkit — encode then decode.
  const encoded = await run(
    app,
    "qr-toolkit (encode)",
    "/v1/agents/qr-toolkit/run",
    { mode: "encode", text: "https://orqis.xyz" },
    hasFields("mode", "svg", "previewUrl", "payloadKind", "length")
  );
  results.push(encoded);
  // For decode, generate a real QR PNG ourselves and feed it back in.
  const qrPng = await makeQrPng("orqis-decode-test");
  results.push(
    await run(
      app,
      "qr-toolkit (decode)",
      "/v1/agents/qr-toolkit/run",
      { mode: "decode", imageBase64: qrPng.toString("base64") },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { mode?: string; text?: string };
        if (b.mode !== "decode") return `mode is ${b.mode}, expected decode`;
        if (b.text !== "orqis-decode-test") return `text is ${b.text}, expected round-trip`;
        return null;
      }
    )
  );

  // 4. exif-clean — pass a jpeg with EXIF.
  const exifJpeg = await makeJpegWithExif();
  results.push(
    await run(
      app,
      "exif-clean",
      "/v1/agents/exif-clean/run",
      {
        imageBase64: exifJpeg.toString("base64"),
        outputFormat: "preserve",
      },
      hasFields("previewUrl", "outputFormat", "removed", "durationMs")
    )
  );

  // 5. diagram-forge — minimal nomnoml source.
  results.push(
    await run(
      app,
      "diagram-forge",
      "/v1/agents/diagram-forge/run",
      {
        source: "[Buyer] -> [orqis API]\n[orqis API] -> [Seller Agent]",
        style: "default",
      },
      hasFields("previewUrl", "svg", "styleApplied", "durationMs")
    )
  );

  // 6. csv-mage — small CSV → SQL.
  results.push(
    await run(
      app,
      "csv-mage",
      "/v1/agents/csv-mage/run",
      {
        csv: "id,name,price\n1,Widget,9.99\n2,Gadget,14.50",
        format: "sql",
        tableName: "products",
      },
      hasFields("format", "output", "rowsParsed", "rowsOutput", "columns")
    )
  );

  // ---------- Tier B ----------

  // 7. tex-press — mock mode by default. Pass minimal main.tex.
  const tex = Buffer.from(
    "\\documentclass{article}\\title{orqis smoke}\\begin{document}body\\end{document}",
    "utf8"
  ).toString("base64");
  results.push(
    await run(
      app,
      "tex-press (mock)",
      "/v1/agents/tex-press/run",
      {
        files: [{ name: "main.tex", contentBase64: tex }],
        entrypoint: "main.tex",
      },
      hasFields("previewUrl", "engineUsed", "pdfBytes", "filesUsed")
    )
  );

  // 8. doc-converter — mock mode by default. md → html.
  results.push(
    await run(
      app,
      "doc-converter (mock)",
      "/v1/agents/doc-converter/run",
      {
        from: "md",
        to: "html",
        content: "# Hello orqis\n\nThis is **bold**.",
      },
      hasFields("output", "outputIsBase64", "outputFormat", "inputFormat", "engineUsed")
    )
  );

  // 9. bg-strip — mock mode (corner chroma key).
  const bgPng = await makeColoredImagePng();
  results.push(
    await run(
      app,
      "bg-strip (mock)",
      "/v1/agents/bg-strip/run",
      { imageBase64: bgPng.toString("base64") },
      hasFields("previewUrl", "modelUsed", "engineUsed", "width", "height")
    )
  );

  // ---------- Tier C-A (browser-dep) ----------
  // 11. page-shot — real Playwright run. example.com is the canonical stable
  // target; the screenshot path is the main thing we want to prove works.
  results.push(
    await run(
      app,
      "page-shot (live)",
      "/v1/agents/page-shot/run",
      { url: "https://example.com", format: "png", waitUntil: "load" },
      hasFields("previewUrl", "width", "height", "format", "finalUrl", "outputBytes")
    )
  );

  // 12. pdf-render — real Playwright run using inline HTML (no network dep,
  // exercises the page.pdf() path).
  results.push(
    await run(
      app,
      "pdf-render (live)",
      "/v1/agents/pdf-render/run",
      {
        html: "<!doctype html><html><body><h1>orqis pdf smoke</h1><p>If you can see this, page.pdf() works.</p></body></html>",
        format: "A4",
        waitUntil: "load",
      },
      hasFields("previewUrl", "outputBytes", "formatUsed")
    )
  );

  // 13. scrape-render — validation path. A live run hits the network,
  // skipped here for determinism.
  results.push(
    await (async () => {
      const r = await app.inject({
        method: "POST",
        url: "/v1/agents/scrape-render/run",
        payload: {},
      });
      return r.statusCode === 400
        ? {
            name: "scrape-render (validation)",
            ok: true,
            status: 400,
            durationMs: 0,
            note: "rejects missing url",
          } satisfies TestResult
        : {
            name: "scrape-render (validation)",
            ok: false,
            status: r.statusCode,
            durationMs: 0,
            note: "expected 400",
            error: r.body.slice(0, 200),
          } satisfies TestResult;
    })()
  );

  // 14. lighthouse-audit — validation path. A live run takes 10-20 s.
  results.push(
    await (async () => {
      const r = await app.inject({
        method: "POST",
        url: "/v1/agents/lighthouse-audit/run",
        payload: {},
      });
      return r.statusCode === 400
        ? {
            name: "lighthouse-audit (validation)",
            ok: true,
            status: 400,
            durationMs: 0,
            note: "rejects missing url",
          } satisfies TestResult
        : {
            name: "lighthouse-audit (validation)",
            ok: false,
            status: r.statusCode,
            durationMs: 0,
            note: "expected 400",
            error: r.body.slice(0, 200),
          } satisfies TestResult;
    })()
  );

  // 14b. site-crawl — validation path. Live BFS would hit the network; skip.
  results.push(
    await (async () => {
      const r = await app.inject({
        method: "POST",
        url: "/v1/agents/site-crawl/run",
        payload: {},
      });
      return r.statusCode === 400
        ? {
            name: "site-crawl (validation)",
            ok: true,
            status: 400,
            durationMs: 0,
            note: "rejects missing startUrl",
          } satisfies TestResult
        : {
            name: "site-crawl (validation)",
            ok: false,
            status: r.statusCode,
            durationMs: 0,
            note: "expected 400",
            error: r.body.slice(0, 200),
          } satisfies TestResult;
    })()
  );

  // ---------- Tier C-B (pure-Node utility) ----------
  // 15. email-truth — disposable hit (fast, no network).
  results.push(
    await run(
      app,
      "email-truth (disposable)",
      "/v1/agents/email-truth/run",
      { email: "test@mailinator.com" },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { verdict?: string; checks?: { disposable?: { isDisposable?: boolean } } };
        if (b.verdict !== "fake") return `expected fake, got ${b.verdict}`;
        if (b.checks?.disposable?.isDisposable !== true) return "disposable not flagged";
        return null;
      }
    )
  );

  // 16. dns-trace — validation path (live runs depend on DNS reachability).
  results.push(
    await (async () => {
      const r = await app.inject({
        method: "POST",
        url: "/v1/agents/dns-trace/run",
        payload: {},
      });
      return r.statusCode === 400
        ? {
            name: "dns-trace (validation)",
            ok: true,
            status: 400,
            durationMs: 0,
            note: "rejects missing domain",
          } satisfies TestResult
        : {
            name: "dns-trace (validation)",
            ok: false,
            status: r.statusCode,
            durationMs: 0,
            note: "expected 400",
            error: r.body.slice(0, 200),
          } satisfies TestResult;
    })()
  );

  // 17. ssl-inspect — validation path (live runs depend on network).
  results.push(
    await (async () => {
      const r = await app.inject({
        method: "POST",
        url: "/v1/agents/ssl-inspect/run",
        payload: {},
      });
      return r.statusCode === 400
        ? {
            name: "ssl-inspect (validation)",
            ok: true,
            status: 400,
            durationMs: 0,
            note: "rejects missing host",
          } satisfies TestResult
        : {
            name: "ssl-inspect (validation)",
            ok: false,
            status: r.statusCode,
            durationMs: 0,
            note: "expected 400",
            error: r.body.slice(0, 200),
          } satisfies TestResult;
    })()
  );

  // 18. og-card — validation path (fetch path skipped for determinism).
  results.push(
    await (async () => {
      const r = await app.inject({
        method: "POST",
        url: "/v1/agents/og-card/run",
        payload: {},
      });
      return r.statusCode === 400
        ? {
            name: "og-card (validation)",
            ok: true,
            status: 400,
            durationMs: 0,
            note: "rejects missing url",
          } satisfies TestResult
        : {
            name: "og-card (validation)",
            ok: false,
            status: r.statusCode,
            durationMs: 0,
            note: "expected 400",
            error: r.body.slice(0, 200),
          } satisfies TestResult;
    })()
  );

  // 19. phone-truth — live parse (no network, libphonenumber is local).
  results.push(
    await run(
      app,
      "phone-truth (live)",
      "/v1/agents/phone-truth/run",
      { phone: "+14155550173", defaultCountry: "US" },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { valid?: boolean; country?: string; e164?: string };
        if (b.valid !== true) return "expected valid: true";
        if (b.country !== "US") return `country was ${b.country}, expected US`;
        if (b.e164 !== "+14155550173") return `e164 was ${b.e164}`;
        return null;
      }
    )
  );

  // 20. a11y-quick — validation path (live runs need Playwright + URL).
  results.push(
    await (async () => {
      const r = await app.inject({
        method: "POST",
        url: "/v1/agents/a11y-quick/run",
        payload: {},
      });
      return r.statusCode === 400
        ? {
            name: "a11y-quick (validation)",
            ok: true,
            status: 400,
            durationMs: 0,
            note: "rejects missing url",
          } satisfies TestResult
        : {
            name: "a11y-quick (validation)",
            ok: false,
            status: r.statusCode,
            durationMs: 0,
            note: "expected 400",
            error: r.body.slice(0, 200),
          } satisfies TestResult;
    })()
  );

  // ---------- Tier D (LLM passthrough + product wrappers) ----------
  // 21-26: every Tier D agent should run in mock mode (no API keys set
  // in the smoke env), proving the dual-mode dispatch works without
  // burning real LLM credits.

  results.push(
    await run(
      app,
      "claude-chat (mock)",
      "/v1/agents/claude-chat/run",
      { messages: [{ role: "user", content: "smoke test" }], maxTokens: 64 },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { mode?: string; text?: string };
        if (b.mode !== "mock") return `expected mock, got ${b.mode}`;
        if (!b.text) return "no text in response";
        return null;
      }
    )
  );

  results.push(
    await run(
      app,
      "gpt-chat (mock)",
      "/v1/agents/gpt-chat/run",
      { messages: [{ role: "user", content: "smoke test" }], maxTokens: 64 },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { mode?: string; text?: string };
        if (b.mode !== "mock") return `expected mock, got ${b.mode}`;
        if (!b.text) return "no text in response";
        return null;
      }
    )
  );

  results.push(
    await run(
      app,
      "gemini-chat (mock)",
      "/v1/agents/gemini-chat/run",
      { messages: [{ role: "user", content: "smoke test" }], maxTokens: 64 },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { mode?: string; text?: string };
        if (b.mode !== "mock") return `expected mock, got ${b.mode}`;
        if (!b.text) return "no text in response";
        return null;
      }
    )
  );

  // Budget tier (OpenRouter-backed). Each listing must fall back to its own
  // default model in mock mode and echo it back.
  for (const [slug, defaultModel] of [
    ["glm-chat", "z-ai/glm-5.2:free"],
    ["nemotron-chat", "nvidia/nemotron-3-super-120b-a12b:free"],
    ["budget-chat", "z-ai/glm-5.2:free"],
  ] as const) {
    results.push(
      await run(
        app,
        `${slug} (mock)`,
        `/v1/agents/${slug}/run`,
        { messages: [{ role: "user", content: "smoke test" }], maxTokens: 64 },
        (body) => {
          if (!body || typeof body !== "object") return "body is not an object";
          const b = body as { mode?: string; text?: string; model?: string; usage?: { costUsd?: unknown } };
          if (b.mode !== "mock") return `expected mock, got ${b.mode}`;
          if (!b.text) return "no text in response";
          if (b.model !== defaultModel) return `expected default model ${defaultModel}, got ${b.model}`;
          if (!b.usage || !("costUsd" in b.usage)) return "usage.costUsd missing";
          return null;
        }
      )
    );
  }

  // budget-chat — model ids must be OpenRouter `vendor/model` slugs, even in mock.
  results.push(
    await (async () => {
      const r = await app.inject({
        method: "POST",
        url: "/v1/agents/budget-chat/run",
        payload: { messages: [{ role: "user", content: "hi" }], model: "gpt-4o-mini" },
      });
      return r.statusCode === 400
        ? {
            name: "budget-chat (validation)",
            ok: true,
            status: 400,
            durationMs: 0,
            note: "rejects non-slug model id",
          } satisfies TestResult
        : {
            name: "budget-chat (validation)",
            ok: false,
            status: r.statusCode,
            durationMs: 0,
            note: "expected 400",
            error: r.body.slice(0, 200),
          } satisfies TestResult;
    })()
  );

  results.push(
    await run(
      app,
      "nano-banana (mock)",
      "/v1/agents/nano-banana/run",
      { prompt: "smoke test prompt", aspectRatio: "1:1" },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { mode?: string; previewUrl?: string; width?: number };
        if (b.mode !== "mock") return `expected mock, got ${b.mode}`;
        if (!b.previewUrl) return "no previewUrl";
        if (b.width !== 1024) return `expected 1024 width, got ${b.width}`;
        return null;
      }
    )
  );

  results.push(
    await run(
      app,
      "text-summarize (mock)",
      "/v1/agents/text-summarize/run",
      {
        text: "Marketplaces aggregate supply and demand. The platform owns trust. Discovery is the moat. Sellers list once. Buyers find via search. Reviews shape behavior. Network effects compound. Verticals win when broad fails.",
        maxWords: 30,
        style: "bulleted",
      },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { mode?: string; summary?: string };
        if (b.mode !== "mock") return `expected mock, got ${b.mode}`;
        if (!b.summary) return "no summary";
        return null;
      }
    )
  );

  results.push(
    await run(
      app,
      "entity-extract (mock, regex preset)",
      "/v1/agents/entity-extract/run",
      {
        text: "Contact jane@example.com or visit https://orqis.xyz to learn more.",
        preset: "emails",
      },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { mode?: string; entities?: unknown };
        if (b.mode !== "mock") return `expected mock, got ${b.mode}`;
        if (!Array.isArray(b.entities) || !b.entities.includes("jane@example.com")) {
          return "regex preset didn't extract the email";
        }
        return null;
      }
    )
  );

  results.push(
    await run(
      app,
      "code-explain (mock)",
      "/v1/agents/code-explain/run",
      {
        code: "const add = (a, b) => a + b;",
        language: "javascript",
        audience: "beginner",
      },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { mode?: string; explanation?: string; bullets?: unknown };
        if (b.mode !== "mock") return `expected mock, got ${b.mode}`;
        if (!b.explanation) return "no explanation";
        if (!Array.isArray(b.bullets)) return "bullets not an array";
        return null;
      }
    )
  );

  results.push(
    await run(
      app,
      "compare-models (mock)",
      "/v1/agents/compare-models/run",
      { prompt: "smoke test", maxTokens: 64 },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { answers?: { provider?: string; ok?: boolean; mode?: string }[] };
        if (!Array.isArray(b.answers) || b.answers.length !== 3) {
          return `expected 3 answers, got ${b.answers?.length}`;
        }
        const providers = new Set(b.answers.map((a) => a.provider));
        if (!(providers.has("claude") && providers.has("gpt") && providers.has("gemini"))) {
          return "missing one of claude/gpt/gemini in answers";
        }
        if (!b.answers.every((a) => a.ok)) return "at least one provider failed";
        if (!b.answers.every((a) => a.mode === "mock")) return "expected all mocks";
        return null;
      }
    )
  );

  // 10. subtitle-bot — async. Verify the 202 ack path.
  results.push(
    await run(
      app,
      "subtitle-bot (202 ack)",
      "/v1/agents/subtitle-bot/run",
      { audioUrl: "https://example.com/clip.mp3" },
      (body) => {
        if (!body || typeof body !== "object") return "body is not an object";
        const b = body as { accepted?: boolean; mode?: string };
        if (b.accepted !== true) return "accepted should be true";
        if (b.mode !== "mock" && b.mode !== "real") return `mode unexpected: ${b.mode}`;
        return null;
      },
      {
        "x-orqis-webhook-url": "http://127.0.0.1:0/never-called",
        "x-orqis-webhook-secret": "smoke-test-secret",
      }
    )
  );

  // ---------- Report ----------
  console.log(`\nResults (${results.length} agents):\n`);
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const marker = r.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const status = r.status ? `${DIM}[${r.status}]${RESET}` : "";
    const time = `${DIM}${r.durationMs}ms${RESET}`;
    console.log(`  ${marker}  ${r.name.padEnd(28)} ${status} ${time}  ${DIM}${r.note}${RESET}`);
    if (r.error) console.log(`     ${YELLOW}↳ ${r.error.replace(/\n/g, "\n       ")}${RESET}`);
    if (r.ok) passed++;
    else failed++;
  }
  console.log(
    `\n${passed === results.length ? GREEN : RED}${passed} passed, ${failed} failed${RESET}\n`
  );

  await app.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke test crashed:", err);
  process.exit(2);
});
