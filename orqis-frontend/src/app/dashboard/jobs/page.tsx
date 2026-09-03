import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/session";
import { listJobsForUser, type JobRowView } from "@/lib/jobs";
import { JobsTable } from "@/components/dashboard/JobsTable";

export const metadata = { title: "Jobs" };

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const session = await getSession();
  const rows = session?.user?.id
    ? await listJobsForUser(30).catch(() => [] as JobRowView[])
    : [];

  return (
    <div className="space-y-6">
      <div className="surface-elev p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white shrink-0">
            <Clock className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-fg">
              Async jobs
            </h2>
            <p className="mt-1 text-sm text-fg-muted leading-relaxed max-w-xl">
              Long-running invocations land here. Pending jobs auto-poll every 2 seconds;
              webhooks from the seller flip them to succeeded or refunded.
            </p>
          </div>
        </div>
        <Link
          href="/agents/demo-forge"
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium border border-[var(--border-strong)] bg-white/5 hover:bg-white/10 hover:border-white/25 transition-colors whitespace-nowrap"
        >
          Try demo-forge
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <JobsTable initial={rows} />
    </div>
  );
}
