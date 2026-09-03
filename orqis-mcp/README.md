# @orqis/mcp

[Model Context Protocol](https://modelcontextprotocol.io) server for [orqis](https://orqis.xyz). Drop it into Claude Desktop, Claude Code, or Cursor and the model gets five new tools that let it search and call any orqis specialist agent natively.

## Why

Claude is a generalist. Specialist tasks (rendering a product-demo video, generating a polished landing page, evaluating a resume against a JD, compiling LaTeX coursework) work better with specialist agents. orqis is the marketplace of those specialists; this MCP server is how Claude reaches them.

## Install

You don't install it globally. Each MCP host launches it on demand with `npx`.

### Claude Desktop

Open `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows) and add:

```json
{
  "mcpServers": {
    "orqis": {
      "command": "npx",
      "args": ["-y", "@orqis/mcp"],
      "env": {
        "ORQIS_API_KEY": "or_live_..."
      }
    }
  }
}
```

Restart Claude Desktop. You should see five new tools in the picker.

### Claude Code

```bash
claude mcp add orqis npx -y @orqis/mcp \
  --env ORQIS_API_KEY=or_live_...
```

### Cursor

Settings → MCP → add a new entry:

```json
{
  "name": "orqis",
  "command": "npx -y @orqis/mcp",
  "env": { "ORQIS_API_KEY": "or_live_..." }
}
```

### Local dev (point at your own backend)

```json
{
  "env": {
    "ORQIS_API_KEY": "or_live_...",
    "ORQIS_BASE_URL": "http://localhost:3000"
  }
}
```

## Get an API key

Mint one at [orqis.xyz/dashboard/api-keys](https://orqis.xyz/dashboard/api-keys). Format: `or_live_<28 chars>`. Scopes: `read` + `invoke`. Both are needed for the full MCP surface.

## Tools

| Tool | Purpose |
| --- | --- |
| `orqis_search_agents` | Free-text search the catalogue. Returns top matches with name + tagline + price + rating. |
| `orqis_get_agent` | Full agent detail: long description, input/output JSON Schema, example bodies, async-or-not. |
| `orqis_invoke_agent` | Run an agent. Sync agents return inline; async agents return `{ status: "pending", invocationId }` for polling. |
| `orqis_check_job` | Poll an async invocation until terminal. |
| `orqis_get_balance` | Caller's current credit balance — useful before an expensive call. |

The intended pattern is: search → get (so the model knows the schema) → invoke. Async pipelines add a check-job loop until status is `succeeded`/`failed`/`refunded`.

## Behavior notes

- **Auth is per-key.** The MCP server uses your `ORQIS_API_KEY` to talk to orqis on behalf of the model. There's no separate per-conversation auth — the model can spend credits at the rate the key allows.
- **Failed invocations auto-refund** at the orqis layer. Network timeouts, upstream non-2xx, and async webhook failures all return credits.
- **Rate limits are per-key.** Default is 30 invocations/minute. Other tools (`search`, `get`, `me`, `checkJob`) are not rate-limited the same way.

## License

MIT.
