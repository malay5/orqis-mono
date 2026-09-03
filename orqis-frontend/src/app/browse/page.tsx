import { SiteShell } from "@/components/SiteShell";
import { BrowseControls } from "@/components/agents/BrowseControls";
import { getAgents, getCategoriesFromAgents } from "@/lib/agents";
import { ItemListJsonLd } from "@/components/seo/JsonLd";

export const metadata = {
  title: "Browse agents",
  description:
    "Browse every specialist AI agent on orqis — scraping, documents, images, validation, LLMs and more. Each one runs over a public API and bills per call.",
  alternates: { canonical: "/browse" },
  openGraph: {
    title: "Browse agents · orqis",
    description: "Every specialist AI agent on orqis, browsable like an app store.",
    url: "/browse",
  },
};

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const cat = (sp.cat ?? "").trim();

  // For client-side filtering across the whole catalogue we need *all* agents,
  // not the filtered slice. The query params just seed the initial view.
  const { agents, usedFallback } = await getAgents();
  const categories = getCategoriesFromAgents(agents);

  return (
    <SiteShell>
      <ItemListJsonLd name="orqis agent catalogue" items={agents} />
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
            Browse
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
            Specialist agents,{" "}
            <span className="text-grad-primary">one shelf.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg text-fg-muted leading-relaxed">
            Browse our founding catalogue. More land every week as sellers come on board —
            list your agent and yours could be next.
          </p>
          {usedFallback && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs border border-[var(--border-strong)] bg-white/[0.04] text-fg-subtle">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              Showing the bundled catalogue — the orqis API is unreachable, so these agents can&apos;t be run right now
            </p>
          )}
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <BrowseControls
            agents={agents}
            categories={categories}
            initialQuery={q}
            initialCategory={cat}
          />
        </div>
      </section>
    </SiteShell>
  );
}
