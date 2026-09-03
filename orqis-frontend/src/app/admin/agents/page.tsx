import Link from "next/link";
import { Mail, Globe, ExternalLink } from "lucide-react";
import { listAgentSubmissions } from "@/lib/admin";
import { SubmissionActions } from "@/components/admin/SubmissionActions";

export const metadata = { title: "Admin · agent submissions" };

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const TABS: { value: "new" | "reviewing" | "approved" | "rejected" | "all"; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = (TABS.find((t) => t.value === sp.status)?.value ?? "new") as
    | "new"
    | "reviewing"
    | "approved"
    | "rejected"
    | "all";

  const subs = await listAgentSubmissions(status).catch(
    () => [] as Awaited<ReturnType<typeof listAgentSubmissions>>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] pb-3">
        {TABS.map((t) => {
          const active = t.value === status;
          return (
            <Link
              key={t.value}
              href={`/admin/agents?status=${t.value}`}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm transition-colors border ${
                active
                  ? "bg-white/[0.05] text-fg border-[var(--border-strong)]"
                  : "text-fg-muted hover:text-fg border-transparent"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {subs.length === 0 ? (
        <div className="surface-elev p-10 text-center text-fg-muted text-sm">
          No agent submissions in <span className="text-fg">{status}</span> yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {subs.map((s) => (
            <li key={s.id} className="surface-elev p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-base font-semibold tracking-tight text-fg truncate">
                      {s.agentName}
                    </h3>
                    <StatusBadge status={s.status} />
                    <span className="text-xs text-fg-subtle">
                      {fmt.format(new Date(s.createdAt))}
                    </span>
                  </div>

                  <p className="mt-2 text-[14.5px] text-fg-muted leading-relaxed whitespace-pre-wrap">
                    {s.description}
                  </p>

                  <dl className="mt-4 grid gap-1 text-xs text-fg-muted sm:grid-cols-2">
                    <div className="inline-flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-fg-subtle" />
                      <a href={`mailto:${s.contactEmail}`} className="hover:text-fg">
                        {s.contactEmail}
                      </a>
                      {s.contactName && (
                        <span className="text-fg-subtle">· {s.contactName}</span>
                      )}
                    </div>
                    {s.endpointUrl && (
                      <div className="inline-flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-fg-subtle" />
                        <a
                          href={s.endpointUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-fg hover:underline truncate"
                        >
                          {s.endpointUrl}
                        </a>
                      </div>
                    )}
                    {s.pricingIdea && (
                      <div className="text-fg-subtle">
                        Pricing idea: <span className="text-fg">{s.pricingIdea}</span>
                      </div>
                    )}
                    {s.links && (
                      <div className="inline-flex items-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5 text-fg-subtle" />
                        <span className="truncate">{s.links}</span>
                      </div>
                    )}
                  </dl>
                </div>

                <SubmissionActions id={s.id} current={s.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "new" | "reviewing" | "approved" | "rejected" }) {
  const styles: Record<string, string> = {
    new: "bg-violet/15 text-violet border-violet/30",
    reviewing: "bg-cyan/15 text-cyan border-cyan/30",
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
