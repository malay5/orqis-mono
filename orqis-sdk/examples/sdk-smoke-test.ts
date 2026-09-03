/**
 * SDK smoke test — runs without a server.
 *
 * The SDK accepts a custom `fetch` impl. We pass a stub that:
 *   1. Records the request URL, method, headers, and body.
 *   2. Returns canned JSON responses matching what the real handlers ship.
 *
 * Each call asserts:
 *   - the SDK hit the right URL with the right method
 *   - the Authorization: Bearer header was set correctly
 *   - the request body (when present) matches what the handler expects
 *   - the parsed return value matches the schema defined in the SDK's types
 *
 * Run:   npm run smoke    (after `npm run build`)
 *
 * No real network, no orqis credits, no AI keys. Useful as a regression
 * guard the next time we touch either the SDK or the handler wire shapes.
 */

import { Orqis, OrqisApiError } from "../src/index.js";

// ---------- tiny test harness ----------

let failed = 0;
let passed = 0;

function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
      passed++;
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  \x1b[31m✗\x1b[0m ${name}\n      ${msg}`);
      failed++;
    });
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, what: string): void {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ---------- canned responses ----------

const TEST_KEY = "or_live_smoke_test_key_value_123456";
const BASE_URL = "https://orqis.test";

type RecordedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown | undefined;
};

function makeStubFetch(canned: Record<string, (req: RecordedRequest) => Response>) {
  const recorded: RecordedRequest[] = [];

  const stub: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL | Request).toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
    }
    let body: unknown = undefined;
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body));
      } catch {
        body = String(init.body);
      }
    }
    const req: RecordedRequest = { url, method, headers, body };
    recorded.push(req);

    // Match by pathname + method.
    const path = new URL(url).pathname;
    const key = `${method} ${path}`;
    const handler =
      canned[key] ??
      // Fallback: try a wildcard match (e.g. "GET /api/v1/agents/*")
      Object.entries(canned).find(([k]) => {
        const [m, p] = k.split(" ");
        return m === method && p.endsWith("*") && path.startsWith(p.slice(0, -1));
      })?.[1];
    if (!handler) {
      return new Response(
        JSON.stringify({ error: `stub: no handler for ${key}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return handler(req);
  };

  return { fetch: stub, recorded };
}

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------- the suite ----------

