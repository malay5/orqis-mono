"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/session";

/**
 * Client-side session state (Sprint 20) — replaces next-auth/react.
 *
 * Seeded from the server in the root layout, so the header renders the right
 * thing on first paint instead of flashing "Sign in" while a fetch resolves.
 * That's the one thing a pure-SPA session context can't do, and it's free
 * here because the layout is a server component that already knows.
 *
 * `refresh()` re-reads /api/auth/me — call it after anything that changes the
 * user server-side (buying credits, signing out).
 */

export type SessionStatus = "authenticated" | "unauthenticated";

type SessionContextValue = {
  user: SessionUser | null;
  status: SessionStatus;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { user: SessionUser | null };
      setUser(data.user);
    } catch {
      // Network blip — keep showing what we have rather than logging the
      // user out of the UI while their cookie is still perfectly valid.
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      // Full reload so every server component re-renders without the cookie.
      window.location.href = "/";
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      status: user ? "authenticated" : "unauthenticated",
      refresh,
      signOut,
    }),
    [user, refresh, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside <SessionProvider>. Check the root layout.");
  }
  return ctx;
}
