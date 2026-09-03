import { Coins, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { getSession } from "@/lib/session";
import { getCreditSnapshot, type CreditTxView } from "@/lib/credits";
import { BuyCreditsPanel } from "@/components/dashboard/BuyCreditsPanel";
import { USD_PER_CREDIT } from "@/lib/billing-config";

export const metadata = { title: "Credits" };

const REASON_LABEL: Record<CreditTxView["reason"], string> = {
  signup_bonus: "Signup bonus",
  admin_grant: "Admin grant",
  invocation: "Agent invocation",
  refund: "Refund",
  purchase: "Credit purchase",
};

const fmtDate = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function DashboardCreditsPage() {
  const session = await getSession();
  const snap = session?.user?.id ? await getCreditSnapshot() : null;
  const balance = snap?.balance ?? 0;
  const txs = snap?.transactions ?? [];

  return (
    <div className="space-y-6">
      <div className="surface-elev p-7">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-fg-subtle">Current balance</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight font-mono inline-flex items-end gap-2">
              <Coins className="w-8 h-8 text-cyan mb-1.5" />
              {balance.toLocaleString()}
            </p>
            <p className="mt-2 text-sm text-fg-muted">
              All in credits.{" "}
              <span className="text-fg-subtle">
                1 credit = ${USD_PER_CREDIT} · worth $
                {(balance * USD_PER_CREDIT).toLocaleString()}.
              </span>
            </p>
          </div>
          <BuyCreditsPanel />
        </div>
      </div>

      <section>
        <h2 className="text-base font-semibold tracking-tight text-fg mb-4">
          Transaction history
        </h2>

        {txs.length === 0 ? (
          <div className="surface-elev p-8 text-center text-fg-muted text-sm">
            No transactions yet. Your signup bonus row will appear here once your first
            sign-in finishes.
          </div>
        ) : (
          <ul className="surface-elev divide-y divide-[var(--border)] overflow-hidden">
            {txs.map((t) => {
              const positive = t.delta >= 0;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={
                        positive
                          ? "inline-flex items-center justify-center w-8 h-8 rounded-full bg-cyan/15 text-cyan shrink-0"
                          : "inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink/15 text-pink shrink-0"
                      }
                    >
                      {positive ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg truncate">
                        {REASON_LABEL[t.reason]}
                      </p>
                      <p className="text-xs text-fg-subtle">
                        {fmtDate.format(new Date(t.createdAt))}
                        {t.note ? ` · ${t.note}` : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      positive ? "text-fg" : "text-pink"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {t.delta.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
