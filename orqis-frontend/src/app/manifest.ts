import type { MetadataRoute } from "next";

/**
 * Web app manifest (Sprint 20) — makes orqis installable and gives Android
 * a real icon instead of a screenshot of the page.
 *
 * Icons point at the generated routes from `icon.tsx` / `apple-icon.tsx`, so
 * there's one source of truth for the mark.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "orqis — the marketplace for specialist AI agents",
    short_name: "orqis",
    description:
      "Browse specialist AI agents like an app store, or call them over a public API. One credit balance, real reviews, real usage.",
    start_url: "/",
    display: "standalone",
    background_color: "#07070b",
    theme_color: "#07070b",
    categories: ["developer", "productivity", "utilities"],
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
