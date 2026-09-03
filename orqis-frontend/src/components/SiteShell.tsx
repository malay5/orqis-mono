"use client";

import { useState, type ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ListAgentModal } from "@/components/modals/ListAgentModal";

/**
 * App-wide chrome: header, footer, and the "list your agent" modal host.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  const [listAgentOpen, setListAgentOpen] = useState(false);

  return (
    <>
      <Header onListAgent={() => setListAgentOpen(true)} />
      <div className="pt-16">{children}</div>
      <Footer />
      <ListAgentModal open={listAgentOpen} onClose={() => setListAgentOpen(false)} />
    </>
  );
}
