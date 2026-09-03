import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Activity,
  Clock,
  Coins,
  Star,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { loadAgentAnalytics, type AgentAnalytics } from "@/lib/seller-analytics";
import { InvocationSparkline } from "@/components/dashboard/InvocationSparkline";

export const dynamic = "force-dynamic";

const fmtDate = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: `${slug} · analytics` };
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) notFound();

  const { slug } = await params;
  const data = await loadAgentAnalytics({
    slug,
    callerUserId: session.user.id,
    callerIsAdmin: session.user.role === "admin",
  });
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/agents"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        My agents
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <span
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-2xl border"
            style={{
              background: `${data.agent.accentHex}1f`,
              borderColor: `${data.agent.accentHex}40`,
            }}
          >
            {data.agent.iconEmoji || "✨"}
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-fg">
              {data.agent.name}{" "}
              <span className="text-fg-subtle text-sm font-normal">analytics</span>
            </h2>
            <p className="mt-0.5 text-xs text-fg-subtle">
              Last {data.windowDays} days · {data.agent.isAsync ? "async" : "sync"} ·{" "}
              {data.agent.pricePerCall} cr / call
            </p>
          </div>
        </div>
        <Link
          href={`/agents/${data.agent.slug}`}
          className="inline-flex items-center gap-1 text-sm text-violet hover:text-fg transition-colors"
        >
          Public listing <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Invocations"
          value={data.summary.totalInvocations.toLocaleString()}
          hint={`${data.summary.totalSucceeded.toLocaleString()} succeeded`}
          Icon={Activity}
          accent="violet"
        />
        <StatCard
          label="Credits earned"
          value={data.summary.creditsEarned.toLocaleString()}
          hint={`succeeded calls × ${data.agent.pricePerCall} cr`}
          Icon={Coins}
          accent="cyan"
        />
        <StatCard
          label="Success rate"
          value={`${(data.summary.successRate * 100).toFixed(1)}%`}
          hint={`${data.summary.totalSucceeded} ÷ ${data.summary.totalInvocations} runs`}
          Icon={CheckCircle2}
          accent={data.summary.successRate >= 0.9 ? "green" : "pink"}
        />
        <StatCard
          label="Refund rate"
          value={`${(data.summary.refundRate * 100).toFixed(1)}%`}
          hint={`${data.summary.totalRefunded} refunded of ${
            data.summary.totalSucceeded +
            data.summary.totalFailed +
            data.summary.totalRefunded
          } terminal`}
          Icon={TrendingDown}
          accent={data.summary.refundRate <= 0.05 ? "green" : "pink"}
        />
        <StatCard
          label="p50 latency"
          value={data.summary.p50LatencyMs != null ? `${data.summary.p50LatencyMs}ms` : "—"}
          hint="median of succeeded calls"
          Icon={Clock}
          accent="muted"
        />
        <StatCard
          label="p95 latency"
          value={data.summary.p95LatencyMs != null ? `${data.summary.p95LatencyMs}ms` : "—"}
          hint="95th percentile"
          Icon={Clock}
          accent="muted"
        />
        <StatCard
          label="Average rating"
          value={data.agent.ratingAverage.toFixed(1)}
          hint={`${data.agent.ratingCount} verified reviews`}
          Icon={Star}
          accent="violet"
        />
        <StatCard
          label="Pending"
          value={data.summary.totalPending.toLocaleString()}
          hint="async jobs in flight"
          Icon={Clock}
          accent={data.summary.totalPending > 0 ? "violet" : "muted"}
        />
      </section>

      <section className="surface-elev p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-base font-semibold tracking-tight">Invocations · last 30 days</h3>
          <div className="flex items-center gap-3 text-[11px] text-fg-subtle">
            <Legend color="#06b6d4" label="succeeded" />
            <Legend color="#ec4899" label="failed/refunded" />
            <Legend color="#a855f7" label="pending" />
          </div>
        </div>
        <InvocationSparkline data={data.summary.daily} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <RecentInvocations rows={data.recentInvocations} />
        <RecentReviews rows={data.recentReviews} />
      </section>
    </div>
  );
}

