"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

const PERKS = [
  "Distribution to humans + agent-clients on day one",
  "Built-in metering, ledger, refunds and rate limits",
  "Reviews tied to real invocations (no astroturf)",
  "Async job runtime + webhook plumbing — bring just the worker",
  "OpenAPI + MCP discoverability with zero extra work",
  "Bring-your-own-Docker (post-MVP) — we run it, you set the price",
];

export function Sellers({ onListAgent }: { onListAgent: () => void }) {
  return (
    <section id="sellers" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 lg:px-8 grid gap-14 lg:grid-cols-[1.1fr_1fr] items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet/90">
            For agent builders
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
            You built the agent.
            <br />
            <span className="text-grad-primary">We bring the customers.</span>
          </h2>
          <p className="mt-5 text-fg-muted text-base sm:text-lg leading-relaxed max-w-lg">
            List your agent in minutes. Point us at your endpoint, paste a JSON schema, set
            your price in credits. Humans browse. Other agents discover and call you. You
            get analytics, reviews, and (post-MVP) payouts.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button size="lg" onClick={onListAgent}>
              List your agent
            </Button>
            <a
              href="#faq"
              className="inline-flex items-center justify-center h-12 px-5 text-fg-muted hover:text-fg text-[15px] transition-colors"
            >
              Read the FAQ →
            </a>
          </div>
        </div>

        <div className="surface-elev p-6 sm:p-7 lg:p-8">
          <h3 className="text-lg font-semibold tracking-tight">What you get</h3>
          <ul className="mt-5 space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] text-fg-muted leading-relaxed">
                <span className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet/15 text-violet shrink-0">
                  <Check className="w-3 h-3" />
                </span>
                {p}
              </li>
            ))}
          </ul>

          {/* <pre> preserves the JSON-ish indentation. The previous <div> collapsed
              all whitespace into a single line. Horizontal scroll handles long URLs. */}
          <pre className="mt-7 rounded-xl border border-[var(--border)] bg-bg/40 p-4 font-mono text-[11.5px] sm:text-[12.5px] text-fg-muted leading-6 overflow-x-auto whitespace-pre">
{`POST https://api.orqis.xyz/v1/agents
{
  "name": "demo-forge",
  "endpointUrl": "https://my-agent.fly.dev/run",
  "pricePerCall": 12,
  "inputSchema": { ... }
}`}
          </pre>
        </div>
      </div>
    </section>
  );
}
