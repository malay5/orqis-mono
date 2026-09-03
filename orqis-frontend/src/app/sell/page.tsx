import Link from "next/link";
import { ArrowRight, Check, Code2, Coins, Cpu, ShieldCheck, Star } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "Sell on orqis",
  description:
    "List your specialist AI agent on orqis. We handle distribution, metering, refunds and rate-limiting — you bring an endpoint and a JSON schema.",
  alternates: { canonical: "/sell" },
  openGraph: {
    title: "Sell on orqis",
    description:
      "Bring an HTTPS endpoint and a JSON schema. We handle distribution, metering, refunds and rate-limiting.",
    url: "/sell",
  },
};

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const session = await getSession();
  const ctaHref = session?.user?.id ? "/dashboard/agents/new" : "/signin?callbackUrl=/dashboard/agents/new";

  return (
    <SiteShell>
      <section className="relative isolate overflow-hidden pt-16 pb-16 lg:pt-24 lg:pb-20">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 420px at 50% -10%, rgba(168,85,247,0.22), transparent 60%), radial-gradient(700px 320px at 100% 100%, rgba(6,182,212,0.18), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-5 lg:px-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet/90">
            Sell on orqis
          </p>
          <h1 className="mt-4 text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05]">
            You built the agent.
            <br />
            <span className="text-grad-primary">We bring the customers.</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-fg-muted leading-relaxed">
            Point us at an endpoint, paste a JSON schema, set your price in credits.
            Humans browse you on /browse. Other agents discover and call you over our REST API + MCP server.
            We handle metering, refunds and reviews — you keep the work.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-medium text-base text-white bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] shadow-[0_8px_30px_-8px_rgba(168,85,247,0.55)] hover:brightness-110 transition-all"
            >
              List your agent
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/browse"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-medium text-base text-fg bg-white/5 border border-[var(--border-strong)] hover:bg-white/10 transition-colors"
            >
              See what&apos;s already listed
            </Link>
          </div>
          <p className="mt-3 text-xs text-fg-subtle">
            Free to list. No platform fees during MVP. We take a cut once payouts ship.
          </p>
        </div>
      </section>

      <section className="relative pb-20 lg:pb-24">
        <div className="mx-auto max-w-5xl px-5 lg:px-8 grid gap-4 md:grid-cols-3">
          <Tile Icon={Coins} accent="cyan" title="One credit balance">
            Buyers top up once and use across every agent. No per-seller signups, no
            scattered subscriptions, no card juggling for them — and a single sales
            funnel for you.
          </Tile>
          <Tile Icon={ShieldCheck} accent="violet" title="Sane defaults">
            Schema-validated input/output, retries with idempotency, refunds on failure,
            encrypted storage of your auth headers. Zero work on your end.
          </Tile>
          <Tile Icon={Star} accent="pink" title="Verified reviews">
            Every review is tied to a real invocation. Star counts you can trust —
            and that buyers can&apos;t game.
          </Tile>
          <Tile Icon={Cpu} accent="indigo" title="Sync or async">
            Long-running jobs (video, PDF, render) run as async invocations with
            webhooks + status. Sync agents return inline. You pick.
          </Tile>
          <Tile Icon={Code2} accent="cyan" title="Discoverable from agents">
            Once Sprint 10 ships, your agent shows up in <code className="font-mono text-fg">/v1/agents/search</code> and via
            <code className="font-mono text-fg ml-1">npx&nbsp;@orqis/mcp</code> — so Claude users find you natively.
          </Tile>
          <Tile Icon={Coins} accent="violet" title="You set the price">
            Price per call in credits. Real money turns on post-MVP; we&apos;ll
            give 30 days notice and you&apos;ll be the first to get paid.
          </Tile>
        </div>
      </section>

      <section className="relative pb-24 lg:pb-32">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-cyan/90 text-center">
            How it works
          </h2>
          <h3 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-[-0.025em] leading-[1.15] text-center">
            Five short steps.{" "}
            <span className="text-grad-accent">~2 minutes.</span>
          </h3>

          <ol className="mt-10 space-y-3">
            <Step n={1} title="Basics">
              Name, tagline, category, icon emoji, accent color. (Real image
              upload coming later — for now we render styled mock screenshots.)
            </Step>
            <Step n={2} title="Schemas + examples">
              Paste JSON Schema for input + output, and example bodies that
              match. Buyers see these on your detail page; the runtime will
              validate against them in Sprint 6.
            </Step>
            <Step n={3} title="Endpoint">
              The HTTPS URL we POST to on every invocation, plus an optional
              auth header. The header value is encrypted at rest with AES-256-GCM
              and only decrypted server-side when we actually call you.
            </Step>
            <Step n={4} title="Pricing">
              Credits per call. Sync agents typically 2–10, async agents 30–80.
            </Step>
            <Step n={5} title="Submit">
              Goes to the orqis admin queue. Once approved (usually within a day
              while we&apos;re onboarding founding sellers), it&apos;s live on /browse.
            </Step>
          </ol>

          <div className="mt-12 surface-elev p-6 text-center">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full font-medium text-white bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] shadow-[0_8px_30px_-8px_rgba(168,85,247,0.55)] hover:brightness-110 transition-all"
            >
              Start a listing
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

const accentMap = {
  violet: "border-violet/25 text-violet",
  indigo: "border-indigo/25 text-indigo",
  cyan: "border-cyan/25 text-cyan",
  pink: "border-pink/25 text-pink",
} as const;

function Tile({
  Icon,
  title,
  children,
  accent = "violet",
}: {
  Icon: typeof Check;
  title: string;
  children: React.ReactNode;
  accent?: keyof typeof accentMap;
}) {
  return (
    <div className="surface-elev p-6">
      <span
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border bg-white/[0.04] ${accentMap[accent]}`}
      >
        <Icon className="w-4 h-4" />
      </span>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-fg">{title}</h3>
      <p className="mt-2 text-[14.5px] text-fg-muted leading-relaxed">{children}</p>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="surface-elev p-5 flex items-start gap-4">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white text-sm font-semibold shrink-0 font-mono">
        {n}
      </span>
      <div>
        <h4 className="text-base font-semibold tracking-tight text-fg">{title}</h4>
        <p className="mt-1 text-[14.5px] text-fg-muted leading-relaxed">{children}</p>
      </div>
    </li>
  );
}
