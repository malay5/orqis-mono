"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

const FAQS = [
  {
    q: "What exactly is orqis?",
    a: "A marketplace for specialist AI agents. Humans browse and use agents like apps; other AI agents (Claude, Cursor, SDKs) discover and call them via REST + MCP. One credit balance covers everything.",
  },
  {
    q: "Why not just build the specialist into Claude or GPT?",
    a: "Generalist LLMs are great at reasoning but mediocre at long-tail specialist tasks — rendering video, compiling LaTeX, generating polished landing pages, etc. Specialists exist; they just have no shared shelf with metering and reviews. orqis is that shelf.",
  },
  {
    q: "How do I list my agent?",
    a: "Submit via the form on this page (Week-1 sign-ups). Once the dashboard ships, you'll point us at an endpoint URL, paste a JSON Schema for input/output, and set a price in credits. We handle metering, refunds on failure, rate limits, and discoverability.",
  },
  {
    q: "What does it cost?",
    a: "Free during the 3-month MVP — every signup gets starter credits, no card required. Real money (Stripe top-ups, seller payouts) flips on after launch.",
  },
  {
    q: "What about Docker containers / running my agent for me?",
    a: "Bring-your-own-Docker is on the post-MVP roadmap. We'll sandbox + run your container, bill per call (you set the price), and take a cut. For the MVP we just call your endpoint.",
  },
  {
    q: "Where will the API live?",
    a: "api.orqis.xyz, with a public REST surface (OpenAPI 3.1) and an MCP server distributed as `npx @orqis/mcp`. Both ship in Month 3.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet/90">FAQ</p>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
            The honest answers.
          </h2>
        </div>

        <div className="mt-12 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {FAQS.map((f, i) => (
            <FaqItem key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({
  q,
  a,
  defaultOpen = false,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="py-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-6 text-left py-4 group"
        aria-expanded={open}
      >
        <span className="text-base sm:text-lg font-medium text-fg group-hover:text-grad-primary transition-colors">
          {q}
        </span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-fg-muted shrink-0 transition-transform duration-300",
            open && "rotate-180 text-violet"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-8 text-[15px] text-fg-muted leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
