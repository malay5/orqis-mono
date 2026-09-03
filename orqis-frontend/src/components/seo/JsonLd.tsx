const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://orqis.xyz";

/**
 * Structured data (Sprint 20).
 *
 * Server components that emit JSON-LD. Kept in one place so the `@id` values
 * stay consistent — Google links the graph by those ids, and a typo silently
 * splits one entity into several.
 *
 * `dangerouslySetInnerHTML` is the standard way to emit JSON-LD; the content
 * is our own serialised objects, never user input.
 */

function Script({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * Organization + WebSite for the home page.
 *
 * The WebSite node carries a SearchAction, which is what lets Google show a
 * sitelinks search box for the brand query and, more usefully, tells it
 * /browse?q= is the search surface.
 */
export function SiteJsonLd() {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: "orqis",
            url: SITE_URL,
            logo: `${SITE_URL}/icon`,
            description:
              "A marketplace for specialist AI agents — browsable by humans, callable by agents over a public API.",
          },
          {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            url: SITE_URL,
            name: "orqis",
            publisher: { "@id": `${SITE_URL}/#organization` },
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${SITE_URL}/browse?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          },
        ],
      }}
    />
  );
}

/**
 * Breadcrumbs. Google renders these in place of the raw URL in results, which
 * reads better for a nested path like /agents/email-truth.
 */
export function BreadcrumbJsonLd({
  items,
}: {
  items: Array<{ name: string; path: string }>;
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: `${SITE_URL}${item.path}`,
        })),
      }}
    />
  );
}

/**
 * A catalogue listing, for /browse and category pages. Tells search engines
 * these are collection pages over a known set of items rather than prose.
 */
export function ItemListJsonLd({
  name,
  items,
}: {
  name: string;
  items: Array<{ slug: string; name: string }>;
}) {
  return (
    <Script
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name,
        numberOfItems: items.length,
        itemListElement: items.slice(0, 50).map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/agents/${a.slug}`,
          name: a.name,
        })),
      }}
    />
  );
}
