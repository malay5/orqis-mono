"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

export function GrantCreditsForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [amount, setAmount] = useState("100");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/grant-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), amount: Number(amount), note: note.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        newBalance?: number;
      };
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      setMsg({
        kind: "ok",
        text: `Granted. New balance: ${j.newBalance?.toLocaleString() ?? "?"} credits.`,
      });
      setNote("");
      router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="surface-elev p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-cyan" />
        <h3 className="text-sm font-semibold tracking-tight text-fg">Grant credits</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1.4fr_0.7fr]">
        <div>
          <Label htmlFor="g-email" required>
            User email
          </Label>
          <Input
            id="g-email"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
        <div>
          <Label htmlFor="g-amount" required>
            Amount (negative deducts)
          </Label>
          <Input
            id="g-amount"
            type="number"
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            disabled={submitting}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="g-note">Note (shown in user&apos;s ledger)</Label>
        <Input
          id="g-note"
          type="text"
          placeholder="Founding seller bonus"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={submitting}
        />
      </div>
      {msg && (
        <p
          role={msg.kind === "err" ? "alert" : "status"}
          className={msg.kind === "err" ? "text-sm text-pink" : "text-sm text-cyan"}
        >
          {msg.text}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Granting…
            </>
          ) : (
            "Grant credits"
          )}
        </Button>
      </div>
    </form>
  );
}
