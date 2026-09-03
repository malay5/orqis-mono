"use client";

import { useState } from "react";
import { Loader2, Sparkles, Check } from "lucide-react";

export function RequestCreditsButton() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    if (busy || done) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/credits/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={send}
        disabled={busy || done}
        className="inline-flex items-center justify-center h-11 px-5 rounded-full font-medium border border-[var(--border-strong)] bg-white/5 text-fg hover:bg-white/10 hover:border-white/25 transition-colors disabled:opacity-60"
      >
        {done ? (
          <>
            <Check className="w-4 h-4 mr-2 text-cyan" />
            Request sent
          </>
        ) : busy ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Requesting…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2 text-cyan" />
            Request more credits
          </>
        )}
      </button>
      {err && <p className="text-[11px] text-pink">{err}</p>}
      {done && (
        <p className="text-[11px] text-fg-subtle">
          We&apos;ll grant credits manually for now and email you back.
        </p>
      )}
    </div>
  );
}
