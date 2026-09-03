import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildOrqisMcpServer } from "./server.js";

export { buildOrqisMcpServer } from "./server.js";
export { TOOL_DESCRIPTORS, dispatchTool } from "./tools.js";
export type { OrqisLike, ToolName } from "./tools.js";

/**
 * Entry point used by `npx @orqis/mcp` (via the bin script). MCP hosts
 * (Claude Desktop, Claude Code, Cursor) launch this with stdio.
 */
export async function runStdio(): Promise<void> {
  const server = buildOrqisMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep the process alive — the MCP SDK manages the loop via stdio.
}
