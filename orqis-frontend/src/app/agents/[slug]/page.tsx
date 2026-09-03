import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Zap, Clock, Coins } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";
import { RatingStars } from "@/components/agents/RatingStars";
import { Screenshots } from "@/components/agents/Screenshots";
import { SchemaPreview } from "@/components/agents/SchemaPreview";
import { ReviewForm } from "@/components/agents/ReviewForm";
import { ReviewList } from "@/components/agents/ReviewList";
import { TryItPanel } from "@/components/agents/TryItPanel";
import { getAgentBySlug } from "@/lib/agents";
import { getReviewsForAgent, getMyReviewForAgent } from "@/lib/reviews";
import { getSession } from "@/lib/session";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { truncate } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);
  if (!agent) {
    // Don't let a 404 accumulate index entries for slugs that don't exist.
    return { title: "Agent not found", robots: { index: false, follow: false } };
  }

  // Prefer the longer copy — a tagline alone is usually under 60 characters,
  // which Google pads with page furniture. Trim on a word boundary: a
  // hard slice ends mid-word, and that's what shows in the result.
  const description = truncate(agent.description || agent.tagline, 155);

  return {
    title: agent.name,
    description,
    alternates: { canonical: `/agents/${agent.slug}` },
    openGraph: {
      type: "website",
      // Just the name. Social cards clip around 60-70 characters, and several
      // taglines here run past 90 on their own.
      title: `${agent.name} · orqis`,
      description,
      url: `/agents/${agent.slug}`,
      // Image comes from the sibling opengraph-image.tsx, which renders this
      // agent's emoji, accent and price.
    },
    twitter: {
      card: "summary_large_image",
      title: `${agent.name} · orqis`,
      description,
    },
    keywords: [agent.name, agent.category, ...(agent.tags ?? [])].slice(0, 12),
  };
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);
  if (!agent) notFound();

  const session = await getSession();
  const userId = session?.user?.id;

  // Reviews + my-review (if signed in) — only meaningful when we have a real DB id.
  const [reviews, myReview] = await Promise.all([
    getReviewsForAgent(agent.slug),
    userId ? getMyReviewForAgent(agent.slug) : Promise.resolve(null),
  ]);

  const paragraphs = (agent.longDescription || agent.description || "").split(/\n\s*\n/);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://orqis.xyz";
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: agent.name,
    description: agent.tagline,
    applicationCategory: agent.category,
    url: `${siteUrl}/agents/${agent.slug}`,
    operatingSystem: "Cloud",
    offers: {
      "@type": "Offer",
      price: agent.pricePerCall,
      priceCurrency: "ORQ",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: agent.pricePerCall,
        priceCurrency: "ORQ",
        unitText: "invocation",
      },
    },
  };
  if (agent.ratingCount > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: agent.ratingAverage.toFixed(2),
      reviewCount: agent.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Agents", path: "/browse" },
          { name: agent.category, path: `/categories/${slugify(agent.category)}` },
          { name: agent.name, path: `/agents/${agent.slug}` },
        ]}
      />
      <article className="relative isolate pt-10 pb-24 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -top-20 pointer-events-none opacity-50"
          style={{
            background: `radial-gradient(700px 320px at 50% 0%, ${agent.accentHex}30, transparent 60%)`,
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All agents
          </Link>

          <header className="mt-8 grid gap-8 md:grid-cols-[auto_1fr_auto] md:items-start">
            <span
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl text-5xl border"
              style={{
                background: `${agent.accentHex}1f`,
                borderColor: `${agent.accentHex}40`,
              }}
            >
              {agent.iconEmoji || "✨"}
            </span>

            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-fg-subtle">
                <Link
                  href={`/categories/${slugify(agent.category)}`}
                  className="hover:text-fg transition-colors"
                >
                  {agent.category}
                </Link>{" "}
                {agent.isAsync ? "· async" : "· sync"}
              </p>
              <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.05]">
                {agent.name}
              </h1>
              <p className="mt-3 text-base sm:text-lg text-fg-muted leading-relaxed">
                {agent.tagline}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fg-muted">
                <span className="inline-flex items-center gap-2">
                  <RatingStars value={agent.ratingAverage} size={14} />
                  <span className="font-medium text-fg">{agent.ratingAverage.toFixed(1)}</span>
                  <span className="text-fg-subtle">({agent.ratingCount} reviews)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  {agent.isAsync ? (
                    <Clock className="w-4 h-4 text-cyan" />
                  ) : (
                    <Zap className="w-4 h-4 text-cyan" />
                  )}
                  <span className="text-fg-subtle">
                    {agent.invocationCount.toLocaleString()} invocations
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-cyan" />
                  <span className="font-mono text-fg">{agent.pricePerCall}</span>
                  <span className="text-fg-subtle">credits / call</span>
                </span>
              </div>

              {agent.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {agent.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full border border-[var(--border)] bg-white/[0.03] px-2.5 py-1 text-[11px] text-fg-muted"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden md:flex md:flex-col md:items-end md:gap-1 md:text-right">
              <span className="text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
                Run it
              </span>
              <span className="text-xs text-fg-muted">Try it panel ↓</span>
            </div>
          </header>

          <section className="mt-12">
            <Screenshots
              captions={agent.screenshots.length > 0 ? agent.screenshots : ["Preview"]}
              accentHex={agent.accentHex}
              iconEmoji={agent.iconEmoji}
            />
          </section>

          <section className="mt-10">
            <TryItPanel
              slug={slug}
              pricePerCall={agent.pricePerCall}
              isAsync={agent.isAsync}
              exampleRequest={agent.exampleRequest}
              hasEndpoint={agent.hasEndpoint}
            />
          </section>

          <section className="mt-14 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-12">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-fg">About</h2>
                <div className="mt-3 space-y-3 text-[15px] text-fg-muted leading-relaxed">
                  {paragraphs.length > 0 ? (
                    paragraphs.map((p, i) => <p key={i}>{p}</p>)
                  ) : (
                    <p>(Description coming soon.)</p>
                  )}
                </div>
              </div>

              <SchemaPreview
                inputSchema={agent.inputSchema}
                outputSchema={agent.outputSchema}
                exampleRequest={agent.exampleRequest}
                exampleResponse={agent.exampleResponse}
              />

              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="text-base font-semibold tracking-tight text-fg">
                    Reviews{" "}
                    <span className="text-fg-subtle font-normal">
                      ({agent.ratingCount})
                    </span>
                  </h2>
                </div>

                <ReviewList reviews={reviews} />

                <div className="mt-5">
                  <ReviewForm
                    slug={slug}
                    initial={
                      myReview
                        ? { rating: myReview.rating, title: myReview.title, body: myReview.body }
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-20 self-start">
              <div className="surface-elev p-6">
                <h3 className="text-sm font-semibold tracking-tight text-fg">At a glance</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <Row label="Pricing" value={`${agent.pricePerCall} credits / call`} />
                  <Row label="Mode" value={agent.isAsync ? "Async (job-based)" : "Sync"} />
                  <Row
                    label="Category"
                    value={
                      <Link
                        href={`/categories/${slugify(agent.category)}`}
                        className="hover:text-fg transition-colors"
                      >
                        {agent.category}
                      </Link>
                    }
                  />
                  <Row
                    label="Slug"
                    value={<span className="font-mono text-fg">{agent.slug}</span>}
                  />
                </dl>
              </div>

              <div className="surface-elev p-6">
                <h3 className="text-sm font-semibold tracking-tight text-fg">For agent clients</h3>
                <p className="mt-2 text-[13px] text-fg-muted leading-relaxed">
                  Once Sprint 10 ships, your code can call this agent with:
                </p>
                <pre className="mt-3 rounded-md bg-bg/40 border border-[var(--border)] p-3 text-[11.5px] font-mono text-fg-muted overflow-x-auto leading-5">
{`await orqis.invoke(
  "${agent.slug}",
  { /* see input schema */ }
);`}
                </pre>
              </div>
            </aside>
          </section>
        </div>
      </article>
    </SiteShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="text-right text-fg-muted">{value}</dd>
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
