import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";
import { AgentCard } from "@/components/agents/AgentCard";
import { getAgents, getCategoriesFromAgents } from "@/lib/agents";
import { slugToCategory, categoryToSlug } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const all = await getAgents();
  const cats = getCategoriesFromAgents(all.agents);
  const category = slugToCategory(slug, cats);
  if (!category) {
    return { title: "Category not found", robots: { index: false, follow: false } };
  }
  const description = `Every ${category.toLowerCase()} agent on orqis — browse, compare and call them over a public API.`;
  return {
    title: `${category} agents`,
    description,
    alternates: { canonical: `/categories/${categoryToSlug(category)}` },
    openGraph: { title: `${category} agents · orqis`, description, url: `/categories/${categoryToSlug(category)}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const all = await getAgents();
  const allCats = getCategoriesFromAgents(all.agents);
  const category = slugToCategory(slug, allCats);
  if (!category) notFound();

  const filtered = await getAgents({ category });

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
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All categories
          </Link>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-violet/90">
            Category
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
            <span className="text-grad-primary">{category}</span> agents
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-fg-muted leading-relaxed">
            <span className="font-mono text-fg">{filtered.agents.length}</span>{" "}
            agent{filtered.agents.length === 1 ? "" : "s"} in this category.
          </p>
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          {filtered.agents.length === 0 ? (
            <div className="surface-elev p-10 text-center text-fg-muted">
              Nothing here yet — be the first to{" "}
              <Link href="/" className="text-fg underline underline-offset-4">
                list an agent
              </Link>{" "}
              in this category.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.agents.map((a) => (
                <AgentCard key={a.slug} agent={a} />
              ))}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
