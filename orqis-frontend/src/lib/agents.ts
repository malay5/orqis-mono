import "server-only";
import { apiFetchSafe } from "@/lib/api-client";
import { SEED_AGENTS, type SeedAgent } from "@/data/seed-agents";

/**
 * Catalogue reads (Sprint 19 — now via the platform API).
 *
 * This module used to open a Mongoose connection and query the `agents`
 * collection directly. It now calls `GET /v1/catalog/*` on orqis-backend. The
 * exported shape is unchanged so every page and component that consumes
 * `AgentView` keeps working untouched.
 *
 * The seed fallback is retained: if the backend is unreachable, browse and
 * agent-detail pages still render from the bundled catalogue rather than
 * showing an error. Those rows carry no `id` and `hasEndpoint: false`, since
 * nothing can actually be invoked while the API is down.
 */

export type AgentView = {
  id?: string; // ObjectId as hex; absent for seed-fallback rows
  slug: string;
  name: string;
  tagline: string;
  description: string;
  longDescription: string;
  category: string;
  tags: string[];
  iconEmoji: string;
  accentHex: string;
  screenshots: string[];
  pricePerCall: number;
  isAsync: boolean;
  hasEndpoint: boolean;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  exampleRequest: Record<string, unknown> | null;
  exampleResponse: Record<string, unknown> | null;
  ratingAverage: number;
  ratingCount: number;
  invocationCount: number;
};

/** Shape returned by GET /v1/catalog/agents. */
type ApiAgent = AgentView & { id: string; hasEndpoint: boolean };

function fromSeed(s: SeedAgent): AgentView {
  return {
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    description: s.description ?? "",
    longDescription: s.longDescription ?? "",
    category: s.category,
    tags: s.tags ?? [],
    iconEmoji: s.iconEmoji ?? "",
    accentHex: s.accentHex ?? "#a855f7",
    screenshots: s.screenshots ?? [],
    pricePerCall: s.pricePerCall,
    isAsync: s.isAsync ?? false,
    // No id and no endpoint: a seed row exists only because the API is
    // unreachable, so nothing here is invocable.
    hasEndpoint: false,
    inputSchema: (s.inputSchema as Record<string, unknown> | null) ?? null,
    outputSchema: (s.outputSchema as Record<string, unknown> | null) ?? null,
    exampleRequest: (s.exampleRequest as Record<string, unknown> | null) ?? null,
    exampleResponse: (s.exampleResponse as Record<string, unknown> | null) ?? null,
    ratingAverage: s.ratingAverage ?? 0,
    ratingCount: s.ratingCount ?? 0,
    invocationCount: s.invocationCount ?? 0,
  };
}

export type AgentQuery = {
  q?: string;
  category?: string;
};

function matchesSeed(s: SeedAgent, query: AgentQuery): boolean {
  if (query.category && query.category !== "All" && s.category !== query.category) return false;
  const term = (query.q ?? "").trim().toLowerCase();
  if (!term) return true;
  return (
    s.name.toLowerCase().includes(term) ||
    s.tagline.toLowerCase().includes(term) ||
    (s.description ?? "").toLowerCase().includes(term) ||
    (s.tags ?? []).some((t) => t.toLowerCase().includes(term))
  );
}

export async function getAgents(query: AgentQuery = {}): Promise<{
  agents: AgentView[];
  usedFallback: boolean;
}> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category && query.category !== "All") params.set("category", query.category);
  const qs = params.toString();

  const data = await apiFetchSafe<{ count: number; agents: ApiAgent[] }>(
    `/v1/catalog/agents${qs ? `?${qs}` : ""}`,
    // The catalogue is public and changes rarely; a short cache keeps browse
    // snappy without risking stale user-specific data (there is none here).
    { revalidate: 30 }
  );

  if (data?.agents?.length) {
    return { agents: data.agents, usedFallback: false };
  }
  return {
    agents: SEED_AGENTS.filter((s) => matchesSeed(s, query)).map(fromSeed),
    usedFallback: true,
  };
}

export async function getAgentBySlug(slug: string): Promise<AgentView | null> {
  const data = await apiFetchSafe<{ agent: ApiAgent }>(
    `/v1/catalog/agents/${encodeURIComponent(slug)}`,
    { revalidate: 30 }
  );
  if (data?.agent) return data.agent;

  const seed = SEED_AGENTS.find((s) => s.slug === slug);
  return seed ? fromSeed(seed) : null;
}

export function getCategoriesFromAgents(agents: AgentView[]): string[] {
  return Array.from(new Set(agents.map((a) => a.category))).sort();
}

export async function getCategoryCounts(): Promise<{ category: string; count: number }[]> {
  const data = await apiFetchSafe<{ categories: { category: string; count: number }[] }>(
    "/v1/catalog/categories",
    { revalidate: 60 }
  );
  if (data?.categories?.length) return data.categories;

  const counts = new Map<string, number>();
  for (const s of SEED_AGENTS) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  return Array.from(counts, ([category, count]) => ({ category, count })).sort(
    (a, b) => b.count - a.count
  );
}
