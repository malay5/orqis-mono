"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

/**
 * Global runtime error boundary. Replaces Next's default plain-text fallback
 * with something on-brand. Sentry (when wired) catches the same throw via
 * its global error hook, so this file is purely the UX layer.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Console-log in dev so the stack is visible. Production should route
    // these to Sentry — that wiring is independent and flips on with the
    // SENTRY_DSN env var.
    console.error("[orqis] runtime error:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex">
          <Logo size={32} />
        </Link>
        <span className="mt-10 inline-flex items-center justify-center w-12 h-12 rounded-full bg-pink/15 text-pink">
          <AlertTriangle className="w-6 h-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Something went wrong.
        </h1>
        <p className="mt-3 text-sm text-fg-muted leading-relaxed">
          An unexpected error stopped that page from rendering. Try reloading;
          if it keeps happening, the digest below helps us track it down.
        </p>
        {error.digest && (
          <p className="mt-3 text-[11px] text-fg-subtle font-mono break-all">
            digest · {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button onClick={reset}>
            <RotateCw className="w-4 h-4" />
            Try again
          </Button>
          <Link
            href="/browse"
            className="inline-flex items-center justify-center h-11 px-5 rounded-full font-medium text-fg-muted hover:text-fg transition-colors"
          >
            Browse agents instead →
          </Link>
        </div>
      </div>
    </main>
  );
}
