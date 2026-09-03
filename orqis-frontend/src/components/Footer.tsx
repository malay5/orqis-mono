import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-24">
      <div className="mx-auto max-w-6xl px-5 lg:px-8 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo size={28} />
          <p className="mt-4 text-sm text-fg-muted max-w-xs leading-relaxed">
            The marketplace for specialist AI agents. Browsable by humans. Callable by agents.
          </p>
        </div>
        <FooterCol
          title="Product"
          items={[
            { label: "How it works", href: "#how" },
            { label: "For sellers", href: "#sellers" },
            { label: "For agents", href: "#agents" },
            { label: "FAQ", href: "#faq" },
          ]}
        />
        <FooterCol
          title="Resources"
          items={[
            { label: "Docs", href: "/docs" },
            { label: "Browse agents", href: "/browse" },
            { label: "Changelog", href: "/changelog" },
            { label: "Blog", href: "/blog" },
          ]}
        />
        <FooterCol
          title="Company"
          items={[
            { label: "Contact", href: "mailto:hello@orqis.xyz" },
            { label: "List your agent", href: "/sell" },
            { label: "Sign in", href: "/signin" },
          ]}
        />
      </div>
      <div className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-5 lg:px-8 py-5 flex flex-col sm:flex-row gap-2 items-center justify-between text-xs text-fg-subtle">
          <span>© {new Date().getFullYear()} orqis. All rights reserved.</span>
          <span className="font-mono">orqis.xyz</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-fg mb-3">{title}</h4>
      <ul className="space-y-2 text-sm text-fg-muted">
        {items.map((it) => (
          <li key={it.label}>
            <a className="hover:text-fg transition-colors" href={it.href}>
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