const ACCENT: Record<
  "violet" | "cyan" | "green" | "pink" | "muted",
  { fg: string; bg: string; border: string }
> = {
  violet: { fg: "text-violet", bg: "bg-violet/15", border: "border-violet/30" },
  cyan: { fg: "text-cyan", bg: "bg-cyan/15", border: "border-cyan/30" },
  green: { fg: "text-green", bg: "bg-green/15", border: "border-green/30" },
  pink: { fg: "text-pink", bg: "bg-pink/15", border: "border-pink/30" },
  muted: { fg: "text-fg-muted", bg: "bg-white/[0.04]", border: "border-[var(--border)]" },
};

function StatCard({
  label,
  value,
  hint,
  Icon,
  accent = "muted",
}: {
  label: string;
  value: string;
  hint: string;
  Icon: typeof Activity;
  accent?: keyof typeof ACCENT;
}) {
  const a = ACCENT[accent];
  return (
    <div className="surface-elev p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em] text-fg-subtle">{label}</span>
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md border ${a.bg} ${a.border} ${a.fg}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight font-mono text-fg">{value}</p>
      <p className="mt-1 text-[11px] text-fg-subtle leading-relaxed">{hint}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-fg-muted">{label}</span>
    </span>
  );
}

function RecentInvocations({ rows }: { rows: AgentAnalytics["recentInvocations"] }) {
  return (
    <div>
      <h3 className="text-base font-semibold tracking-tight text-fg mb-3">Recent invocations</h3>
      {rows.length === 0 ? (
        <div className="surface-elev p-6 text-center text-fg-muted text-sm">
          No invocations yet.
        </div>
      ) : (
        <ul className="surface-elev divide-y divide-[var(--border)] overflow-hidden">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <InvIcon status={r.status} />
                <div className="min-w-0">
                  <p className="text-sm text-fg">
                    <span className="capitalize">{r.status}</span>
                    {r.errorCode && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-pink">
                        {r.errorCode}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-fg-subtle">
                    {fmtDate.format(new Date(r.createdAt))}
                    {r.latencyMs != null && (
                      <span className="ml-2 font-mono">{Math.round(r.latencyMs)}ms</span>
                    )}
                  </p>
                </div>
              </div>
              <span className="font-mono text-sm tabular-nums text-fg-muted shrink-0">
                {r.creditsCharged}cr
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InvIcon({ status }: { status: AgentAnalytics["recentInvocations"][number]["status"] }) {
  if (status === "succeeded") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-cyan/15 text-cyan shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet/15 text-violet shrink-0">
        <ArrowDownLeft className="w-3.5 h-3.5" />
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet/15 text-violet shrink-0 animate-pulse">
        <Clock className="w-3.5 h-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-pink/15 text-pink shrink-0">
      <AlertTriangle className="w-3.5 h-3.5" />
    </span>
  );
}

function RecentReviews({ rows }: { rows: AgentAnalytics["recentReviews"] }) {
  return (
    <div>
      <h3 className="text-base font-semibold tracking-tight text-fg mb-3">Recent reviews</h3>
      {rows.length === 0 ? (
        <div className="surface-elev p-6 text-center text-fg-muted text-sm">
          No reviews yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="surface-elev p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-fg font-medium">
                  {r.authorName}{" "}
                  {r.verifiedUse && (
                    <span className="ml-1 text-[10px] uppercase tracking-wider text-cyan">
                      verified
                    </span>
                  )}
                </p>
                <span className="text-xs text-violet font-mono">
                  {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                </span>
              </div>
              {r.title && <p className="mt-2 text-[14px] font-medium text-fg">{r.title}</p>}
              {r.body && (
                <p className="mt-1 text-[13px] text-fg-muted leading-relaxed line-clamp-3">
                  {r.body}
                </p>
              )}
              <p className="mt-2 text-[10.5px] text-fg-subtle">
                {fmtDate.format(new Date(r.createdAt))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
