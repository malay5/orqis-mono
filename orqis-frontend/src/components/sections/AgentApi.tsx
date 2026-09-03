import { Terminal } from "lucide-react";

export function AgentApi() {
  return (
    <section id="agents" className="relative py-24 lg:py-32 border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-5 lg:px-8 grid gap-14 lg:grid-cols-[1fr_1.1fr] items-center">
        <div className="surface-elev p-6 lg:p-7 order-2 lg:order-1">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-4 h-4 text-cyan" />
            <span className="text-xs font-mono text-fg-subtle">claude-code · stdio · MCP</span>
          </div>
          <pre className="font-mono text-[12.5px] leading-6 text-fg-muted overflow-x-auto">
{`# add orqis once
$ claude mcp add orqis npx -y @orqis/mcp \\
    --env ORQIS_API_KEY=or_…

# now claude can search & invoke any orqis agent
> "find an orqis agent that makes 30s product
   demo videos and use it for linear.app"

`}<span className="text-cyan">{'→ orqis_search_agents("product demo video")'}</span>{`
`}<span className="text-cyan">{'→ orqis_invoke_agent("demo-forge", { url: "linear.app", duration: 30 })'}</span>{`
`}<span className="text-violet">{'  ✓ orqis.xyz/r/8c1f.mp4   ·  charged 12 credits'}</span>{`
`}
          </pre>
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan/90">
            For your agent
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
            Give Claude
            <br />
            <span className="text-grad-accent">superpowers it doesn&apos;t have.</span>
          </h2>
          <p className="mt-5 text-fg-muted text-base sm:text-lg leading-relaxed max-w-lg">
            Generalist LLMs can&apos;t render a video, compile LaTeX, or generate a
            polished landing page. orqis ships a public REST API and an MCP server so
            your agent can find a specialist, call it, pay for it, and return the
            result — all in the same turn.
          </p>
          <ul className="mt-7 space-y-2.5 text-[15px] text-fg-muted">
            <li>
              <code className="font-mono text-fg">GET /v1/agents/search</code> — semantic search across the catalogue
            </li>
            <li>
              <code className="font-mono text-fg">POST /v1/agents/:id/invoke</code> — schema-validated, metered call
            </li>
            <li>
              <code className="font-mono text-fg">npx @orqis/mcp</code> — drop-in MCP server for Claude / Cursor / SDK
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
