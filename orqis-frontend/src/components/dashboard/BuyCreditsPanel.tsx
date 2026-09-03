"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { CREDIT_PACKS, type CreditPack } from "@/lib/billing-config";

/**
 * Credit checkout (Sprint 19).
 *
 * ⚠️ HACKATHON: no payment is taken. "Make payment" posts straight to
 * /api/credits/checkout, which grants the credits and writes a ledger row.
 * The simulated-payment notice below is deliberately prominent — anyone
 * demoing this should be able to see at a glance that no money moved.
 */
export function BuyCreditsPanel() {
  const router = useRouter();
  const [selected, setSelected] = useState<CreditPack>(
    CREDIT_PACKS.find((p) => p.popular) ?? CREDIT_PACKS[0]
  );
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: selected.id }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        creditsAdded?: number;
      };
      if (!res.ok) throw new Error(body.error || `Payment failed (${res.status}).`);
      setAdded(body.creditsAdded ?? selected.credits);
      // Pull the server components (balance + ledger) back in sync.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full sm:max-w-xs flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-3 py-2.5">
        <TriangleAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-fg-muted leading-relaxed">
          <span className="text-fg font-medium">Demo checkout.</span> No card, no
          charge — credits are added instantly so you can try the catalogue.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Credit pack"
        className="grid grid-cols-3 gap-2"
      >
        {CREDIT_PACKS.map((pack) => {
          const active = pack.id === selected.id;
          return (
            <button
              key={pack.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(pack)}
              disabled={busy}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-center transition-colors disabled:opacity-60",
                active
                  ? "border-violet/60 bg-violet/10"
                  : "border-[var(--border)] bg-white/[0.03] hover:bg-white/[0.06]"
              )}
            >
              <span className="block font-mono text-base font-semibold text-fg">
                {pack.credits}
              </span>
              <span className="block text-[11px] text-fg-subtle">${pack.usd}</span>
            </button>
          );
        })}
      </div>

      <Button onClick={pay} disabled={busy} size="md" className="w-full">
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Make payment — ${selected.usd}
          </>
        )}
      </Button>

      {added !== null && (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-cyan">
          <Check className="w-3.5 h-3.5" />
          {added} credits added. No payment was taken.
        </p>
      )}
      {error && <p className="text-[11px] text-pink">{error}</p>}
    </div>
  );
}
