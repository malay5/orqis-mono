"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Clock, Coins, KeyRound, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/dashboard", label: "Activity", Icon: Activity, exact: true },
  { href: "/dashboard/jobs", label: "Jobs", Icon: Clock },
  { href: "/dashboard/credits", label: "Credits", Icon: Coins },
  { href: "/dashboard/api-keys", label: "API keys", Icon: KeyRound },
  { href: "/dashboard/agents", label: "My agents", Icon: LayoutGrid },
];

export function SidebarNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Dashboard">
      <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
        {ITEMS.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap",
                  active
                    ? "bg-white/[0.05] text-fg border border-[var(--border-strong)]"
                    : "text-fg-muted hover:text-fg hover:bg-white/[0.03] border border-transparent"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
