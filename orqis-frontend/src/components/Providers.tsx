"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "@/components/SessionProvider";
import type { SessionUser } from "@/lib/session";

export function Providers({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: ReactNode;
}) {
  return <SessionProvider initialUser={initialUser}>{children}</SessionProvider>;
}
