import { Orqis, type AgentSummary, type AgentDetail, type JobStatus, type Me, type InvokeResult } from "@orqis/sdk";

/**
 * Five MCP tools that wrap the orqis SDK. Defined as plain async functions
 * here so the smoke test can call them with a stubbed Orqis client without
 * spinning up a real MCP transport. The transport-level wiring lives in
 * src/index.ts.
 */

export type OrqisLike = Pick<
  Orqis,
  "search" | "get" | "invoke" | "checkJob" | "me"
>;

// ---------- input schemas (JSON Schema, minimal) ----------

export const SEARCH_INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Free-text search across name, tagline, description, and tags.",
    },
    category: {
      type: "string",
      description: "Optional exact category filter (e.g. 'Web', 'Image', 'GTM').",
    },
  },
} as const;

export const GET_INPUT_SCHEMA = {
  type: "object",
  required: ["slug"],
  properties: {
    slug: { type: "string", description: "The agent slug (e.g. 'landing-forge')." },
  },
} as const;

export const INVOKE_INPUT_SCHEMA = {
  type: "object",
  required: ["slug", "input"],
  properties: {
    slug: { type: "string", description: "The agent slug." },
    input: {
      type: "object",
      additionalProperties: true,
      description:
        "Agent-specific input. MUST match the agent's inputSchema — call orqis_get_agent first if you don't know the shape.",
    },
  },
} as const;

export const CHECK_JOB_INPUT_SCHEMA = {
  type: "object",
  required: ["invocationId"],
  properties: {
    invocationId: {
      type: "string",
      description: "The id returned by orqis_invoke_agent for an async agent.",
    },
  },
} as const;

export const BALANCE_INPUT_SCHEMA = {
  type: "object",
  properties: {},
} as const;

// ---------- handlers ----------

export type SearchArgs = { query?: string; category?: string };
export async function searchAgents(
  client: OrqisLike,
  args: SearchArgs
): Promise<{ count: number; agents: AgentSummary[] }> {
  return client.search(args.query, { category: args.category });
}

export type GetArgs = { slug: string };
export async function getAgent(
  client: OrqisLike,
  args: GetArgs
): Promise<AgentDetail> {
  return client.get(args.slug);
}

export type InvokeArgs = { slug: string; input: Record<string, unknown> };
export async function invokeAgent(
  client: OrqisLike,
  args: InvokeArgs
): Promise<InvokeResult> {
  return client.invoke(args.slug, args.input);
}

export type CheckJobArgs = { invocationId: string };
export async function checkJob(
  client: OrqisLike,
  args: CheckJobArgs
): Promise<JobStatus> {
  return client.checkJob(args.invocationId);
}

export async function getBalance(
  client: OrqisLike
): Promise<{ creditBalance: number; user: Me["user"] }> {
  const me = await client.me();
  return { creditBalance: me.user.creditBalance, user: me.user };
}

// ---------- tool descriptors used by the MCP server registration ----------

export const TOOL_DESCRIPTORS = [
  {
    name: "orqis_search_agents",
    description:
      "Search the orqis catalogue for specialist AI agents. Use this when the user asks for a capability you don't have natively (rendering a video, generating a landing page, evaluating a resume, etc). Returns top matches with name, tagline, price, and rating. Pass the result's `slug` to orqis_get_agent or orqis_invoke_agent.",
    inputSchema: SEARCH_INPUT_SCHEMA,
  },
  {
    name: "orqis_get_agent",
    description:
      "Fetch full detail for one agent: long description, input/output JSON Schema, example request, example response, pricing, and async-or-not. Always call this before orqis_invoke_agent on an unfamiliar agent so you know what shape its input expects.",
    inputSchema: GET_INPUT_SCHEMA,
  },
  {
    name: "orqis_invoke_agent",
    description:
      "Run an orqis agent. Sync agents return the result inline. Async agents return `{ status: \"pending\", invocationId }` — call orqis_check_job to poll until it completes. Debits credits from the caller's balance; failures auto-refund. Always validate `input` against the agent's `inputSchema` before calling.",
    inputSchema: INVOKE_INPUT_SCHEMA,
  },
  {
    name: "orqis_check_job",
    description:
      "Poll an async invocation by its id. Returns `{ status, result, errorCode, latencyMs, ... }`. `status` is one of `pending`, `succeeded`, `failed`, `refunded`. Keep polling every few seconds while pending.",
    inputSchema: CHECK_JOB_INPUT_SCHEMA,
  },
  {
    name: "orqis_get_balance",
    description:
      "Return the caller's current credit balance. Use this before invoking an expensive agent to confirm there's headroom.",
    inputSchema: BALANCE_INPUT_SCHEMA,
  },
] as const;

export type ToolName = (typeof TOOL_DESCRIPTORS)[number]["name"];

/**
 * Dispatch table for the MCP server's CallTool handler. Centralized so the
 * smoke test can hit the same code path the real server does.
 */
export async function dispatchTool(
  client: OrqisLike,
  name: ToolName,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "orqis_search_agents":
      return searchAgents(client, args as SearchArgs);
    case "orqis_get_agent":
      return getAgent(client, args as GetArgs);
    case "orqis_invoke_agent":
      return invokeAgent(client, args as InvokeArgs);
    case "orqis_check_job":
      return checkJob(client, args as CheckJobArgs);
    case "orqis_get_balance":
      return getBalance(client);
  }
}
