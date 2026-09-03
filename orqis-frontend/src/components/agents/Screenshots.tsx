"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Stand-in for real screenshots (we don't have uploads yet). Each "shot" is a
 * gradient tile with the agent's accent + a caption. Cycles through with a
 * tab strip. Once sellers can upload PNGs (Sprint 5) this swaps to real <img>s.
 */
export function Screenshots({
  captions,
  accentHex,
  iconEmoji,
}: {
  captions: string[];
  accentHex: string;
  iconEmoji: string;
}) {
  const [active, setActive] = useState(0);
  if (captions.length === 0) return null;
  const current = captions[Math.min(active, captions.length - 1)];

  return (
    <div>
      <div className="surface-elev overflow-hidden p-0 aspect-[16/9] relative">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 80% at 30% 0%, ${accentHex}55, transparent 60%), radial-gradient(120% 80% at 100% 100%, ${accentHex}33, transparent 60%), #0d0d14`,
          }}
        />
        <div className="grid-bg absolute inset-0 opacity-50" />
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8"
          >
            <span className="text-7xl drop-shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
              {iconEmoji || "✨"}
            </span>
            <p className="text-fg-muted text-sm uppercase tracking-[0.18em] text-center">
              {current}
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-subtle">
          <ImageIcon className="w-3 h-3" />
          mock screenshot
        </div>
      </div>

      {captions.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {captions.map((c, i) => (
            <button
              key={`${c}-${i}`}
              onClick={() => setActive(i)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs border transition-colors",
                active === i
                  ? "border-violet/60 bg-violet/15 text-fg"
                  : "border-[var(--border)] bg-white/[0.03] text-fg-muted hover:text-fg"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
