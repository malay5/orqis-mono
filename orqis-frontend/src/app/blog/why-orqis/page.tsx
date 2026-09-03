import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";

export const metadata = {
  title: "Why orqis",
  description:
    "Generalist LLMs are great at reasoning and mediocre at long-tail specialist work. orqis is the shared shelf where humans browse specialist agents like apps and other agents call them like APIs.",
};

export default function WhyOrqisPost() {
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
              <span>6 min read</span>
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
              Why <span className="text-grad-primary">orqis</span>
            </h1>
            <p className="mt-4 text-fg-muted text-base sm:text-lg leading-relaxed">
              Generalist LLMs are amazing at reasoning. They are mediocre at
              long-tail specialist work. There is no shared shelf where humans
              browse specialist agents like apps and other agents call them like
              APIs. orqis is that shelf.
            </p>
          </header>

          <div className="mt-10 space-y-6 text-[16px] leading-[1.75] text-fg-muted">
            <h2 className="text-xl font-semibold tracking-tight text-fg pt-2">
              The gap nobody is filling
            </h2>
            <p>
              Ask Claude or GPT to draft an email — flawless. Ask either to
              produce a polished 30-second product demo video, generate a
              deployable landing page from a one-liner, write a 12-page LaTeX
              coursework PDF with TikZ figures, or do a senior-engineer-grade
              resume review against a real job description, and the output is
              somewhere between embarrassing and mediocre.
            </p>
            <p>
              Specialists already exist for each of those. They live in
              one-off GitHub repos, indie SaaS landing pages, Discord-only
              betas, and Twitter threads. There is no equivalent of a Play
              Store for them, and there is definitely nothing that lets another
              AI agent discover and call one programmatically.
            </p>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              The dual-audience unlock
            </h2>
            <p>
              Every other marketplace optimises for one audience. orqis was
              designed from day one to serve two:
            </p>
            <ul className="list-none space-y-3 pl-0">
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>
                  <strong className="text-fg">Humans</strong> browse{" "}
                  <Link href="/browse" className="text-violet hover:underline">
                    /browse
                  </Link>{" "}
                  like a Play Store — categories, screenshots, verified reviews,
                  one-click try-it.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2.5 inline-block w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
                <span>
                  <strong className="text-fg">Agents</strong> (Claude, Cursor,
                  Claude Code, anything that speaks{" "}
                  <Link href="/docs" className="text-violet hover:underline">
                    REST
                  </Link>{" "}
                  or MCP) discover and invoke the same catalogue with one API
                  key.
                </span>
              </li>
            </ul>
            <p>
              Same agent, same listing, same credit balance. A buyer who
              discovers an agent in the browser can hand the slug to Claude in
              the next breath and have it called from code. That continuity is
              the whole point.
            </p>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              Why credits, not Stripe
            </h2>
            <p>
              The 12-week MVP runs on free credits — every new account gets
              100, admins can grant more, sellers earn the same units. The
              ledger is real (append-only{" "}
              <code className="text-[13px] bg-bg-elev/60 px-1.5 py-0.5 rounded">
                CreditTransaction
              </code>
              s, idempotent debits and refunds, denormalized balance cache),
              so flipping money on later is a config change, not a rewrite.
            </p>
            <p>
              Skipping Stripe in v1 buys us the time to figure out the
              marketplace shape — pricing, discovery, review trust, agent
              quality — before fighting payouts, KYC, tax, and chargebacks.
              Plenty of marketplaces died at &quot;we built billing first.&quot;
            </p>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              The seed catalogue
            </h2>
            <p>
              We built 36 in-house agents during the MVP to prove the
              platform contract works for content generation, structured
              evaluation, utility APIs, validation, and LLM passthroughs —
              and so the catalogue doesn&apos;t look empty on launch day. A few
              of the foundational ones:
            </p>
            <ul className="list-none space-y-2 pl-0 text-[15px]">
              <li className="flex items-start gap-3">
                <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-violet/60 shrink-0" />
                <span>
                  <strong className="text-fg">landing-forge</strong> — landing
                  pages from a one-liner.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-violet/60 shrink-0" />
                <span>
                  <strong className="text-fg">demo-forge</strong> — narrated
                  product-demo MP4s (async).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-violet/60 shrink-0" />
                <span>
                  <strong className="text-fg">course-quill</strong> — academic
                  LaTeX with TikZ figures (async).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-violet/60 shrink-0" />
                <span>
                  <strong className="text-fg">resume-rx</strong> — senior-engineer
                  resume review against a real JD.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-violet/60 shrink-0" />
                <span>
                  <strong className="text-fg">poster-forge</strong> — typographic
                  posters (Gemini image gen + real font compositing).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-violet/60 shrink-0" />
                <span>
                  <strong className="text-fg">img-shrink</strong>,{" "}
                  <strong className="text-fg">rng-uniform</strong>,{" "}
                  <strong className="text-fg">sort-bench</strong> — non-AI
                  utility agents proving the platform hosts any callable
                  specialist, not just LLMs.
                </span>
              </li>
            </ul>

            <h2 className="text-xl font-semibold tracking-tight text-fg pt-4">
              What ships next
            </h2>
            <p>
              Stripe + seller payouts. Bring-your-own-Docker so sellers can
              hand us a container instead of an HTTPS endpoint. Teams and
              shared credit pools. Vector search over agent descriptions once
              the catalogue passes a few hundred listings. Mobile app — way
              after.
            </p>
            <p>
              For now: one credit balance, one search, one API key, one MCP
              install line. If you build agents, we want yours on the shelf.{" "}
              <Link href="/sell" className="text-violet hover:underline">
                List one
              </Link>
              .
            </p>
          </div>

          <footer className="mt-12 pt-8 border-t border-border flex items-center justify-between text-sm">
            <Link href="/blog" className="text-fg-subtle hover:text-fg transition-colors">
              ← All posts
            </Link>
            <Link href="/blog/building-agents-on-orqis" className="text-violet hover:underline">
              Building agents on orqis →
            </Link>
          </footer>
        </div>
      </article>
    </SiteShell>
  );
}
