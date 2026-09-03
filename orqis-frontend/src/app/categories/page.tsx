import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";
import { getCategoryCounts } from "@/lib/agents";
import { categoryToSlug } from "@/lib/categories";

export const metadata = {
  title: "Categories",
  description:
    "Browse orqis agents by category — LLMs, web scraping, documents, images, audio, validation and utilities.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "Agent categories · orqis",
    description: "Find the right specialist agent by category.",
    url: "/categories",
  },
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const cats = await getCategoryCounts();

  return (
    <SiteShell>
      <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-12 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(700px 320px at 50% -10%, rgba(168,85,247,0.18), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet/90">
            Categories
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
            Pick a shelf to{" "}
            <span className="text-grad-primary">browse.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-fg-muted leading-relaxed">
            Each category aggregates founding and seller-listed agents. Empty
            categories show up here too — they&apos;re a hint of what we&apos;d
            love to see listed.
          </p>
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          {cats.length === 0 ? (
            <div className="surface-elev p-10 text-center text-fg-muted">
              No categories yet. Check back once agents are seeded.
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cats.map(({ category, count }) => (
                <li key={category}>
                  <Link
                    href={`/categories/${categoryToSlug(category)}`}
                    className="group block surface-elev p-6 transition-all hover:border-white/25 hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold tracking-tight text-fg group-hover:text-grad-primary">
                        {category}
                      </h3>
                      <ArrowRight className="w-4 h-4 text-fg-muted group-hover:text-violet transition-colors" />
                    </div>
                    <p className="mt-2 text-sm text-fg-muted">
                      <span className="font-mono text-fg">{count}</span> agent{count === 1 ? "" : "s"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
