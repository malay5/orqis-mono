import { SiteShell } from "@/components/SiteShell";

export const metadata = {
  title: "Changelog",
  description:
    "What's new in orqis. Versioned release notes from the 12-week MVP build.",
};

type Release = {
  version: string;
  date: string;
  highlights: string[];
  details?: string[];
};

// Hand-curated, additive log. Every meaningful release gets one entry; we
// don't aim for git-log granularity. Newest first.
const RELEASES: Release[] = [
  {
    version: "v0.11",
    date: "Sprint 11 · MCP server + /docs + seller analytics",
    highlights: [
      "@orqis/mcp — drop-in MCP server so Claude / Cursor / Claude Code can natively search and invoke orqis agents.",
      "Public API reference at /docs (Scalar-rendered OpenAPI 3.1).",
      "Per-agent seller analytics: 30-day stacked-bar chart + 8 KPIs + recent invocations + reviews.",
    ],
    details: [
      "MCP smoke test (8/8) wires server↔client via in-memory transport with a stubbed SDK — no Claude needed in CI.",
      "OpenAPI spec is hand-written for now; auto-gen from route handlers is post-MVP.",
      "Analytics aggregation runs as one round trip per shape (status counts, daily buckets, latency samples, recent invocations, recent reviews) and is owner-or-admin-gated.",
    ],
  },
  {
    version: "v0.10",
    date: "Sprint 10 · poster-forge + public REST + JS SDK + API keys",
    highlights: [
      "poster-forge — second image-generating in-house agent (mock mode renders a real SVG-composited PNG; Gemini real mode stubbed).",
      "Public REST API at /api/v1/* with API-key auth. /agents (search), /agents/:slug, /agents/:slug/invoke, /jobs/:id, /me.",
      "Full API key minting UI on /dashboard/api-keys: scoped (read / invoke), per-key rate limit, plaintext shown exactly once.",
      "@orqis/sdk shipped — search() / get() / invoke() / checkJob() / invokeAndWait() / me(). 9/9 stubbed-fetch smoke test.",
    ],
  },
  {
    version: "v0.9",
    date: "Sprint 9 · resume-rx + course-quill + utility agents",
    highlights: [
      "resume-rx (sync) — senior-engineer-grade resume reviewer with the most detailed input schema in the catalogue.",
      "course-quill (async) — academic LaTeX coursework with TikZ vector diagrams. (No AI image gen — wrong tool for academic figures.)",
      "rng-uniform + sort-bench — non-AI utility agents proving orqis hosts any callable specialist, not just LLMs.",
    ],
  },
  {
    version: "v0.8",
    date: "Sprint 8 · async runtime + demo-forge",
    highlights: [
      "End-to-end async invocation pipeline: charge → seller acks 202 → background work → webhook → polling UI.",
      "Per-invocation webhook secret (SHA-256-hashed at rest, no shared env-var secret).",
      "demo-forge — flagship product-demo video agent (mock mode delivers a placeholder MP4 after 8s).",
      "/dashboard/jobs page with live polling; auto-refund on every failure path.",
    ],
  },
  {
    version: "v0.7",
    date: "Sprint 7 · landing-forge + img-shrink",
    highlights: [
      "landing-forge — first real in-house agent. claude-sonnet-4-6 + prompt caching + structured Zod output.",
      "img-shrink — utility API for compressing + converting images via sharp. SSRF-guarded URL inputs.",
      "TryItPanel iframe / image preview surface (any agent that returns previewUrl renders inline).",
    ],
  },
  {
    version: "v0.6",
    date: "Sprint 6 · invocation proxy + metering",
    highlights: [
      "Real per-call credit metering: charge → invoke seller → refund on failure (Ajv-validated I/O, 30s sync timeout).",
      "In-memory rate limiter (per-key when SDK, per-user when browser).",
      "Reviews flip to verifiedUse after a successful invocation.",
    ],
  },
  {
    version: "v0.5",
    date: "Sprint 5 · seller listing flow + /admin",
    highlights: [
      "/dashboard/agents/new — multi-step form. AES-256-GCM-encrypted seller auth headers at rest.",
      "Seller submissions land in /admin/listings for review (separate from public-form intake).",
      "/sell marketing page.",
    ],
  },
  {
    version: "v0.4",
    date: "Sprint 4 · credit ledger + admin console",
    highlights: [
      "Idempotent grantCredits / chargeCredits / refundInvocation helpers; User.creditBalance is a recomputed cache.",
      "/admin gated by ADMIN_EMAILS env allowlist. Grant credits, approve / reject submissions.",
    ],
  },
  {
    version: "v0.3",
    date: "Sprint 3 · agent detail polish + reviews + categories + dashboard",
    highlights: [
      "Full agent detail page: long description, screenshots, schema preview, reviews.",
      "Verified reviews tied to real invocations.",
      "/categories pages, /dashboard shell with sticky sidebar.",
    ],
  },
  {
    version: "v0.2",
    date: "Sprint 2 · auth + DB + browse",
    highlights: [
      "MongoDB + Mongoose models (User, Agent, Review, Invocation, ApiKey, …).",
      "NextAuth v5 with Google OAuth + JWT sessions. 100-credit signup bonus written to the ledger.",
      "/browse + /agents/:slug skeletons; submissions writing to both Sheets and Mongo.",
    ],
  },
  {
    version: "v0.1",
    date: "Sprint 1 · launch landing page",
    highlights: [
      "orqis.xyz live — animated aurora hero, terminal demo, audience-toggle, bento, FAQ, dual CTAs.",
      "Waitlist + List-your-agent forms backed by a Google Apps Script Web App writing into Google Sheets.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <SiteShell>
      <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-12">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet/90">
            Changelog
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
            What we&apos;ve been{" "}
            <span className="text-grad-primary">shipping.</span>
          </h1>
          <p className="mt-4 text-fg-muted text-base sm:text-lg leading-relaxed">
            One entry per release. orqis is a 12-week MVP build; we cut a tagged
            release at the end of every sprint.
          </p>
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto max-w-3xl px-5 lg:px-8 space-y-10">
          {RELEASES.map((r) => (
            <article key={r.version}>
              <header className="flex items-baseline gap-3 flex-wrap">
                <h2 className="text-xl font-semibold tracking-tight font-mono text-grad-primary">
                  {r.version}
                </h2>
                <span className="text-sm text-fg-subtle">— {r.date}</span>
              </header>
              <ul className="mt-4 space-y-2 text-[15px] text-fg-muted leading-relaxed">
                {r.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              {r.details && r.details.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-fg-subtle hover:text-fg cursor-pointer transition-colors">
                    Details
                  </summary>
                  <ul className="mt-2 ml-4 space-y-1.5 text-[13px] text-fg-subtle leading-relaxed">
                    {r.details.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-fg-subtle">·</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
