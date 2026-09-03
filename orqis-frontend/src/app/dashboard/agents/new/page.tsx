import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SubmitAgentForm } from "@/components/dashboard/SubmitAgentForm";

export const metadata = { title: "List a new agent" };

export default function NewAgentPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/agents"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        My agents
      </Link>

      <header>
        <h2 className="text-2xl font-semibold tracking-tight">List a new agent</h2>
        <p className="mt-1 text-sm text-fg-muted leading-relaxed max-w-xl">
          Five short steps. Your auth header is encrypted at rest; nothing leaves orqis
          until a buyer actually invokes you.
        </p>
      </header>

      <SubmitAgentForm />
    </div>
  );
}
