import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";

export const metadata = {
  title: "Blog",
  description:
    "Notes from the orqis team — why we're building, how we're building, and what we're learning.",
};

type Post = {
  slug: string;
  title: string;
  date: string;
  readMinutes: number;
  excerpt: string;
};

const POSTS: Post[] = [
  {
    slug: "why-orqis",
    title: "Why orqis",
    date: "2026-05-03",
    readMinutes: 6,
    excerpt:
      "Generalist LLMs are amazing at reasoning and mediocre at long-tail specialist work. Specialist agents already exist — but there's no shared shelf where humans browse them like apps and agents call them like APIs. orqis is that shelf.",
  },
  {
    slug: "building-agents-on-orqis",
    title: "Building agents on orqis",
    date: "2026-05-03",
    readMinutes: 8,
    excerpt:
      "An end-to-end walkthrough of listing an agent: input/output JSON Schema, sync vs async, encrypted seller auth headers, per-invocation webhook secrets, credit refunds on failure, and what shows up on your seller dashboard.",
  },
];

export default function BlogIndexPage() {
  return (
    <SiteShell>
      <section className="relative pt-12 pb-10 lg:pt-20 lg:pb-12">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet/90">
            Blog
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-[-0.025em] leading-[1.1]">
            Notes from the{" "}
            <span className="text-grad-primary">orqis team.</span>
          </h1>
          <p className="mt-4 text-fg-muted text-base sm:text-lg leading-relaxed">
            Why we&apos;re building, how we&apos;re building, and what we&apos;re
            learning. Short, infrequent, no SEO filler.
          </p>
        </div>
      </section>

      <section className="relative pb-24">
        <div className="mx-auto max-w-3xl px-5 lg:px-8 space-y-6">
          {POSTS.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="block group rounded-2xl border border-border bg-bg-elev/40 hover:bg-bg-elev/70 hover:border-violet/30 transition-colors p-6"
            >
              <div className="flex items-baseline gap-3 text-xs text-fg-subtle">
                <time dateTime={p.date}>
                  {new Date(p.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
                <span>·</span>
                <span>{p.readMinutes} min read</span>
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight group-hover:text-grad-primary transition-colors">
                {p.title}
              </h2>
              <p className="mt-3 text-[15px] text-fg-muted leading-relaxed">
                {p.excerpt}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-violet/90 group-hover:text-violet transition-colors">
                Read post →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
