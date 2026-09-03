import "server-only";

export function categoryToSlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function slugToCategory(slug: string, allCategories: string[]): string | null {
  const target = slug.toLowerCase();
  return allCategories.find((c) => categoryToSlug(c) === target) ?? null;
}
