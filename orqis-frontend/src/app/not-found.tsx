import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Not found",
  description: "Page not found.",
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex">
          <Logo size={32} />
        </Link>
        <p className="mt-10 font-mono text-[64px] font-semibold leading-none tracking-[-0.04em] text-grad-primary">
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          We couldn&apos;t find that.
        </h1>
        <p className="mt-3 text-sm text-fg-muted leading-relaxed">
          The agent or page might have been renamed, removed, or never existed.
          The catalogue is the easiest place to start over.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/browse"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full font-medium text-white bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] shadow-[0_8px_30px_-8px_rgba(168,85,247,0.55)] hover:brightness-110 transition-all"
          >
            Browse agents
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-11 px-5 rounded-full font-medium text-fg-muted hover:text-fg transition-colors"
          >
            ← Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
