import { ScalarDocs } from "@/components/ScalarDocs";

export const metadata = {
  title: "API reference",
  description:
    "Public REST API for orqis. Browse, search, invoke, and poll agents from your code.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "API reference · orqis",
    description: "Search and invoke specialist AI agents from your code, over REST or MCP.",
    url: "/docs",
  },
};

export const dynamic = "force-static";

export default function DocsPage() {
  return (
    // No SiteShell wrapper here — Scalar takes the full viewport so the live
    // "try it" panels have room to breathe.
    <ScalarDocs />
  );
}
