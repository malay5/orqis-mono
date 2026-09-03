/**
 * Small SEO helpers (Sprint 20).
 */

/** Site origin. Kept in one place so metadataBase, sitemap and robots agree. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://orqis.xyz";

/**
 * Trim to `max` characters on a word boundary.
 *
 * A plain `.slice(max)` ends mid-word, and that fragment is exactly what
 * Google prints in the result snippet. Falls back to a hard slice if there's
 * no space to break on (a single very long token).
 */
export function truncate(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}
