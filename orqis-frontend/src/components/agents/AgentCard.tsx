import Link from "next/link";
import { Star, Zap, Clock } from "lucide-react";
import type { AgentView } from "@/lib/agents";

export function AgentCard({ agent }: { agent: AgentView }) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="group relative surface-elev p-6 transition-all duration-200 hover:border-white/25 hover:-translate-y-0.5"
    >
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity"
        style={{ background: `radial-gradient(closest-side, ${agent.accentHex}, transparent)` }}
      />
      <div className="relative flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-2xl border"
          style={{
            background: `${agent.accentHex}1f`,
            borderColor: `${agent.accentHex}40`,
          }}
        >
          {agent.iconEmoji || "✨"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight text-fg truncate">
            {agent.name}
          </h3>
          <p className="text-xs text-fg-subtle uppercase tracking-wider mt-0.5">
            {agent.category}
            {agent.isAsync ? " · async" : ""}
          </p>
        </div>
      </div>

      <p className="relative mt-4 text-[14.5px] text-fg-muted leading-relaxed line-clamp-2">
        {agent.tagline}
      </p>

      <div className="relative mt-5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-violet" />
            <span className="font-medium text-fg">{agent.ratingAverage.toFixed(1)}</span>
            <span className="text-fg-subtle">({agent.ratingCount})</span>
          </span>
          <span className="inline-flex items-center gap-1">
            {agent.isAsync ? (
              <Clock className="w-3.5 h-3.5 text-cyan" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-cyan" />
            )}
            <span className="text-fg-subtle">{agent.invocationCount.toLocaleString()} runs</span>
          </span>
        </div>
        <span className="font-mono text-fg">
          {agent.pricePerCall} <span className="text-fg-subtle">cr</span>
        </span>
      </div>
    </Link>
  );
}
