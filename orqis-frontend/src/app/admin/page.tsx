import Link from "next/link";
import { Users, ClipboardList, Coins, LayoutGrid } from "lucide-react";
import { apiFetchSafe } from "@/lib/api-client";

export const metadata = { title: "Admin overview" };

type AdminStats = {
  userCount: number;
  pendingSubmissions: number;
  pendingListings: number;
  totalGranted: number;
  totalCharged: number;
};

// Sprint 19: counts come from the platform API, which enforces the admin
// check server-side rather than trusting this page to be reachable only by
// admins.
async function getStats(): Promise<AdminStats | null> {
  return apiFetchSafe<AdminStats>("/v1/admin/stats", { authenticated: true });
}

export default async function AdminOverviewPage() {
  const stats = (await getStats()) ?? {
    userCount: 0,
    pendingSubmissions: 0,
    pendingListings: 0,
    totalGranted: 0,
    totalCharged: 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Users" value={stats.userCount} Icon={Users} href="/admin/users" />
        <StatCard
          label="Pending listings"
          value={stats.pendingListings}
          Icon={LayoutGrid}
          href="/admin/listings"
          accent={stats.pendingListings > 0 ? "violet" : "muted"}
        />
        <StatCard
          label="Public-form intake"
          value={stats.pendingSubmissions}
          Icon={ClipboardList}
          href="/admin/agents"
          accent={stats.pendingSubmissions > 0 ? "violet" : "muted"}
        />
        <StatCard label="Credits granted" value={stats.totalGranted} Icon={Coins} />
        <StatCard label="Credits spent" value={stats.totalCharged} Icon={Coins} />
      </div>

      <div className="surface-elev p-7">
        <h2 className="text-base font-semibold tracking-tight text-fg">Quick actions</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link href="/admin/users" className="text-violet hover:text-fg transition-colors">
              → Grant credits to a user
            </Link>
          </li>
          <li>
            <Link href="/admin/listings" className="text-violet hover:text-fg transition-colors">
              → Review pending seller listings
            </Link>
          </li>
          <li>
            <Link href="/admin/agents" className="text-violet hover:text-fg transition-colors">
              → Review public-form agent submissions
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  Icon,
  href,
  accent = "muted",
}: {
  label: string;
  value: number;
  Icon: typeof Users;
  href?: string;
  accent?: "violet" | "muted";
}) {
  const ring =
    accent === "violet"
      ? "border-violet/40 bg-violet/[0.06]"
      : "border-[var(--border)] bg-bg-card";
  const inner = (
    <div className={`rounded-xl border p-5 ${ring} transition-colors hover:border-white/25`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-fg-subtle">{label}</span>
        <Icon className="w-4 h-4 text-fg-muted" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight font-mono text-fg">
        {value.toLocaleString()}
      </p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
