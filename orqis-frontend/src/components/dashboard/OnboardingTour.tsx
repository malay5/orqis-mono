"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Compass, KeyRound, X } from "lucide-react";

const STORAGE_KEY = "orqis_tour_v1";

type Step = {
  Icon: typeof Coins;
  title: string;
  body: string;
  cta: { label: string; href: string };
};

const STEPS: Step[] = [
  {
    Icon: Coins,
    title: "You have 100 free credits",
    body: "Every new account is funded with 100 credits. Each agent prices itself in credits — landing-forge is 5, demo-forge is 50. Failed calls are auto-refunded.",
    cta: { label: "View credit history", href: "/dashboard/credits" },
  },
  {
    Icon: Compass,
    title: "Browse the catalogue",
    body: "36 in-house agents are live across AI generation, web utilities, document conversion, validation, and LLM passthroughs. Every detail page has a Try-It panel.",
    cta: { label: "Browse agents", href: "/browse" },
  },
  {
    Icon: KeyRound,
    title: "Call agents from code",
    body: "Mint an API key, then use @orqis/sdk or any HTTP client to invoke agents from your own scripts. Or wire up our MCP server so Claude can call them natively.",
    cta: { label: "Mint an API key", href: "/dashboard/api-keys" },
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!open) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
    setOpen(false);
  };

  const current = STEPS[step];
  const Icon = current.Icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="orqis-tour-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-8"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={dismiss}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-strong)] bg-bg-elev shadow-2xl shadow-violet/10 overflow-hidden">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Skip tour"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-fg-subtle hover:text-fg hover:bg-white/[0.05] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === step
                    ? "w-8 bg-violet"
                    : i < step
                    ? "w-4 bg-violet/40"
                    : "w-4 bg-white/10"
                }`}
              />
            ))}
            <span className="ml-auto text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
              {step + 1} / {STEPS.length}
            </span>
          </div>

          <div className="mt-5 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-violet/15 text-violet">
            <Icon className="w-5 h-5" />
          </div>

          <h2
            id="orqis-tour-title"
            className="mt-4 text-xl font-semibold tracking-tight"
          >
            {current.title}
          </h2>
          <p className="mt-2 text-[15px] text-fg-muted leading-relaxed">
            {current.body}
          </p>

          <Link
            href={current.cta.href}
            onClick={dismiss}
            className="mt-5 inline-flex items-center gap-1 text-sm text-violet hover:underline"
          >
            {current.cta.label} →
          </Link>
        </div>

        <div className="border-t border-[var(--border)] px-6 sm:px-8 py-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="text-sm text-fg-subtle hover:text-fg transition-colors"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-lg px-3 py-1.5 text-sm text-fg-muted hover:text-fg hover:bg-white/[0.05] transition-colors"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-4 py-1.5 text-sm font-medium bg-violet text-white hover:bg-violet/90 transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="rounded-lg px-4 py-1.5 text-sm font-medium bg-violet text-white hover:bg-violet/90 transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
