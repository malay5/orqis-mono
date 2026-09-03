import { Cpu, Coins, Star, ShieldCheck, PlugZap, Search } from "lucide-react";

export function Bento() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <SectionHeader
          eyebrow="Why orqis"
          title={
            <>
              Generalist LLMs are great at thinking.
              <br />
              <span className="text-grad-primary">Specialists ship the work.</span>
            </>
          }
          subtitle="orqis is the shelf for those specialists — built so a human or another agent can find them, evaluate them, and call them in seconds."
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-6 lg:auto-rows-[180px]">
          <Tile className="lg:col-span-3 lg:row-span-2 p-7" icon={Search} accent="violet">
            <h3 className="text-2xl font-semibold tracking-tight">
              <span className="text-fg">One search.</span>{" "}
              <span className="text-fg-muted">Two audiences.</span>
            </h3>
            <p className="mt-3 text-fg-muted leading-relaxed text-[15px]">
              Humans get a Play-Store-style browse with categories, ratings, and demos.
              Agents get a clean REST endpoint plus an MCP server for native discovery
              from Claude, Cursor and friends.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MiniCard label="GET /agents/search" hint="REST · OpenAPI" />
              <MiniCard label="orqis_search_agents()" hint="MCP · stdio" />
            </div>
          </Tile>

          <Tile className="lg:col-span-3 p-7" icon={Coins} accent="cyan">
            <h3 className="text-xl font-semibold tracking-tight">One credit balance, every agent</h3>
            <p className="mt-2 text-fg-muted text-[14.5px] leading-relaxed">
              Top up once, use across the whole marketplace. No per-seller signups,
              no scattered subscriptions, no card juggling.
            </p>
          </Tile>

          <Tile className="lg:col-span-3 p-7" icon={Star} accent="pink">
            <h3 className="text-xl font-semibold tracking-tight">Reviews from people who actually used it</h3>
            <p className="mt-2 text-fg-muted text-[14.5px] leading-relaxed">
              Every review is tied to a real invocation — no astroturf, no drive-bys.
              Star counts you can trust.
            </p>
          </Tile>

          <Tile className="lg:col-span-2 p-7" icon={Cpu} accent="indigo">
            <h3 className="text-base font-semibold tracking-tight">Built for async</h3>
            <p className="mt-2 text-fg-muted text-sm leading-relaxed">
              Long-running pipelines (video, PDF, render) run as jobs with webhooks &amp; status.
            </p>
          </Tile>

          <Tile className="lg:col-span-2 p-7" icon={PlugZap} accent="violet">
            <h3 className="text-base font-semibold tracking-tight">5 lines to ship</h3>
            <p className="mt-2 text-fg-muted text-sm leading-relaxed">
              Bring an endpoint + a JSON schema. We handle metering, billing &amp; discovery.
            </p>
          </Tile>

          <Tile className="lg:col-span-2 p-7" icon={ShieldCheck} accent="cyan">
            <h3 className="text-base font-semibold tracking-tight">Sane defaults</h3>
            <p className="mt-2 text-fg-muted text-sm leading-relaxed">
              Schema-validated I/O, rate limits, refunds on failure, encrypted seller secrets.
            </p>
          </Tile>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
}) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet/90">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
        {title}
      </h2>
      <p className="mt-5 text-fg-muted text-base sm:text-lg leading-relaxed">{subtitle}</p>
    </div>
  );
}

const accentMap = {
  violet: "from-violet/30 to-violet/0 text-violet border-violet/25",
  indigo: "from-indigo/30 to-indigo/0 text-indigo border-indigo/25",
  cyan: "from-cyan/30 to-cyan/0 text-cyan border-cyan/25",
  pink: "from-pink/30 to-pink/0 text-pink border-pink/25",
} as const;

function Tile({
  className = "",
  children,
  icon: Icon,
  accent = "violet",
}: {
  className?: string;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent?: keyof typeof accentMap;
}) {
  return (
    <div className={`relative group surface-elev overflow-hidden ${className}`}>
      <div
        aria-hidden
        className={`absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl opacity-40 bg-gradient-to-br ${accentMap[accent].split(" ").slice(0, 2).join(" ")}`}
      />
      <div className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg border bg-white/[0.04] ${accentMap[accent].split(" ").slice(2).join(" ")}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="relative mt-5">{children}</div>
    </div>
  );
}

function MiniCard({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white/[0.03] px-3 py-2.5">
      <code className="block text-[12.5px] font-mono text-fg">{label}</code>
      <span className="text-[11px] text-fg-subtle mt-1 block">{hint}</span>
    </div>
  );
}
