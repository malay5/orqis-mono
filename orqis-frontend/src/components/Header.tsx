"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import { Coins, LayoutDashboard, LogOut, Shield, User as UserIcon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useCreditBalance } from "@/lib/use-credit-balance";

export function Header({
  onListAgent,
}: {
  onListAgent: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-40 transition-all duration-300",
        scrolled
          ? "backdrop-blur-xl bg-bg/70 border-b border-[var(--border)]"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto max-w-6xl px-5 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo size={28} />
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-[14.5px] text-fg-muted">
          <Link href="/browse" className="px-3 py-2 rounded-md hover:text-fg transition-colors">
            Browse
          </Link>
          <Link href="/categories" className="px-3 py-2 rounded-md hover:text-fg transition-colors">
            Categories
          </Link>
          <Link href="/#how" className="px-3 py-2 rounded-md hover:text-fg transition-colors">
            How it works
          </Link>
          <Link href="/#sellers" className="px-3 py-2 rounded-md hover:text-fg transition-colors">
            For sellers
          </Link>
        </nav>
        <HeaderActions onListAgent={onListAgent} />
      </div>
    </header>
  );
}

function HeaderActions({
  onListAgent,
}: {
  onListAgent: () => void;
}) {
  const { user } = useSession();

  // No loading state: the session is seeded from the server in the root
  // layout, so the correct actions render on first paint.
  if (user) {
    return <UserMenu />;
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onListAgent} className="hidden sm:inline-flex">
        List your agent
      </Button>
      <Link
        href="/signin"
        className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-full text-fg-muted hover:text-fg hover:bg-white/5 transition-colors"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium rounded-full text-white bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] shadow-[0_8px_30px_-8px_rgba(168,85,247,0.55)] hover:brightness-110 transition-all"
      >
        Get started
      </Link>
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useSession();
  const { balance } = useCreditBalance(!!user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const u = user;
  const initials = (u.name ?? u.email ?? "?").trim().charAt(0).toUpperCase();
  // Live balance from /api/v1/me — the token carries no balance, and it
  // would go stale on the first invocation anyway.
  const credits = balance;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border border-[var(--border)] hover:border-white/25 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {u.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.image} alt="" className="w-7 h-7 rounded-full" />
        ) : (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white text-xs font-semibold">
            {initials}
          </span>
        )}
        {credits !== null && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-fg-muted">
            <Coins className="w-3 h-3 text-cyan" />
            <span className="font-mono text-fg">{credits}</span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 surface-elev p-2 shadow-2xl"
        >
          <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
            <p className="text-sm font-medium text-fg truncate">{u.name ?? "Anonymous"}</p>
            <p className="text-xs text-fg-subtle truncate">{u.email}</p>
            {credits !== null && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-fg-muted">
                <Coins className="w-3.5 h-3.5 text-cyan" />
                <span className="font-mono text-fg">{credits}</span> credits
              </p>
            )}
          </div>
          <MenuLink href="/dashboard" Icon={LayoutDashboard}>Dashboard</MenuLink>
          <MenuLink href="/browse" Icon={UserIcon}>Browse agents</MenuLink>
          {u.role === "admin" && (
            <MenuLink href="/admin" Icon={Shield}>Admin console</MenuLink>
          )}
          <button
            role="menuitem"
            onClick={() => void signOut()}
            className="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-white/5"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  Icon,
  children,
}: {
  href: string;
  Icon: typeof UserIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-white/5"
    >
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  );
}
