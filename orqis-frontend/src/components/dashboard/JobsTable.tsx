"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowDownLeft,
  ExternalLink,
} from "lucide-react";
import type { JobRowView } from "@/lib/jobs";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 5 * 60_000; // mirror TryItPanel — 5 minutes then give up

/**
 * Sprint 18 (F2 fix): the previous polling effect had `[rows]` as its dep, but
 * the effect ALSO called `setRows` on every successful tick — even when no
 * statuses had changed, `.map()` returns a fresh array and breaks referential
 * equality, so React re-ran the effect, cleared the interval, and immediately
 * spawned a new one. Per-pending-job polling rate measured: ~once per 200ms
 * instead of the intended 2s. Compounding with multiple pending rows = real
 * billing / load impact.
 *
 * Fix: useRef-tracked rows so the polling loop reads the current value via a
 * ref, the effect deps are `[]` (mount once), and the interval clears itself
 * when no rows remain pending or the 5-min ceiling fires.
 */
export function JobsTable({ initial }: { initial: JobRowView[] }) {
  const [rows, setRows] = useState(initial);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  useEffect(() => {
    const startedAt = Date.now();
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (Date.now() - startedAt > MAX_POLL_MS) {
        stopped = true;
        return;
      }
      const pendingIds = rowsRef.current
        .filter((r) => r.status === "pending")
        .map((r) => r.id);
      if (pendingIds.length === 0) {
        stopped = true;
        return;
      }

      const updates = await Promise.all(
        pendingIds.map(async (id) => {
          try {
            const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
            if (!res.ok) return null;
            return (await res.json()) as Record<string, unknown>;
          } catch {
            return null;
          }
        })
      );
      if (stopped) return;

      setRows((prev) =>
        prev.map((r) => {
          const u = updates.find((x) => x && x.invocationId === r.id);
          if (!u || u.status === r.status) return r;
          const result = u.result as Record<string, unknown> | null;
          return {
            ...r,
            status: u.status as JobRowView["status"],
            latencyMs: typeof u.latencyMs === "number" ? u.latencyMs : r.latencyMs,
            errorCode: typeof u.errorCode === "string" ? u.errorCode : r.errorCode,
            errorMessage:
              typeof u.errorMessage === "string" ? u.errorMessage : r.errorMessage,
            completedAt:
              typeof u.completedAt === "string" ? u.completedAt : r.completedAt,
            previewUrl:
              (typeof result?.previewUrl === "string" ? (result.previewUrl as string) : undefined) ??
              r.previewUrl,
            downloadUrl:
              (typeof result?.downloadUrl === "string"
                ? (result.downloadUrl as string)
                : undefined) ??
              (typeof result?.htmlDownloadUrl === "string"
                ? (result.htmlDownloadUrl as string)
                : undefined) ??
              r.downloadUrl,
          };
        })
      );
    };

    // Fire once immediately so the user sees motion, then on the interval.
    void tick();
    const handle = setInterval(() => {
      if (stopped) {
        clearInterval(handle);
        return;
      }
      void tick();
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(handle);
    };
  }, []);

  if (rows.length === 0) {
    return (
      <div className="surface-elev p-8 text-center text-fg-muted text-sm">
        No async jobs yet. Try the{" "}
        <Link
          href="/agents/demo-forge"
          className="text-violet hover:text-fg transition-colors"
        >
          demo-forge agent
        </Link>{" "}
        for a smoke test.
      </div>
    );
  }

  return (
    <ul className="surface-elev divide-y divide-[var(--border)] overflow-hidden">
      {rows.map((r) => (
        <li key={r.id} className="px-5 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <StatusIcon status={r.status} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">
                  {r.agentEmoji && <span className="mr-1.5">{r.agentEmoji}</span>}
                  {r.agentSlug ? (
                    <Link href={`/agents/${r.agentSlug}`} className="hover:text-grad-primary">
                      {r.agentName ?? r.agentSlug}
                    </Link>
                  ) : (
                    <span className="text-fg-muted">deleted agent</span>
                  )}
                  <StatusBadge status={r.status} />
                  {r.errorCode && r.status !== "succeeded" && (
                    <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider border border-pink/30 bg-pink/10 text-pink">
                      {r.errorCode}
                    </span>
                  )}
                </p>
                <p className="text-xs text-fg-subtle">
                  started {fmt.format(new Date(r.createdAt))}
                  {r.latencyMs != null && (
                    <span className="ml-2 font-mono">{Math.round(r.latencyMs)}ms</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs">
              {r.previewUrl && r.status === "succeeded" && (
                <a
                  href={r.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-violet hover:text-fg transition-colors"
                >
                  open <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <span className="font-mono tabular-nums text-fg">-{r.creditsCharged}</span>
            </div>
          </div>
          {r.status !== "succeeded" && r.errorMessage && (
            <p className="mt-2 ml-11 text-[12.5px] text-pink/80 leading-relaxed">
              {r.errorMessage}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function StatusIcon({ status }: { status: JobRowView["status"] }) {
  if (status === "succeeded") {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-cyan/15 text-cyan shrink-0">
        <CheckCircle2 className="w-4 h-4" />
      </span>
    );
  }
  if (status === "refunded") {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-violet/15 text-violet shrink-0">
        <ArrowDownLeft className="w-4 h-4" />
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-violet/15 text-violet shrink-0 animate-pulse">
        <Clock className="w-4 h-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink/15 text-pink shrink-0">
      <AlertTriangle className="w-4 h-4" />
    </span>
  );
}

function StatusBadge({ status }: { status: JobRowView["status"] }) {
  const styles: Record<string, string> = {
    pending: "bg-violet/15 text-violet border-violet/30",
    succeeded: "bg-green/15 text-green border-green/30",
    failed: "bg-pink/15 text-pink border-pink/30",
    refunded: "bg-pink/15 text-pink border-pink/30",
  };
  return (
    <span
      className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider border ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}
