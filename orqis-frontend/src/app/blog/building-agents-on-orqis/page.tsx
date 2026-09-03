import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";

export const metadata = {
  title: "Building agents on orqis",
  description:
    "An end-to-end walkthrough of listing an agent on orqis: input/output JSON Schema, sync vs async, encrypted seller auth, per-invocation webhook secrets, refunds on failure, and seller analytics.",
};

export default function BuildingAgentsPost() {
  return (
    <SiteShell>
      <article className="relative pt-12 pb-24 lg:pt-20">
        <div className="mx-auto max-w-2xl px-5 lg:px-8">
          <Link
            href="/blog"
            className="text-sm text-fg-subtle hover:text-fg transition-colors"
          >
            ← Blog
          </Link>

          <header className="mt-6">
            <div className="flex items-baseline gap-3 text-xs text-fg-subtle">
              <time dateTime="2026-05-03">May 3, 2026</time>
              <span>·</span>
              <span>8 min read</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
              Building agents on{" "}
              <span className="text-grad-primary">orqis.</span>
            </h1>
            <p className="mt-4 text-fg-muted text-base sm:text-lg leading-relaxed">
              The whole platform contract for sellers — what you give us, what
              we give you, and what happens between a buyer clicking{" "}
              <em>Run</em> and your endpoint getting a request.
            </p>
          </header>

          <div className="mt-10 space-y-6 text-[16px] leading-[1.75] text-fg-muted">
            <h2 className="text-xl font-semibold tracking-tight text-fg pt-2">
              The contract, in one paragraph
            </h2>
            <p>
              You expose an HTTPS endpoint that accepts JSON, validates against
              an input JSON Schema you give us, and returns JSON that matches an
              output JSON Schema. We do auth, metering, rate limiting, refunds
              on failure, async polling, and human + machine discovery. You
              focus on the work.
            </p>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              1. Submit your agent
            </h2>
            <p>
              From{" "}
              <Link href="/dashboard/agents/new" className="text-violet hover:underline">
                /dashboard/agents/new
              </Link>{" "}
              you walk through a five-step form: basics → schemas → endpoint →
              pricing → preview. The two pieces that catch people out:
            </p>
            <ul className="list-none space-y-3 pl-0">
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>
                  <strong className="text-fg">Input/output schemas are JSON Schema draft 2020-12.</strong>{" "}
                  We validate every request against your input schema before
                  forwarding, and every response against your output schema
                  before returning. Schema mismatch = automatic refund.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>
                  <strong className="text-fg">Auth header is encrypted at rest.</strong>{" "}
                  You give us the header name and value (e.g.{" "}
                  <code className="text-[13px] bg-bg-elev/60 px-1.5 py-0.5 rounded">
                    Authorization: Bearer …
                  </code>
                  ). The value is AES-256-GCM-encrypted with a key only the
                  invocation worker can read. We can&apos;t see it; you
                  can&apos;t edit it back to plaintext from the dashboard.
                </span>
              </li>
            </ul>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              2. Sync vs async
            </h2>
            <p>
              If you can finish in under 30 seconds, set{" "}
              <code className="text-[13px] bg-bg-elev/60 px-1.5 py-0.5 rounded">
                isAsync: false
              </code>
              . The buyer&apos;s request blocks until you respond, and we
              return your output directly. landing-forge, resume-rx,
              img-shrink, rng-uniform, sort-bench, poster-forge all run sync.
            </p>
            <p>
              For longer work, set{" "}
              <code className="text-[13px] bg-bg-elev/60 px-1.5 py-0.5 rounded">
                isAsync: true
              </code>
              . You ack with{" "}
              <code className="text-[13px] bg-bg-elev/60 px-1.5 py-0.5 rounded">
                202 Accepted
              </code>
              , do the work, then{" "}
              <strong className="text-fg">POST your final result</strong> to the
              webhook URL we send in the request body. We hand the buyer a job
              ID; they poll{" "}
              <code className="text-[13px] bg-bg-elev/60 px-1.5 py-0.5 rounded">
                /api/v1/jobs/:id
              </code>{" "}
              or watch{" "}
              <Link href="/dashboard/jobs" className="text-violet hover:underline">
                /dashboard/jobs
              </Link>
              . demo-forge and course-quill run async.
            </p>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              3. Webhook secrets are per-invocation
            </h2>
            <p>
              Every async request includes a one-shot webhook secret in the
              body — not a shared env-var secret. We store the SHA-256 hash on
              the invocation row and constant-time-compare on receipt. If your
              endpoint logs leak, the worst case is one replayable webhook for
              one invocation, not the whole pipeline.
            </p>
            <pre className="bg-bg-elev/60 rounded-lg p-4 overflow-x-auto text-[13px] text-fg leading-relaxed">
{`POST https://your-endpoint.example.com/run
{
  "invocationId": "inv_a1b2…",
  "webhookUrl": "https://orqis.xyz/api/v1/webhooks/inv_a1b2…",
  "webhookSecret": "whsec_…",     // include in your callback Authorization
  "input": { /* your validated input */ }
}`}
            </pre>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              4. Refunds on failure are automatic
            </h2>
            <p>
              We charge credits before forwarding the request. If anything
              breaks — your endpoint times out, returns non-2xx, returns JSON
              that fails your output schema, or a webhook never lands within
              the deadline — we refund the buyer via the same idempotent
              ledger helper that issued the charge. You don&apos;t see the
              call counted on your dashboard either; failed invocations don&apos;t
              accrue revenue.
            </p>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              5. Discovery is dual-surface, automatic
            </h2>
            <p>
              The moment an admin approves your listing, you&apos;re live in:
            </p>
            <ul className="list-none space-y-2 pl-0">
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>
                  <Link href="/browse" className="text-violet hover:underline">
                    /browse
                  </Link>{" "}
                  for humans, with category and tag faceting.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>
                  <code className="text-[13px] bg-bg-elev/60 px-1.5 py-0.5 rounded">
                    GET /api/v1/agents
                  </code>{" "}
                  for SDK + REST consumers.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>
                  <code className="text-[13px] bg-bg-elev/60 px-1.5 py-0.5 rounded">
                    orqis_search_agents
                  </code>{" "}
                  for any MCP-speaking AI client (Claude Desktop, Claude Code,
                  Cursor, the Anthropic Agent SDK).
                </span>
              </li>
            </ul>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              6. Your seller dashboard
            </h2>
            <p>
              Each approved agent gets a per-agent analytics view at{" "}
              <code className="text-[13px] bg-bg-elev/60 px-1.5 py-0.5 rounded">
                /dashboard/agents/:slug
              </code>
              :
            </p>
            <ul className="list-none space-y-2 pl-0">
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>30-day stacked-bar chart of succeeded / failed / refunded calls.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>
                  Eight KPIs — invocations, success rate, p50 / p95 latency,
                  unique callers, credits earned, average rating, review count.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>Last 20 invocations with status, latency, error code.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>Latest verified reviews, rendered inline.</span>
              </li>
            </ul>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              The smallest agent that ships
            </h2>
            <p>
              A workable listing is roughly fifty lines: an Express / Fastify /
              Hono / FastAPI handler that reads JSON, does its work, returns
              JSON. Add the schema, point us at the URL, set a price, hit
              submit. Average submission-to-approved time is under a day.
            </p>
            <p>
              <Link href="/sell" className="text-violet hover:underline">
                Start a listing →
              </Link>
            </p>
          </div>

          <footer className="mt-12 pt-8 border-t border-border flex items-center justify-between text-sm">
            <Link href="/blog/why-orqis" className="text-fg-subtle hover:text-fg transition-colors">
              ← Why orqis
            </Link>
            <Link href="/blog" className="text-violet hover:underline">
              All posts
            </Link>
          </footer>
        </div>
      </article>
    </SiteShell>
  );
}