async function main() {
  console.log("\n@orqis/sdk — smoke test (stubbed fetch, no server)\n");

  // ---------- me() ----------
  await test("me() — sends Bearer + parses response", async () => {
    const { fetch: stub, recorded } = makeStubFetch({
      "GET /api/v1/me": () =>
        jsonRes(200, {
          callerType: "api_key",
          apiKeyId: "key_abc",
          scopes: ["read", "invoke"],
          user: {
            id: "u_1",
            email: "ada@example.com",
            name: "Ada",
            role: "buyer",
            creditBalance: 87,
          },
        }),
    });
    const orqis = new Orqis({ apiKey: TEST_KEY, baseUrl: BASE_URL, fetch: stub });
    const me = await orqis.me();
    assertEq(recorded.length, 1, "request count");
    assertEq(recorded[0].method, "GET", "method");
    assertEq(recorded[0].url, `${BASE_URL}/api/v1/me`, "url");
    assertEq(recorded[0].headers.authorization, `Bearer ${TEST_KEY}`, "auth header");
    assertEq(me.user.creditBalance, 87, "creditBalance");
    assertEq(me.callerType, "api_key", "callerType");
  });

  // ---------- search() ----------
  await test("search() — passes q + category as query string", async () => {
    const { fetch: stub, recorded } = makeStubFetch({
      "GET /api/v1/agents": () =>
        jsonRes(200, {
          count: 1,
          agents: [
            {
              slug: "rng-uniform",
              name: "rng-uniform",
              tagline: "Seeded uniform random number generator.",
              category: "Utilities",
              tags: ["random"],
              pricePerCall: 1,
              isAsync: false,
              ratingAverage: 0,
              ratingCount: 0,
              invocationCount: 0,
            },
          ],
        }),
    });
    const orqis = new Orqis({ apiKey: TEST_KEY, baseUrl: BASE_URL, fetch: stub });
    const r = await orqis.search("random", { category: "Utilities" });
    assertEq(recorded.length, 1, "request count");
    const u = new URL(recorded[0].url);
    assertEq(u.searchParams.get("q"), "random", "query string q");
    assertEq(u.searchParams.get("category"), "Utilities", "query string category");
    assertEq(r.count, 1, "count");
    assertEq(r.agents[0].slug, "rng-uniform", "first agent slug");
  });

  // ---------- get() ----------
  await test("get() — encodes slug + parses detail", async () => {
    const { fetch: stub, recorded } = makeStubFetch({
      "GET /api/v1/agents/sort-bench": () =>
        jsonRes(200, {
          slug: "sort-bench",
          name: "sort-bench",
          tagline: "Sort numbers.",
          description: "",
          longDescription: "",
          category: "Utilities",
          tags: [],
          iconEmoji: "📊",
          accentHex: "#06b6d4",
          pricePerCall: 1,
          isAsync: false,
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          exampleRequest: { numbers: [3, 1, 2] },
          exampleResponse: { sorted: [1, 2, 3] },
          ratingAverage: 0,
          ratingCount: 0,
          invocationCount: 0,
        }),
    });
    const orqis = new Orqis({ apiKey: TEST_KEY, baseUrl: BASE_URL, fetch: stub });
    const a = await orqis.get("sort-bench");
    assertEq(recorded[0].url, `${BASE_URL}/api/v1/agents/sort-bench`, "url");
    assertEq(a.slug, "sort-bench", "slug");
    assertEq(a.pricePerCall, 1, "pricePerCall");
  });

  // ---------- invoke() — sync success ----------
  await test("invoke<T>() — sync agent returns succeeded result", async () => {
    const { fetch: stub, recorded } = makeStubFetch({
      "POST /api/v1/agents/rng-uniform/invoke": () =>
        jsonRes(200, {
          ok: true,
          status: "succeeded",
          invocationId: "inv_1",
          latencyMs: 12,
          creditsCharged: 1,
          newBalance: 86,
          result: { numbers: [4, 6, 1], seed: 42, count: 3 },
          schemaWarning: null,
        }),
    });
    const orqis = new Orqis({ apiKey: TEST_KEY, baseUrl: BASE_URL, fetch: stub });
    const r = await orqis.invoke<{ numbers: number[]; seed: number }>(
      "rng-uniform",
      { count: 3, min: 1, max: 6, integer: true, seed: 42 }
    );
    assertEq(recorded[0].method, "POST", "method");
    assert(typeof recorded[0].body === "object" && recorded[0].body !== null, "body parsed");
    const sentBody = recorded[0].body as Record<string, unknown>;
    assertEq(sentBody.count, 3, "body.count");
    assertEq(sentBody.seed, 42, "body.seed");
    assertEq(recorded[0].headers["content-type"], "application/json", "content-type");
    assert(r.status === "succeeded", "status");
    if (r.status === "succeeded") {
      assertEq(r.creditsCharged, 1, "creditsCharged");
      assertEq(r.result.seed, 42, "result.seed");
    }
  });

  // ---------- invoke() — async pending ----------
  await test("invoke() — async agent returns pending receipt", async () => {
    const { fetch: stub } = makeStubFetch({
      "POST /api/v1/agents/demo-forge/invoke": () =>
        jsonRes(200, {
          ok: true,
          status: "pending",
          invocationId: "inv_async_1",
          creditsCharged: 50,
          message: "Job accepted.",
        }),
    });
    const orqis = new Orqis({ apiKey: TEST_KEY, baseUrl: BASE_URL, fetch: stub });
    const r = await orqis.invoke("demo-forge", { product: "https://linear.app" });
    assert(r.status === "pending", "status pending");
    if (r.status === "pending") {
      assertEq(r.invocationId, "inv_async_1", "invocationId");
      assertEq(r.creditsCharged, 50, "creditsCharged");
    }
  });

  // ---------- checkJob() ----------
  await test("checkJob<T>() — polls /v1/jobs/:id", async () => {
    const { fetch: stub, recorded } = makeStubFetch({
      "GET /api/v1/jobs/inv_async_1": () =>
        jsonRes(200, {
          invocationId: "inv_async_1",
          status: "succeeded",
          isAsync: true,
          httpStatus: 200,
          latencyMs: 8200,
          creditsCharged: 50,
          errorCode: "",
          errorMessage: "",
          result: { previewUrl: "https://orqis.xyz/r/abc.mp4" },
          createdAt: "2026-04-28T00:00:00.000Z",
          completedAt: "2026-04-28T00:00:08.200Z",
        }),
    });
    const orqis = new Orqis({ apiKey: TEST_KEY, baseUrl: BASE_URL, fetch: stub });
    const j = await orqis.checkJob<{ previewUrl: string }>("inv_async_1");
    assertEq(recorded[0].url, `${BASE_URL}/api/v1/jobs/inv_async_1`, "url");
    assertEq(j.status, "succeeded", "status");
    assertEq(j.result?.previewUrl, "https://orqis.xyz/r/abc.mp4", "result.previewUrl");
  });

  // ---------- invokeAndWait() — async happy path ----------
  await test("invokeAndWait<T>() — invokes + polls + returns terminal job", async () => {
    let pollCount = 0;
    const { fetch: stub } = makeStubFetch({
      "POST /api/v1/agents/demo-forge/invoke": () =>
        jsonRes(200, {
          ok: true,
          status: "pending",
          invocationId: "inv_wait_1",
          creditsCharged: 50,
          message: "Job accepted.",
        }),
      "GET /api/v1/jobs/inv_wait_1": () => {
        pollCount++;
        // Pretend to still be pending on the first poll, terminal on the second.
        if (pollCount < 2) {
          return jsonRes(200, {
            invocationId: "inv_wait_1",
            status: "pending",
            isAsync: true,
            httpStatus: null,
            latencyMs: null,
            creditsCharged: 50,
            errorCode: "",
            errorMessage: "",
            result: null,
            createdAt: "2026-04-28T00:00:00.000Z",
            completedAt: null,
          });
        }
        return jsonRes(200, {
          invocationId: "inv_wait_1",
          status: "succeeded",
          isAsync: true,
          httpStatus: 200,
          latencyMs: 8200,
          creditsCharged: 50,
          errorCode: "",
          errorMessage: "",
          result: { previewUrl: "https://orqis.xyz/r/wait.mp4" },
          createdAt: "2026-04-28T00:00:00.000Z",
          completedAt: "2026-04-28T00:00:08.200Z",
        });
      },
    });
    const orqis = new Orqis({ apiKey: TEST_KEY, baseUrl: BASE_URL, fetch: stub });
    const j = await orqis.invokeAndWait<{ previewUrl: string }>(
      "demo-forge",
      { product: "https://linear.app" },
      { pollMs: 10, timeoutMs: 5_000 }
    );
    assertEq(j.status, "succeeded", "terminal status");
    assertEq(j.result?.previewUrl, "https://orqis.xyz/r/wait.mp4", "result.previewUrl");
    assert(pollCount >= 2, `expected at least 2 polls, got ${pollCount}`);
  });

  // ---------- error handling ----------
  await test("non-2xx → throws OrqisApiError with status + body", async () => {
    const { fetch: stub } = makeStubFetch({
      "GET /api/v1/me": () => jsonRes(401, { error: "Sign in required." }),
    });
    const orqis = new Orqis({ apiKey: TEST_KEY, baseUrl: BASE_URL, fetch: stub });
    let caught: unknown;
    try {
      await orqis.me();
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof OrqisApiError, "caught OrqisApiError");
    if (caught instanceof OrqisApiError) {
      assertEq(caught.status, 401, "error.status");
      assertEq(caught.message, "Sign in required.", "error.message");
    }
  });

  // ---------- 402 (out of credits) ----------
  await test("invoke() on 402 → OrqisApiError(402, ...)", async () => {
    const { fetch: stub } = makeStubFetch({
      "POST /api/v1/agents/demo-forge/invoke": () =>
        jsonRes(402, { error: "Insufficient credits — you have 0, need 50." }),
    });
    const orqis = new Orqis({ apiKey: TEST_KEY, baseUrl: BASE_URL, fetch: stub });
    let caught: unknown;
    try {
      await orqis.invoke("demo-forge", { product: "x" });
    } catch (e) {
      caught = e;
    }
    assert(caught instanceof OrqisApiError && caught.status === 402, "402 thrown");
  });

  // ---------- summary ----------
  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("smoke-test crashed:", err);
  process.exit(1);
});
