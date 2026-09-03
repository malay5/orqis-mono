"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Code2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Tab = "input" | "output" | "request" | "response";

const TAB_LABEL: Record<Tab, string> = {
  input: "Input schema",
  output: "Output schema",
  request: "Example request",
  response: "Example response",
};

export function SchemaPreview({
  inputSchema,
  outputSchema,
  exampleRequest,
  exampleResponse,
}: {
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  exampleRequest: Record<string, unknown> | null;
  exampleResponse: Record<string, unknown> | null;
}) {
  const tabs = (
    [
      ["input", inputSchema],
      ["output", outputSchema],
      ["request", exampleRequest],
      ["response", exampleResponse],
    ] as const
  ).filter(([, v]) => v != null) as [Tab, Record<string, unknown>][];

  const [tab, setTab] = useState<Tab | null>(tabs[0]?.[0] ?? null);
  const [open, setOpen] = useState(true);

  if (tabs.length === 0) return null;
  const current = tabs.find(([t]) => t === tab)?.[1];

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 group"
        aria-expanded={open}
      >
        <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-fg">
          <Code2 className="w-4 h-4 text-cyan" />
          Schemas &amp; examples
        </h2>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-fg-muted shrink-0 transition-transform duration-300",
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
            <div className="mt-4 surface-elev p-0 overflow-hidden">
              <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 pt-3">
                {tabs.map(([t]) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "px-3 py-2 text-xs rounded-t-md transition-colors",
                      tab === t
                        ? "bg-white/[0.05] text-fg border-b-2 border-violet -mb-px"
                        : "text-fg-muted hover:text-fg"
                    )}
                  >
                    {TAB_LABEL[t]}
                  </button>
                ))}
              </div>
              <pre className="p-5 overflow-x-auto text-[12.5px] leading-6 font-mono text-fg-muted">
{JSON.stringify(current ?? {}, null, 2)}
              </pre>
            </div>
            <p className="mt-3 text-[11px] text-fg-subtle">
              These are descriptive previews. Schema-validated invocation lands
              in Sprint 6 with an interactive &quot;Try it&quot; panel.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
