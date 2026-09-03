"use client";

import {
  Video,
  Globe,
  FileText,
  Mic,
  Image as ImageIcon,
  Code2,
  Sparkles,
  PenTool,
  BookOpen,
  Presentation,
  Bot,
  GitPullRequestArrow,
  Search,
  Music,
  ChartLine,
  ScanText,
} from "lucide-react";

const CATEGORIES = [
  { label: "Demo videos", Icon: Video },
  { label: "Landing pages", Icon: Globe },
  { label: "LaTeX coursework", Icon: BookOpen },
  { label: "Voiceovers", Icon: Mic },
  { label: "Image generation", Icon: ImageIcon },
  { label: "Code review", Icon: GitPullRequestArrow },
  { label: "Pitch decks", Icon: Presentation },
  { label: "Research briefs", Icon: Search },
  { label: "Copywriting", Icon: PenTool },
  { label: "Lead enrichment", Icon: ChartLine },
  { label: "Refactor agents", Icon: Code2 },
  { label: "OCR & extraction", Icon: ScanText },
  { label: "Music & SFX", Icon: Music },
  { label: "Doc summarizers", Icon: FileText },
  { label: "Personas", Icon: Bot },
  { label: "Anything you build", Icon: Sparkles },
];

export function CategoryMarquee() {
  const items = [...CATEGORIES, ...CATEGORIES];
  return (
    <section className="relative py-10 border-y border-[var(--border)] bg-bg-elev/40 overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-fg-subtle mb-6">
          Categories on day one
        </p>
      </div>
      <div
        className="relative"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div className="flex gap-3 animate-marquee w-max will-change-transform">
          {items.map(({ label, Icon }, idx) => (
            <span
              key={`${label}-${idx}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.03] px-4 py-2 text-sm text-fg-muted"
            >
              <Icon className="w-3.5 h-3.5 text-violet" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
