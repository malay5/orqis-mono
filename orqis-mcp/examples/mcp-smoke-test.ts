/**
 * MCP smoke test — runs without a server, without orqis, without Claude.
 *
 * We:
 *   1. Build the orqis MCP server with a stubbed Orqis client (canned responses).
 *   2. Pair it with an in-memory MCP client.
 *   3. ListTools → assert the 5 tool names + descriptions.
 *   4. CallTool for each of the 5 tools → assert the parsed payload.
 *
 * No real network. Useful as a regression guard the next time we touch
 * either the MCP wiring or the underlying SDK.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  AgentDetail,
  AgentSummary,
  InvokeResult,
  JobStatus,
  Me,
} from "@orqis/sdk";

import { buildOrqisMcpServer } from "../src/server.js";
import type { OrqisLike } from "../src/tools.js";

// ---------- tiny test harness ----------

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.log(
      `  \x1b[31m✗\x1b[0m ${name}\n      ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    failed++;
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEq<T>(actual: T, expected: T, what: string): void {
  if (actual !== expected) {
    throw new Error(
      `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

// ---------- stub OrqisLike ----------

const STUB_AGENT: AgentSummary = {
  slug: "landing-forge",
  name: "landing-forge",
  tagline: "Deployable landing pages from a one-paragraph brief.",
  category: "Web",
  tags: ["landing page"],
  pricePerCall: 5,
  isAsync: false,
  ratingAverage: 4.8,
  ratingCount: 124,
  invocationCount: 3104,
};
const STUB_DETAIL: AgentDetail = {
  ...STUB_AGENT,
  description: "Short.",
  longDescription: "Long.",
  iconEmoji: "🪄",
  accentHex: "#6366f1",
  inputSchema: { type: "object", properties: { productName: { type: "string" } } },
  outputSchema: { type: "object" },
  exampleRequest: { productName: "Bark" },
  exampleResponse: { previewUrl: "https://orqis.xyz/r/x.html" },
};
const STUB_ME: Me = {
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
};
const STUB_INVOKE_SYNC: InvokeResult = {
  ok: true,
  status: "succeeded",
  invocationId: "inv_1",
  latencyMs: 12,
  creditsCharged: 5,
  newBalance: 82,
  result: { previewUrl: "https://orqis.xyz/r/abc.html" },
  schemaWarning: null,
};
const STUB_JOB: JobStatus = {
  invocationId: "inv_async_1",
  status: "succeeded",
  isAsync: true,
  httpStatus: 200,
  latencyMs: 8200,
  creditsCharged: 50,
  errorCode: "",
  errorMessage: "",
  result: { previewUrl: "https://orqis.xyz/r/x.mp4" },
  createdAt: "2026-04-28T00:00:00.000Z",
  completedAt: "2026-04-28T00:00:08.200Z",
};

const calls: Record<string, unknown[]> = {
  search: [],
  get: [],
  invoke: [],
  checkJob: [],
  me: [],
};

const stubClient: OrqisLike = {
  search: async (q, opts) => {
    calls.search.push({ q, opts });
    return { count: 1, agents: [STUB_AGENT] };
  },
  get: async (slug) => {
    calls.get.push({ slug });
    return STUB_DETAIL;
  },
  invoke: async (slug, body) => {
    calls.invoke.push({ slug, body });
    return STUB_INVOKE_SYNC;
  },
  checkJob: async (id) => {
    calls.checkJob.push({ id });
    return STUB_JOB;
  },
  me: async () => {
    calls.me.push({});
    return STUB_ME;
  },
};

// ---------- run ----------

async function main(): Promise<void> {
  console.log("\n@orqis/mcp — smoke test (in-memory transport, stubbed SDK)\n");

  const server = buildOrqisMcpServer({ client: stubClient });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: "orqis-mcp-smoke", version: "0.0.0" },
    { capabilities: {} }
  );

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  await test("ListTools returns the 5 orqis tools", async () => {
    const res = await client.request({ method: "tools/list" }, ListToolsResultSchema);
    assertEq(res.tools.length, 5, "tools.length");
    const names = res.tools.map((t) => t.name).sort();
    assertEq(
      names.join(","),
      [
        "orqis_check_job",
        "orqis_get_agent",
        "orqis_get_balance",
        "orqis_invoke_agent",
        "orqis_search_agents",
      ].join(","),
      "tool names"
    );
    for (const t of res.tools) {
      assert(
        typeof t.description === "string" && t.description.length > 30,
        `tool ${t.name} should have a non-trivial description`
      );
    }
  });

  await test("orqis_search_agents → forwards to client.search + returns JSON", async () => {
    const res = await client.request(
      {
        method: "tools/call",
        params: {
          name: "orqis_search_agents",
          arguments: { query: "landing page", category: "Web" },
        },
      },
      CallToolResultSchema
    );
    assert(!res.isError, "should not be isError");
    assertEq(res.content.length, 1, "content blocks");
    const block = res.content[0];
    assert(block.type === "text", "block type");
    const parsed = JSON.parse(block.text as string) as {
      count: number;
      agents: AgentSummary[];
    };
    assertEq(parsed.count, 1, "count");
    assertEq(parsed.agents[0].slug, "landing-forge", "first slug");

    const recorded = calls.search.at(-1) as { q: string; opts: { category: string } };
    assertEq(recorded.q, "landing page", "forwarded query");
    assertEq(recorded.opts.category, "Web", "forwarded category");
  });

  await test("orqis_get_agent → forwards slug + returns full detail", async () => {
    const res = await client.request(
      {
        method: "tools/call",
        params: { name: "orqis_get_agent", arguments: { slug: "landing-forge" } },
      },
      CallToolResultSchema
    );
    assert(!res.isError, "should not be isError");
    const block = res.content[0];
    assert(block.type === "text", "block type");
    const parsed = JSON.parse(block.text as string) as AgentDetail;
    assertEq(parsed.slug, "landing-forge", "slug");
    assert(parsed.inputSchema !== null, "inputSchema present");
    assertEq((calls.get.at(-1) as { slug: string }).slug, "landing-forge", "forwarded slug");
  });

  await test("orqis_invoke_agent → forwards body + returns sync result", async () => {
    const res = await client.request(
      {
        method: "tools/call",
        params: {
          name: "orqis_invoke_agent",
          arguments: {
            slug: "landing-forge",
            input: { productName: "Bark", oneLiner: "A smart dog collar." },
          },
        },
      },
      CallToolResultSchema
    );
    assert(!res.isError, "should not be isError");
    const block = res.content[0];
    assert(block.type === "text", "block type");
    const parsed = JSON.parse(block.text as string) as InvokeResult;
    assert(parsed.status === "succeeded", "status succeeded");
    if (parsed.status === "succeeded") {
      assertEq(parsed.invocationId, "inv_1", "invocationId");
      assertEq(parsed.creditsCharged, 5, "creditsCharged");
    }
    const recorded = calls.invoke.at(-1) as {
      slug: string;
      body: { productName: string };
    };
    assertEq(recorded.slug, "landing-forge", "forwarded slug");
    assertEq(recorded.body.productName, "Bark", "forwarded body.productName");
  });

  await test("orqis_check_job → forwards id + returns terminal status", async () => {
    const res = await client.request(
      {
        method: "tools/call",
        params: {
          name: "orqis_check_job",
          arguments: { invocationId: "inv_async_1" },
        },
      },
      CallToolResultSchema
    );
    const block = res.content[0];
    assert(block.type === "text", "block type");
    const parsed = JSON.parse(block.text as string) as JobStatus;
    assertEq(parsed.status, "succeeded", "status");
    assertEq((calls.checkJob.at(-1) as { id: string }).id, "inv_async_1", "forwarded id");
  });

  await test("orqis_get_balance → returns balance + user", async () => {
    const res = await client.request(
      { method: "tools/call", params: { name: "orqis_get_balance", arguments: {} } },
      CallToolResultSchema
    );
    const block = res.content[0];
    assert(block.type === "text", "block type");
    const parsed = JSON.parse(block.text as string) as {
      creditBalance: number;
      user: Me["user"];
    };
    assertEq(parsed.creditBalance, 87, "creditBalance");
    assertEq(parsed.user.email, "ada@example.com", "user.email");
  });

  await test("Unknown tool → isError + descriptive message", async () => {
    const res = await client.request(
      {
        method: "tools/call",
        params: { name: "orqis_does_not_exist", arguments: {} },
      },
      CallToolResultSchema
    );
    assertEq(res.isError, true, "isError");
    const block = res.content[0];
    assert(block.type === "text" && (block.text as string).includes("Unknown tool"), "msg");
  });

  await test("Tool that throws → isError + message", async () => {
    // Swap the client's get() with one that throws to simulate a network error.
    const bad: OrqisLike = {
      ...stubClient,
      get: async () => {
        throw new Error("simulated upstream failure");
      },
    };
    const badServer = buildOrqisMcpServer({ client: bad });
    const [serverT, clientT] = InMemoryTransport.createLinkedPair();
    const c = new Client({ name: "x", version: "0" }, { capabilities: {} });
    await Promise.all([badServer.connect(serverT), c.connect(clientT)]);

    const res = await c.request(
      {
        method: "tools/call",
        params: { name: "orqis_get_agent", arguments: { slug: "anything" } },
      },
      CallToolResultSchema
    );
    assertEq(res.isError, true, "isError");
    const block = res.content[0];
    assert(
      block.type === "text" && (block.text as string).includes("simulated upstream failure"),
      "error message includes the cause"
    );
    await c.close();
  });

  await client.close();

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("smoke-test crashed:", err);
  process.exit(1);
});
