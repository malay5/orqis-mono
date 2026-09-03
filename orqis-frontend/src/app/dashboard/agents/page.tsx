import Link from "next/link";
import { LayoutGrid, Plus, ArrowUpRight, Star, Coins } from "lucide-react";
import { getSession } from "@/lib/session";
import { listSellerAgents, type SellerAgentRow } from "@/lib/seller-agents";

export const metadata = { title: "My agents" };

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function DashboardAgentsPage() {
  const session = await getSession();
  const rows = session?.user?.id
    ? await listSellerAgents().catch(() => [] as SellerAgentRow[])
    : [];

  return (
    <div className="space-y-6">
      <div className="surface-elev p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white shrink-0">
            <LayoutGrid className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-fg">Agents you sell</h2>
            <p className="mt-1 text-sm text-fg-muted leading-relaxed max-w-xl">
              List your agent on orqis and we&apos;ll handle distribution, metering, refunds
              and rate-limiting. You get analytics + reviews from real users.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/agents/new"
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full font-medium text-white bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] shadow-[0_8px_30px_-8px_rgba(168,85,247,0.55)] hover:brightness-110 transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          List a new agent
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="surface-elev p-10 text-center">
          <p className="text-sm font-medium text-fg">No agents listed yet.</p>
          <p className="mt-1 text-xs text-fg-subtle max-w-md mx-auto leading-relaxed">
            The five-step listing flow takes ~2 minutes. Submissions go to the admin
            review queue and appear on /browse once approved.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="surface-elev p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-base font-semibold tracking-tight text-fg truncate">
                      {a.name}
                    </h3>
                    <StatusBadge status={a.status} />
                    <span className="text-xs text-fg-subtle">
                      submitted {fmt.format(new Date(a.createdAt))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-fg-muted">{a.tagline}</p>
                  <p className="mt-2 text-xs text-fg-subtle">
                    <code className="font-mono text-fg">/agents/{a.slug}</code> ·{" "}
                    {a.category} · {a.isAsync ? "async" : "sync"}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 text-xs text-fg-muted">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-cyan" />
                      <span className="font-mono text-fg">{a.pricePerCall}</span> cr
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-violet" />
                      <span className="font-mono text-fg">{a.ratingAverage.toFixed(1)}</span>
                      <span className="text-fg-subtle">({a.ratingCount})</span>
                    </span>
                    <span className="text-fg-subtle">
                      {a.invocationCount.toLocaleString()} runs
                    </span>
                  </div>
                  {a.status === "approved" && (
                    <Link
                      href={`/agents/${a.slug}`}
                      className="inline-flex items-center gap-1 text-violet hover:text-fg transition-colors"
                    >
                      View public listing <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/agents/${a.slug}/analytics`}
                    className="inline-flex items-center gap-1 text-cyan hover:text-fg transition-colors"
                  >
                    Analytics <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SellerAgentRow["status"] }) {
  const styles: Record<string, string> = {
    draft: "bg-white/[0.04] text-fg-muted border-[var(--border)]",
    pending: "bg-violet/15 text-violet border-violet/30",
    approved: "bg-green/15 text-green border-green/30",
    rejected: "bg-pink/15 text-pink border-pink/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider border ${styles[status]}`}
    >
      {status}
    </span>
  );
}
