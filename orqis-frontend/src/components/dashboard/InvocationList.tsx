import Link from "next/link";
import { CheckCircle2, AlertTriangle, Clock, ArrowDownLeft } from "lucide-react";
import type { InvocationView } from "@/lib/invocations";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function InvocationList({ rows }: { rows: InvocationView[] }) {
  if (rows.length === 0) {
    return (
      <div className="surface-elev p-8 text-center text-fg-muted text-sm">
        No invocations yet. Try the{" "}
        <Link href="/agents/rng-uniform" className="text-violet hover:text-fg transition-colors">
          rng-uniform
        </Link>{" "}
        or any other agent on{" "}
        <Link href="/browse" className="text-violet hover:text-fg transition-colors">
          /browse
        </Link>{" "}
        to see this list populate.
      </div>
    );
  }

  return (
    <ul className="surface-elev divide-y divide-[var(--border)] overflow-hidden">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <StatusIcon status={r.status} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg truncate">
                {r.agentEmoji && <span className="mr-1.5">{r.agentEmoji}</span>}
                {r.agentSlug ? (
                  <Link href={`/agents/${r.agentSlug}`} className="hover:text-grad-primary">
                    {r.agentName ?? r.agentSlug}
                  </Link>
                ) : (
                  <span className="text-fg-muted">deleted agent</span>
                )}
                {r.errorCode && (
                  <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider border border-pink/30 bg-pink/10 text-pink">
                    {r.errorCode}
                  </span>
                )}
              </p>
              <p className="text-xs text-fg-subtle">
                {fmt.format(new Date(r.createdAt))}
                {r.latencyMs != null && (
                  <span className="ml-2 font-mono">{r.latencyMs}ms</span>
                )}
                {r.httpStatus != null && (
                  <span className="ml-2 font-mono">HTTP {r.httpStatus}</span>
                )}
              </p>
            </div>
          </div>
          <span className="font-mono text-sm tabular-nums text-fg shrink-0">
            -{r.creditsCharged}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatusIcon({ status }: { status: InvocationView["status"] }) {
  if (status === "succeeded") {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cyan/15 text-cyan shrink-0">
        <CheckCircle2 className="w-4 h-4" />
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-violet/15 text-violet shrink-0">
        <ArrowDownLeft className="w-4 h-4" />
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.04] text-fg-muted shrink-0">
        <Clock className="w-4 h-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink/15 text-pink shrink-0">
      <AlertTriangle className="w-4 h-4" />
    </span>
  );
}
