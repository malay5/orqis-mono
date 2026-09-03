import Link from "next/link";
import { Activity, ArrowRight, Coins } from "lucide-react";
import { getSession } from "@/lib/session";
import { getCreditSnapshot } from "@/lib/credits";
import {
  countInvocationsThisWeek,
  recentInvocationsForUser,
} from "@/lib/invocations";
import { InvocationList } from "@/components/dashboard/InvocationList";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";

export const metadata = { title: "Activity" };

export default async function DashboardActivityPage() {
  const session = await getSession();
  const userId = session?.user?.id;

  const [snap, invocations, weekCount] = await Promise.all([
    userId ? getCreditSnapshot() : Promise.resolve(null),
    userId ? recentInvocationsForUser(25) : Promise.resolve([]),
    userId ? countInvocationsThisWeek() : Promise.resolve(0),
  ]);
  // session.user.creditBalance was removed from the JWT in Sprint 18 (H1).
  // Dashboard reads from the live snapshot — falls back to 0 if Mongo is down.
  const balance = snap?.balance ?? 0;

  return (
    <div className="space-y-6">
      <OnboardingTour />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Credit balance"
          value={balance.toLocaleString()}
          hint={
            <Link href="/dashboard/credits" className="text-cyan hover:underline inline-flex items-center gap-1">
              View ledger <ArrowRight className="w-3 h-3" />
            </Link>
          }
          Icon={Coins}
        />
        <StatCard
          label="Invocations this week"
          value={weekCount.toLocaleString()}
          hint={
            <Link href="/browse" className="text-cyan hover:underline inline-flex items-center gap-1">
              Browse agents <ArrowRight className="w-3 h-3" />
            </Link>
          }
          Icon={Activity}
        />
      </div>

      <section>
        <h2 className="text-base font-semibold tracking-tight text-fg mb-3">
          Recent activity
        </h2>
        <InvocationList rows={invocations} />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  Icon,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  Icon: typeof Coins;
}) {
  return (
    <div className="surface-elev p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-fg-subtle">{label}</span>
        <Icon className="w-4 h-4 text-fg-muted" />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-fg font-mono">
        {value}
      </p>
      {hint && <div className="mt-3 text-[12.5px] text-fg-muted">{hint}</div>}
    </div>
  );
}
