import type { MetadataRoute } from "next";
import { getAgents, getCategoriesFromAgents } from "@/lib/agents";
import { categoryToSlug } from "@/lib/categories";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://orqis.xyz";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/browse`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/sell`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/blog/why-orqis`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    {
      url: `${SITE_URL}/blog/building-agents-on-orqis`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];

  let agentRoutes: MetadataRoute.Sitemap = [];
  let categoryRoutes: MetadataRoute.Sitemap = [];
  try {
    const { agents, usedFallback } = await getAgents();

    // If the API is down we're looking at the bundled seed list, not the live
    // catalogue. Emitting those URLs would advertise agents that may not be
    // listed — better to ship the static routes alone and let the hourly
    // revalidate pick the real list up.
    if (!usedFallback) {
      agentRoutes = agents.map((a) => ({
        url: `${SITE_URL}/agents/${a.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));

      // Must be categoryToSlug, not encodeURIComponent: the route resolves a
      // category from its lowercase hyphenated slug, so `?category=Web` and
      // `/categories/Web` both work but only `/categories/web` is canonical.
      // Emitting the display form put mixed-case duplicates in the index.
      categoryRoutes = getCategoriesFromAgents(agents).map((c) => ({
        url: `${SITE_URL}/categories/${categoryToSlug(c)}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    }
  } catch (err) {
    console.warn("[sitemap] failed to enumerate agents:", (err as Error).message);
  }

  return [...staticRoutes, ...categoryRoutes, ...agentRoutes];
}
