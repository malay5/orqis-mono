"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Field";

type Status = "idle" | "submitting" | "success" | "error";

export function ListAgentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const data = new FormData(e.currentTarget);
    const payload = {
      contactName: String(data.get("contactName") || "").trim(),
      contactEmail: String(data.get("contactEmail") || "").trim(),
      agentName: String(data.get("agentName") || "").trim(),
      description: String(data.get("description") || "").trim(),
      endpointUrl: String(data.get("endpointUrl") || "").trim() || undefined,
      pricingIdea: String(data.get("pricingIdea") || "").trim() || undefined,
      links: String(data.get("links") || "").trim() || undefined,
    };

    if (!payload.contactEmail || !/^\S+@\S+\.\S+$/.test(payload.contactEmail)) {
      setStatus("error");
      setError("Please enter a valid email.");
      return;
    }
    if (!payload.agentName || !payload.description) {
      setStatus("error");
      setError("Agent name and description are required.");
      return;
    }

    try {
      const res = await fetch("/api/list-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStatus("idle");
      setError(null);
    }, 250);
  }

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={status === "success" ? "Got it — talk soon." : "List your agent"}
      description={
        status === "success"
          ? "We'll review your submission and reach out about onboarding within a few days."
          : "Tell us about your agent. We'll review submissions and onboard founding sellers personally."
      }
      widthClass="max-w-lg"
    >
      {status === "success" ? (
        <div className="flex flex-col items-center text-center py-3">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan/15 text-cyan">
            <CheckCircle2 className="w-6 h-6" />
          </span>
          <p className="mt-4 text-fg-muted text-sm max-w-sm">
            Founding sellers get the loudest distribution at launch and lifetime
            zero-fee invocations on their first 1,000 calls.
          </p>
          <Button onClick={handleClose} variant="secondary" className="mt-5">
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="la-name">Your name</Label>
              <Input
                id="la-name"
                name="contactName"
                type="text"
                placeholder="Ada Lovelace"
                autoComplete="name"
                disabled={status === "submitting"}
              />
            </div>
            <div>
              <Label htmlFor="la-email" required>
                Email
              </Label>
              <Input
                id="la-email"
                name="contactEmail"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
                disabled={status === "submitting"}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="la-agent" required>
              Agent name
            </Label>
            <Input
              id="la-agent"
              name="agentName"
              type="text"
              placeholder="demo-forge"
              required
              disabled={status === "submitting"}
            />
          </div>

          <div>
            <Label htmlFor="la-desc" required>
              What does it do?
            </Label>
            <Textarea
              id="la-desc"
              name="description"
              placeholder="Generates a 30-sec narrated product-demo video from a URL or description…"
              required
              disabled={status === "submitting"}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="la-endpoint">Endpoint URL (if any)</Label>
              <Input
                id="la-endpoint"
                name="endpointUrl"
                type="url"
                placeholder="https://api.example.com/run"
                disabled={status === "submitting"}
              />
            </div>
            <div>
              <Label htmlFor="la-pricing">Pricing in mind?</Label>
              <Input
                id="la-pricing"
                name="pricingIdea"
                type="text"
                placeholder="~12 credits / call"
                disabled={status === "submitting"}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="la-links">Demo / docs / repo links</Label>
            <Input
              id="la-links"
              name="links"
              type="text"
              placeholder="https://… (comma-separated)"
              disabled={status === "submitting"}
            />
          </div>

          {error && (
            <p className="text-sm text-pink" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={status === "submitting"} className="w-full">
            {status === "submitting" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit for review"
            )}
          </Button>
        </form>
      )}
    </ModalShell>
  );
}
