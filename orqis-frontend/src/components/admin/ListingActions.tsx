"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/cn";

type Status = "pending" | "approved" | "rejected";

export function ListingActions({ id, current }: { id: string; current: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function transition(next: Status) {
    setBusy(next);
    setErr(null);
    try {
      const res = await fetch("/api/admin/agent-listing-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1.5">
        <Btn label="Pending" Icon={Clock} onClick={() => transition("pending")} busy={busy === "pending"} active={current === "pending"} tone="muted" />
        <Btn label="Approve" Icon={Check} onClick={() => transition("approved")} busy={busy === "approved"} active={current === "approved"} tone="cyan" />
        <Btn label="Reject" Icon={X} onClick={() => transition("rejected")} busy={busy === "rejected"} active={current === "rejected"} tone="pink" />
      </div>
      {err && <p className="text-[11px] text-pink">{err}</p>}
    </div>
  );
}

function Btn({
  label,
  Icon,
  onClick,
  busy,
  active,
  tone,
}: {
  label: string;
  Icon: typeof Check;
  onClick: () => void;
  busy: boolean;
  active: boolean;
  tone: "cyan" | "pink" | "muted";
}) {
  const tones: Record<string, string> = {
    cyan: active ? "bg-cyan/20 text-cyan border-cyan/40" : "hover:bg-cyan/10 hover:text-cyan border-[var(--border)]",
    pink: active ? "bg-pink/20 text-pink border-pink/40" : "hover:bg-pink/10 hover:text-pink border-[var(--border)]",
    muted: active ? "bg-white/[0.06] text-fg border-white/25" : "hover:bg-white/[0.04] hover:text-fg border-[var(--border)]",
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] border text-fg-muted transition-colors disabled:opacity-50",
        tones[tone]
      )}
      title={label}
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {label}
    </button>
  );
}
