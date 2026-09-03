"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { AgentCard } from "./AgentCard";
import { cn } from "@/lib/cn";
import type { AgentView } from "@/lib/agents";

const ALL = "All";

export function BrowseControls({
  agents,
  categories,
  initialQuery = "",
  initialCategory = "",
}: {
  agents: AgentView[];
  categories: string[];
  initialQuery?: string;
  initialCategory?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string>(
    initialCategory && categories.includes(initialCategory) ? initialCategory : ALL
  );

  // Reflect filters in the URL so the view is shareable + back-button-safe.
  // Debounced to avoid spamming history on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params?.toString() ?? "");
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      if (category !== ALL) next.set("cat", category);
      else next.delete("cat");
      const qs = next.toString();
      router.replace(qs ? `/browse?${qs}` : "/browse", { scroll: false });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (category !== ALL && a.category !== category) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [agents, query, category]);

  const cats = [ALL, ...categories];

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents — try 'video', 'landing page', 'latex'…"
            className="w-full rounded-full bg-white/5 border border-[var(--border)] pl-11 pr-4 py-3 text-fg placeholder:text-fg-subtle focus:border-violet/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet/25"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm border transition-colors",
                category === c
                  ? "bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white border-transparent"
                  : "bg-white/[0.03] border-[var(--border)] text-fg-muted hover:text-fg hover:border-white/25"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-sm text-fg-subtle">
        Showing <span className="text-fg font-medium">{filtered.length}</span> of {agents.length} agents
      </p>

      {filtered.length === 0 ? (
        <div className="mt-12 surface-elev p-10 text-center text-fg-muted">
          No agents match those filters yet. Try clearing the search or picking a different category.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AgentCard key={a.slug} agent={a} />
          ))}
        </div>
      )}
    </div>
  );
}
