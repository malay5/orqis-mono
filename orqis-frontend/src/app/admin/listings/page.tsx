import Link from "next/link";
import { Coins, Star, ArrowUpRight } from "lucide-react";
import { listPendingListings } from "@/lib/seller-agents";
import { ListingActions } from "@/components/admin/ListingActions";

export const metadata = { title: "Admin · seller listings" };

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminListingsPage() {
  const rows = await listPendingListings().catch(() => []);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold tracking-tight text-fg">
          Seller listings
        </h2>
        <p className="mt-1 text-sm text-fg-muted leading-relaxed max-w-xl">
          Authenticated sellers who submitted via{" "}
          <code className="font-mono text-fg">/dashboard/agents/new</code>.
          Approving flips the agent to <span className="text-green">approved</span>{" "}
          and it appears on /browse. (Anonymous seller enquiries live on the
          adjacent{" "}
          <Link href="/admin/agents" className="text-violet hover:text-fg transition-colors">
            agent submissions
          </Link>{" "}
          tab.)
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="surface-elev p-10 text-center text-fg-muted text-sm">
          No pending or rejected seller listings.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((a) => (
            <li key={a.id} className="surface-elev p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
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

                  <dl className="mt-3 grid gap-1 text-xs text-fg-muted sm:grid-cols-2">
                    <div>
                      Slug: <code className="font-mono text-fg">/agents/{a.slug}</code>
                    </div>
                    <div>
                      Category:{" "}
                      <span className="text-fg">{a.category}</span>{" "}
                      <span className="text-fg-subtle">
                        · {a.isAsync ? "async" : "sync"}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-cyan" />
                      <span className="font-mono text-fg">{a.pricePerCall}</span> credits / call
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-violet" />
                      {a.ratingAverage.toFixed(1)}{" "}
                      <span className="text-fg-subtle">
                        ({a.ratingCount} reviews · {a.invocationCount.toLocaleString()} runs)
                      </span>
                    </div>
                  </dl>

                  <Link
                    href={`/agents/${a.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-violet hover:text-fg transition-colors"
                  >
                    Open public detail page
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>

                <ListingActions id={a.id} current={a.status as "pending" | "approved" | "rejected"} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
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
