import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Orqis } from "@orqis/sdk";
import { dispatchTool, TOOL_DESCRIPTORS, type OrqisLike, type ToolName } from "./tools.js";

/**
 * Build (but don't connect) an MCP server pre-loaded with the orqis tools.
 * Factored out of the bin entrypoint so the smoke test can wire it up to an
 * in-memory transport instead of stdio.
 *
 * `client` defaults to a real Orqis instance constructed from ORQIS_API_KEY.
 * The smoke test passes a stubbed implementation.
 */
export type BuildServerOpts = {
  client?: OrqisLike;
  name?: string;
  version?: string;
};

export function buildOrqisMcpServer(opts: BuildServerOpts = {}): Server {
  const server = new Server(
    {
      name: opts.name ?? "orqis-mcp",
      version: opts.version ?? "0.1.0",
    },
    {
      capabilities: { tools: {} },
    }
  );

  const client = opts.client ?? defaultClientFromEnv();

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DESCRIPTORS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name as ToolName;
    if (!TOOL_DESCRIPTORS.some((t) => t.name === name)) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
        isError: true,
      };
    }
    try {
      const result = await dispatchTool(
        client,
        name,
        (req.params.arguments ?? {}) as Record<string, unknown>
      );
      // MCP requires text content for tool replies. We serialise the JSON
      // result for the model to parse — same shape every tool returns.
      return {
        content: [
          { type: "text", text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

function defaultClientFromEnv(): OrqisLike {
  const apiKey = process.env.ORQIS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ORQIS_API_KEY is not set. Mint a key at https://orqis.xyz/dashboard/api-keys and pass it to the MCP host (e.g. in your Claude Desktop config under env)."
    );
  }
  return new Orqis({
    apiKey,
    baseUrl: process.env.ORQIS_BASE_URL ?? "https://orqis.xyz",
    userAgent: "orqis-mcp/0.1.0",
  });
}
