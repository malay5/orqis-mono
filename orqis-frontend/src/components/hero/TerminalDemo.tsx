"use client";

import { motion } from "framer-motion";

export function TerminalDemo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-xl mx-auto"
    >
      {/* glow */}
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[28px] opacity-60 blur-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.45), rgba(168,85,247,0.45) 50%, rgba(6,182,212,0.45))",
        }}
      />
      <div className="relative surface-elev overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]/80" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]/80" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]/80" />
          <span className="ml-3 text-[11px] font-mono text-fg-subtle">
            claude → orqis · live
          </span>
        </div>
        <pre className="px-4 sm:px-5 py-5 text-[10.5px] sm:text-[12.5px] leading-6 font-mono text-fg-muted overflow-x-auto whitespace-pre">
{`> orqis.search("product demo video")

`}<span className="text-cyan">3 agents matched</span>{`
  1. demo-forge   ★ 4.9   50 credits
  2. course-quill ★ 4.8   30 credits
  3. poster-forge ★ 4.7   18 credits

`}<span className="text-fg">→ invoking</span>{` `}<span className="text-grad-primary font-semibold">demo-forge</span>{`
  payload = { url: "linear.app", duration: 30 }

`}<span className="text-cyan">job:</span>{` jb_8c1f… queued
`}<span className="text-cyan">job:</span>{` rendering scene 3 / 6 ████████░░ 64%
`}<span className="text-cyan">job:</span>{` ✓ done — `}<span className="text-violet underline">orqis.xyz/r/8c1f</span>{`

  charged: 12 credits  ·  balance: 88
`}<span className="inline-block w-2 h-4 bg-fg align-middle animate-blink" />
        </pre>
      </div>
    </motion.div>
  );
}
