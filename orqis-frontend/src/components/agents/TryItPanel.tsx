"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import {
  CheckCircle2,
  Clock,
  Coins,
  Loader2,
  Play,
  Terminal,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCreditBalance } from "@/lib/use-credit-balance";

type RunResult =
  | {
      kind: "success";
      latencyMs: number;
      creditsCharged: number;
      newBalance: number | null;
      result: unknown;
      schemaWarning: string | null;
    }
  | {
      kind: "pending";
      invocationId: string;
      creditsCharged: number;
      acceptedAt: number; // performance.now() at the moment the seller acked
    }
  | { kind: "error"; httpStatus: number; message: string };

export function TryItPanel({
  slug,
  pricePerCall,
  isAsync,
  exampleRequest,
  hasEndpoint,
}: {
  slug: string;
  pricePerCall: number;
  isAsync: boolean;
  exampleRequest: Record<string, unknown> | null;
  hasEndpoint: boolean;
}) {
  const router = useRouter();
  const { user, status: authStatus } = useSession();
  const { balance, setBalance } = useCreditBalance(!!user);

  const initial = useMemo(
    () =>
      exampleRequest && typeof exampleRequest === "object"
        ? JSON.stringify(exampleRequest, null, 2)
        : "{}",
    [exampleRequest]
  );

  const [text, setText] = useState(initial);
  const [parseError, setParseError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => {
    setText(initial);
  }, [initial]);

  function validate(value: string): string | null {
    if (!value.trim()) return "Body is empty.";
    try {
      const v = JSON.parse(value) as unknown;
      if (typeof v !== "object" || v === null || Array.isArray(v)) {
        return "Body must be a JSON object.";
      }
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid JSON";
    }
  }

  async function run() {
    const err = validate(text);
    if (err) {
      setParseError(err);
      return;
    }
    setParseError(null);
    setResult(null);
    setRunning(true);
    try {
      const res = await fetch(`/api/agents/${slug}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setResult({
          kind: "error",
          httpStatus: res.status,
          message: typeof j.error === "string" ? j.error : `Failed (${res.status})`,
        });
      } else if (j.status === "pending" && typeof j.invocationId === "string") {
        // Async — webhook will land later. Switch to pending + poll.
        // The seller ack already debited credits; update the shared balance.
        const charged = Number(j.creditsCharged ?? 0);
        if (charged > 0 && balance !== null) setBalance(balance - charged);
        setResult({
          kind: "pending",
          invocationId: j.invocationId,
          creditsCharged: charged,
          acceptedAt: performance.now(),
        });
      } else {
        const nextBalance = Number(j.newBalance ?? 0);
        setBalance(nextBalance);
        setResult({
          kind: "success",
          latencyMs: Number(j.latencyMs ?? 0),
          creditsCharged: Number(j.creditsCharged ?? 0),
          newBalance: nextBalance,
          result: j.result,
          schemaWarning: typeof j.schemaWarning === "string" ? j.schemaWarning : null,
        });
        // Refresh server components so the agent's invocationCount + your own
        // recent invocations show up. Credit balance now flows via the hook.
        router.refresh();
      }
    } catch (e) {
      setResult({
        kind: "error",
        httpStatus: 0,
        message: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      setRunning(false);
    }
  }

  // Poll /api/jobs/<id> while result is in pending state.
  // Sprint 18 (M4 fix): hard timeout after MAX_POLL_ATTEMPTS so a stuck job
  // doesn't leave the UI spinning forever. Server-side the job remains in
  // whatever state it's actually in — the timeout is a UI-only fallback that
  // surfaces it as an error so the user knows to check /dashboard/jobs.
  useEffect(() => {
    if (!result || result.kind !== "pending") return;
    const id = result.invocationId;
    const POLL_INTERVAL_MS = 2000;
    const MAX_POLL_MS = 5 * 60_000; // 5 minutes — covers demo-forge / course-quill worst case
    const startedAt = Date.now();
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt > MAX_POLL_MS) {
        cancelled = true;
        setResult({
          kind: "error",
          httpStatus: 0,
          message:
            "Stopped polling after 5 minutes — the job may still complete. Check /dashboard/jobs for status.",
        });
        return;
      }
      try {
        const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        if (j.status === "succeeded") {
          setResult({
            kind: "success",
            latencyMs: typeof j.latencyMs === "number" ? j.latencyMs : 0,
            creditsCharged: Number(j.creditsCharged ?? 0),
            newBalance: null,
            result: j.result ?? null,
            schemaWarning: null,
          });
          router.refresh();
        } else if (j.status === "refunded" || j.status === "failed") {
          setResult({
            kind: "error",
            httpStatus: 0,
            message:
              typeof j.errorMessage === "string" && j.errorMessage
                ? `${j.errorMessage}${j.status === "refunded" ? " You were refunded." : ""}`
                : "Async job failed.",
          });
          router.refresh();
        }
      } catch {
        // Swallow transient network errors and keep polling (subject to MAX_POLL_MS).
      }
    };
    void tick(); // first poll fires immediately so the user sees motion
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.kind === "pending" ? result.invocationId : null]);

  // ---- Auth + capability gates ----
  // No loading skeleton: the session is seeded from the server in the root
  // layout, so `authStatus` is correct on first paint.
  if (authStatus !== "authenticated") {
    return (
      <div className="surface-elev p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan" />
            <h3 className="text-base font-semibold tracking-tight">Try this agent</h3>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            Sign in to invoke this agent. New accounts get 100 credits.
          </p>
        </div>
        <Link
          href={`/signin?callbackUrl=/agents/${slug}`}
          className="inline-flex items-center justify-center h-11 px-5 rounded-full font-medium text-white bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] whitespace-nowrap"
        >
          Sign in to run
        </Link>
      </div>
    );
  }

  if (!hasEndpoint) {
    return (
      <div className="surface-elev p-6">
        <div className="flex items-center gap-2 mb-2">
          <Terminal className="w-4 h-4 text-cyan" />
          <h3 className="text-base font-semibold tracking-tight">Try this agent</h3>
        </div>
        <p className="text-sm text-fg-muted">
          This agent doesn&apos;t have a runnable endpoint configured yet. Browse{" "}
          <Link href="/browse" className="text-violet hover:text-fg transition-colors">
            other agents
          </Link>{" "}
          while we get this one wired up.
        </p>
      </div>
    );
  }

  // Live balance — useCreditBalance fetches /api/v1/me and updates on every
  // successful invoke. Replaces the stale-JWT read that used to live here.
  const cantAfford = balance !== null && balance < pricePerCall;

  return (
    <div className="surface-elev p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan" />
          <h3 className="text-base font-semibold tracking-tight">Try this agent</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
          <Coins className="w-3.5 h-3.5 text-cyan" />
          <span className="font-mono text-fg">{pricePerCall}</span> credits / call
          {balance !== null && (
            <span className="text-fg-subtle">
              · balance <span className="font-mono text-fg">{balance}</span>
            </span>
          )}
        </span>
      </div>

      <div>
        <label
          htmlFor="tryit-body"
          className="block text-xs uppercase tracking-[0.14em] text-fg-subtle mb-1.5"
        >
          Request body (JSON)
        </label>
        <textarea
          id="tryit-body"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setParseError(null);
          }}
          onBlur={() => setParseError(validate(text))}
          spellCheck={false}
          rows={10}
          className={`w-full rounded-xl bg-bg/40 border px-4 py-3 font-mono text-[12.5px] leading-relaxed text-fg placeholder:text-fg-subtle focus:bg-white/[0.04] focus:ring-2 focus:ring-violet/25 ${
            parseError ? "border-pink/60 focus:border-pink/80" : "border-[var(--border)] focus:border-violet/60"
          }`}
        />
        {parseError && <p className="mt-1 text-xs text-pink">{parseError}</p>}
      </div>

      {cantAfford && (
        <p className="text-xs text-pink inline-flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          You need {pricePerCall - (balance ?? 0)} more credits.
          <Link
            href="/dashboard/credits"
            className="ml-1 text-violet hover:text-fg transition-colors"
          >
            Request more →
          </Link>
        </p>
      )}

      <div className="flex items-center justify-end">
        <Button onClick={run} disabled={running || !!parseError || cantAfford}>
          {running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run agent ({pricePerCall} credits)
            </>
          )}
        </Button>
      </div>

      {result && <ResultPanel result={result} />}
    </div>
  );
}

function ResultPanel({ result }: { result: RunResult }) {
  if (result.kind === "error") {
    return (
      <div className="rounded-xl border border-pink/40 bg-pink/5 p-4">
        <div className="flex items-center gap-2 text-sm text-pink font-medium">
          <AlertTriangle className="w-4 h-4" />
          Failed{result.httpStatus ? ` (HTTP ${result.httpStatus})` : ""}
        </div>
        <p className="mt-2 text-sm text-fg-muted">{result.message}</p>
      </div>
    );
  }
  if (result.kind === "pending") {
    return <PendingPanel result={result} />;
  }
  const pretty = JSON.stringify(result.result, null, 2);
  return (
    <div className="rounded-xl border border-cyan/40 bg-cyan/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
        <span className="inline-flex items-center gap-1.5 text-cyan font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Succeeded
        </span>
        <span className="inline-flex items-center gap-3 font-mono text-fg-muted">
          <span>{result.latencyMs}ms</span>
          <span>charged {result.creditsCharged}</span>
          {result.newBalance !== null && <span>balance {result.newBalance}</span>}
        </span>
      </div>
      {result.schemaWarning && (
        <p className="text-xs text-pink inline-flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {result.schemaWarning}
        </p>
      )}

      <PreviewIfAny result={result.result} />

      <details>
        <summary className="cursor-pointer text-xs text-fg-muted hover:text-fg">
          Raw JSON response
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-bg/40 border border-[var(--border)] p-3 text-[12px] font-mono text-fg-muted whitespace-pre-wrap break-all">
          {pretty}
        </pre>
      </details>
    </div>
  );
}

/**
 * Generic preview surface: if the agent's response includes a `previewUrl`,
 * render it inline so the user can see the output without leaving the page.
 *
 *  - Image URLs (.webp/.avif/.jpg/.jpeg/.png/.gif/.svg) render as <img> on a
 *    checkerboard background so transparency is visible.
 *  - Everything else renders in a sandboxed iframe.
 *
 * Used today by landing-forge (HTML) and img-shrink (images); any future
 * agent that returns a `previewUrl` field gets this for free.
 */
function PreviewIfAny({ result }: { result: unknown }) {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return null;
  }
  const obj = result as Record<string, unknown>;
  const previewUrl = typeof obj.previewUrl === "string" ? obj.previewUrl : null;
  const downloadUrl =
    (typeof obj.htmlDownloadUrl === "string" && obj.htmlDownloadUrl) ||
    (typeof obj.downloadUrl === "string" && obj.downloadUrl) ||
    previewUrl;
  if (!previewUrl) return null;

  const isImage = /\.(webp|avif|jpe?g|png|gif|svg)(\?|$)/i.test(previewUrl);
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(previewUrl);

  return (
    <div className="rounded-md overflow-hidden border border-[var(--border)] bg-bg/40">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2 text-[11px] font-mono text-fg-subtle">
        <span className="truncate">preview · {previewUrl}</span>
        <div className="flex items-center gap-3 shrink-0">
          {downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="hover:text-fg transition-colors"
            >
              ↓ download
            </a>
          )}
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-fg transition-colors"
          >
            ↗ open
          </a>
        </div>
      </div>
      {isImage ? (
        <div
          className="flex items-center justify-center w-full max-h-[480px] overflow-auto"
          // Subtle checkerboard so PNG/WebP transparency is visible.
          style={{
            backgroundImage:
              "linear-gradient(45deg, #1a1a24 25%, transparent 25%), linear-gradient(-45deg, #1a1a24 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a24 75%), linear-gradient(-45deg, transparent 75%, #1a1a24 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
            backgroundColor: "#0d0d14",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Agent preview"
            loading="lazy"
            className="max-w-full max-h-[480px] object-contain"
          />
        </div>
      ) : isVideo ? (
        <video
          src={previewUrl}
          controls
          preload="metadata"
          className="w-full max-h-[480px] bg-black"
        />
      ) : (
        <iframe
          src={previewUrl}
          title="Agent preview"
          sandbox="allow-scripts"
          loading="lazy"
          className="w-full h-[480px] bg-white"
        />
      )}
    </div>
  );
}

/**
 * Pending-async card. Shows elapsed time + a hint that we're polling. The
 * outer TryItPanel useEffect updates `result` when the poll detects success
 * or failure, at which point this component unmounts in favor of the
 * success / error panel.
 */
function PendingPanel({
  result,
}: {
  result: { invocationId: string; creditsCharged: number; acceptedAt: number };
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - result.acceptedAt));
    }, 200);
    return () => clearInterval(id);
  }, [result.acceptedAt]);

  const seconds = (elapsedMs / 1000).toFixed(1);
  return (
    <div className="rounded-xl border border-violet/40 bg-violet/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
        <span className="inline-flex items-center gap-2 text-violet font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          Job pending
        </span>
        <span className="inline-flex items-center gap-3 font-mono text-fg-muted">
          <span>{seconds}s elapsed</span>
          <span>charged {result.creditsCharged}</span>
          <span className="text-fg-subtle">polling every 2s</span>
        </span>
      </div>
      <p className="text-[12.5px] text-fg-muted leading-relaxed">
        The seller acknowledged your job and is processing it in the background.
        We&apos;ll show the result here as soon as the webhook lands. If the job
        fails, your credits are refunded automatically.
      </p>
      <p className="text-[11px] text-fg-subtle font-mono">
        invocation: {result.invocationId}
      </p>
    </div>
  );
}
