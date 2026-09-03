"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Sprint 18 (H1 fix): UI used to read `session.user.creditBalance` from the
 * JWT, which was only populated at sign-in and never refreshed. Any
 * spend / refund / grant was invisible until the user signed out and back in.
 *
 * This hook fetches the live balance from `/api/v1/me` and shares it across
 * consumers via a module-level pub/sub. After a successful invocation,
 * callers should `setBalance(newBalance)` (TryItPanel does this) so the
 * Header pill updates without a network round-trip.
 */

type Subscriber = (b: number | null) => void;

let cachedBalance: number | null = null;
let inFlight: Promise<number | null> | null = null;
const subscribers = new Set<Subscriber>();

function publish(next: number | null) {
  cachedBalance = next;
  for (const s of subscribers) s(next);
}

async function fetchOnce(): Promise<number | null> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch("/api/v1/me", { credentials: "include" });
      if (!res.ok) return null;
      const j = (await res.json()) as { user?: { creditBalance?: number } };
      const next = typeof j.user?.creditBalance === "number" ? j.user.creditBalance : null;
      publish(next);
      return next;
    } catch {
      return cachedBalance;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export type UseCreditBalance = {
  balance: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setBalance: (b: number | null) => void;
};

export function useCreditBalance(enabled = true): UseCreditBalance {
  const [balance, setLocal] = useState<number | null>(cachedBalance);
  const [loading, setLoading] = useState<boolean>(enabled && cachedBalance === null);

  useEffect(() => {
    if (!enabled) return;
    const sub: Subscriber = (next) => setLocal(next);
    subscribers.add(sub);

    if (cachedBalance === null) {
      setLoading(true);
      void fetchOnce().finally(() => setLoading(false));
    }

    const onFocus = () => {
      void fetchOnce();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      subscribers.delete(sub);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchOnce();
    } finally {
      setLoading(false);
    }
  }, []);

  const setBalance = useCallback((b: number | null) => publish(b), []);

  return { balance, loading, refresh, setBalance };
}
