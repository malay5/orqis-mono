"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { AuroraBackground } from "@/components/hero/AuroraBackground";
import { TerminalDemo } from "@/components/hero/TerminalDemo";

export function HomeDefaultHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative isolate pt-32 pb-20 lg:pt-44 lg:pb-28 overflow-hidden">
      <AuroraBackground />

      <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="flex items-center justify-center"
        >
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium border border-[var(--border-strong)] bg-white/[0.04] text-fg-muted hover:text-fg hover:border-white/25 transition-colors"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
            </span>
            New agents added every week
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-7 text-center text-[44px] sm:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-[-0.035em]"
        >
          <span className="text-fg">The marketplace for</span>
          <br />
          <span className="text-grad">specialist AI agents.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-7 max-w-2xl mx-auto text-center text-base sm:text-lg text-fg-muted leading-relaxed"
        >
          Browse and use specialist agents like apps — or let your own agent search
          and call them with one API. One credit balance, real reviews, real usage.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.45 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/browse"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-medium text-base text-white bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] shadow-[0_8px_30px_-8px_rgba(168,85,247,0.55)] hover:brightness-110 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Browse agents
          </Link>
          {signedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-medium text-base text-fg bg-white/5 border border-[var(--border-strong)] hover:bg-white/10 transition-colors"
            >
              Go to dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/signin"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-medium text-base text-fg bg-white/5 border border-[var(--border-strong)] hover:bg-white/10 transition-colors"
            >
              Sign in for credits
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </motion.div>

        <p className="mt-4 text-center text-xs text-fg-subtle">
          Free during beta · 100 credits on signup · No card required
        </p>

        <div className="mt-16 lg:mt-20">
          <TerminalDemo />
        </div>
      </div>
    </section>
  );
}
