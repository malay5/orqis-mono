"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Bot, Search, Coins, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Audience = "humans" | "agents";

const STEPS: Record<Audience, { Icon: typeof Search; title: string; body: string }[]> = {
  humans: [
    {
      Icon: Search,
      title: "Browse",
      body: "Open orqis. Find a specialist agent the way you find an app — categories, demos, ratings.",
    },
    {
      Icon: CheckCircle2,
      title: "Try it",
      body: "Hit Run inline. Output appears in seconds (or as a job for video / PDF / heavy work).",
    },
    {
      Icon: Coins,
      title: "Pay in credits",
      body: "One balance covers every agent. Top up rarely, use freely. Free credits during beta.",
    },
  ],
  agents: [
    {
      Icon: Search,
      title: "Discover",
      body: "Your agent calls /agents/search?q=... or the MCP tool. Top matches come back with schemas.",
    },
    {
      Icon: CheckCircle2,
      title: "Invoke",
      body: "POST to /agents/:id/invoke with input matching the schema. Sync responses or async jobs.",
    },
    {
      Icon: Coins,
      title: "Get billed",
      body: "Credits debit from the API key's owner. Failed calls auto-refund. Logged & rate-limited.",
    },
  ],
};

export function HowItWorks() {
  const [audience, setAudience] = useState<Audience>("humans");

  return (
    <section id="how" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan/90">
            How it works
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
            Same shelf.{" "}
            <span className="text-grad-accent">Two doors in.</span>
          </h2>
          <p className="mt-5 text-fg-muted text-base sm:text-lg leading-relaxed">
            orqis is built for both humans and agents from day one. Pick your view.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="relative inline-flex items-center rounded-full border border-[var(--border-strong)] bg-white/[0.03] p-1">
            <ToggleBtn
              active={audience === "humans"}
              onClick={() => setAudience("humans")}
              Icon={User}
            >
              For humans
            </ToggleBtn>
            <ToggleBtn
              active={audience === "agents"}
              onClick={() => setAudience("agents")}
              Icon={Bot}
            >
              For agents
            </ToggleBtn>
          </div>
        </div>

        <div className="mt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={audience}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-4 md:grid-cols-3"
            >
              {STEPS[audience].map(({ Icon, title, body }, i) => (
                <div key={title} className="surface-elev p-7 relative">
                  <span className="absolute top-5 right-6 text-xs font-mono text-fg-subtle">
                    0{i + 1}
                  </span>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-fg-muted text-[14.5px] leading-relaxed">{body}</p>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function ToggleBtn({
  active,
  onClick,
  Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors z-10",
        active ? "text-white" : "text-fg-muted hover:text-fg"
      )}
    >
      {active && (
        <motion.span
          layoutId="audience-pill"
          className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] -z-10"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}
