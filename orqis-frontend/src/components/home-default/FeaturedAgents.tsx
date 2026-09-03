import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AgentCard } from "@/components/agents/AgentCard";
import type { AgentView } from "@/lib/agents";

export function FeaturedAgents({ agents }: { agents: AgentView[] }) {
  return (
    <section className="relative py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet/90">
              Featured agents
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-[-0.025em] leading-[1.1]">
              Specialists shipping today.
            </h2>
          </div>
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
          >
            See all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {agents.length === 0 ? (
          <div className="surface-elev p-10 text-center text-fg-muted text-sm">
            No agents to feature yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <AgentCard key={a.slug} agent={a} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
