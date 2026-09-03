"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

type Step = "basics" | "schema" | "endpoint" | "pricing" | "preview";

const STEPS: { value: Step; label: string }[] = [
  { value: "basics", label: "Basics" },
  { value: "schema", label: "Schema" },
  { value: "endpoint", label: "Endpoint" },
  { value: "pricing", label: "Pricing" },
  { value: "preview", label: "Preview" },
];

const SUGGESTED_CATEGORIES = [
  "Video",
  "Web",
  "Education",
  "Decks",
  "Audio",
  "Image",
  "DevTools",
  "GTM",
];

type FormState = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  longDescription: string;
  category: string;
  tags: string;
  iconEmoji: string;
  accentHex: string;
  screenshots: string;

  inputSchemaText: string;
  outputSchemaText: string;
  exampleRequestText: string;
  exampleResponseText: string;

  endpointUrl: string;
  authHeaderName: string;
  authHeaderValue: string;
  isAsync: boolean;

  pricePerCall: string;
};

const INITIAL: FormState = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  longDescription: "",
  category: "",
  tags: "",
  iconEmoji: "✨",
  accentHex: "#a855f7",
  screenshots: "",

  inputSchemaText: "",
  outputSchemaText: "",
  exampleRequestText: "",
  exampleResponseText: "",

  endpointUrl: "",
  authHeaderName: "",
  authHeaderValue: "",
  isAsync: false,

  pricePerCall: "10",
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function tryParseJson(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } | { ok: true; value: null } {
  if (!text.trim()) return { ok: true, value: null };
  try {
    const v = JSON.parse(text) as unknown;
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      return { ok: false, error: "Must be a JSON object." };
    }
    return { ok: true, value: v as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

export function SubmitAgentForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basics");
  const [data, setData] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string } | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.value === step);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  // Auto-derive slug from name unless the user has typed one.
  const effectiveSlug = data.slug.trim() ? slugify(data.slug) : slugify(data.name);

  // Per-step validity — controls when "Continue" is enabled.
  const validity = useMemo(() => {
    const errors: Partial<Record<Step, string>> = {};
    if (!data.name.trim()) errors.basics = "Name is required.";
    else if (!data.tagline.trim()) errors.basics = "Tagline is required.";
    else if (!data.category.trim()) errors.basics = "Pick a category.";
    else if (effectiveSlug.length < 3) errors.basics = "Slug must be ≥ 3 chars.";

    const inSchema = tryParseJson(data.inputSchemaText);
    const outSchema = tryParseJson(data.outputSchemaText);
    const exReq = tryParseJson(data.exampleRequestText);
    const exRes = tryParseJson(data.exampleResponseText);
    if (!inSchema.ok) errors.schema = `Input schema: ${inSchema.error}`;
    else if (!outSchema.ok) errors.schema = `Output schema: ${outSchema.error}`;
    else if (!exReq.ok) errors.schema = `Example request: ${exReq.error}`;
    else if (!exRes.ok) errors.schema = `Example response: ${exRes.error}`;

    if (!data.endpointUrl.trim()) errors.endpoint = "Endpoint URL is required.";
    else {
      try {
        const u = new URL(data.endpointUrl.trim());
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          errors.endpoint = "URL must use http or https.";
        }
      } catch {
        errors.endpoint = "Endpoint URL must be a valid URL.";
      }
    }
    if (data.authHeaderName.trim() && !data.authHeaderValue) {
      errors.endpoint = "Auth header value is required when name is set.";
    }

    const price = Number(data.pricePerCall);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
      errors.pricing = "Pricing must be a non-negative integer.";
    }

    return errors;
  }, [data, effectiveSlug]);

  const canContinue = !validity[step];
  const canSubmit =
    !validity.basics && !validity.schema && !validity.endpoint && !validity.pricing;

  function next() {
    const i = STEPS.findIndex((s) => s.value === step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1].value);
  }
  function back() {
    const i = STEPS.findIndex((s) => s.value === step);
    if (i > 0) setStep(STEPS[i - 1].value);
  }

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const inSchema = tryParseJson(data.inputSchemaText);
    const outSchema = tryParseJson(data.outputSchemaText);
    const exReq = tryParseJson(data.exampleRequestText);
    const exRes = tryParseJson(data.exampleResponseText);

    const payload = {
      name: data.name.trim(),
      slug: effectiveSlug,
      tagline: data.tagline.trim(),
      description: data.description.trim(),
      longDescription: data.longDescription.trim(),
      category: data.category.trim(),
      tags: data.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      iconEmoji: data.iconEmoji.trim() || "✨",
      accentHex: data.accentHex.trim() || "#a855f7",
      screenshots: data.screenshots
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean),
      inputSchema: inSchema.ok ? inSchema.value : null,
      outputSchema: outSchema.ok ? outSchema.value : null,
      exampleRequest: exReq.ok ? exReq.value : null,
      exampleResponse: exRes.ok ? exRes.value : null,
      endpointUrl: data.endpointUrl.trim(),
      authHeaderName: data.authHeaderName.trim(),
      authHeaderValue: data.authHeaderValue,
      isAsync: data.isAsync,
      pricePerCall: Number(data.pricePerCall),
    };

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; slug?: string };
      if (!res.ok) throw new Error(j.error || `Failed (${res.status})`);
      setDone({ slug: j.slug ?? effectiveSlug });
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="surface-elev p-8 text-center">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan/15 text-cyan">
          <CheckCircle2 className="w-6 h-6" />
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Submitted for review</h2>
        <p className="mt-2 text-sm text-fg-muted leading-relaxed max-w-md mx-auto">
          Your agent <span className="font-mono text-fg">{done.slug}</span> is in the
          admin queue. You&apos;ll see it on <code className="font-mono text-fg">/dashboard/agents</code> with
          status <span className="text-violet">pending</span>. Once approved it
          appears on /browse.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="secondary" onClick={() => router.push("/dashboard/agents")}>
            Back to my agents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Stepper current={stepIndex} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "preview") submit();
          else if (canContinue) next();
        }}
        className="space-y-6"
      >
        {step === "basics" && (
          <section className="surface-elev p-6 space-y-4">
            <SectionTitle>Basics</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="a-name" required>Name</Label>
                <Input
                  id="a-name"
                  type="text"
                  value={data.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="demo-forge"
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="a-slug">Slug</Label>
                <Input
                  id="a-slug"
                  type="text"
                  value={data.slug || effectiveSlug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="auto from name"
                  maxLength={60}
                />
                <p className="mt-1 text-[11px] text-fg-subtle">
                  URL: <code className="font-mono">/agents/{effectiveSlug || "your-slug"}</code>
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="a-tagline" required>Tagline</Label>
              <Input
                id="a-tagline"
                type="text"
                value={data.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                placeholder="One-line elevator pitch."
                maxLength={140}
              />
            </div>

            <div>
              <Label htmlFor="a-desc">Short description</Label>
              <Textarea
                id="a-desc"
                value={data.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="One short paragraph shown above the fold."
                maxLength={4000}
              />
            </div>

            <div>
              <Label htmlFor="a-long">Long description</Label>
              <Textarea
                id="a-long"
                value={data.longDescription}
                onChange={(e) => set("longDescription", e.target.value)}
                placeholder="Multi-paragraph; rendered on the agent detail page. Use blank lines between paragraphs."
                className="min-h-[140px]"
                maxLength={4000}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
              <div>
                <Label htmlFor="a-category" required>Category</Label>
                <input
                  list="cat-suggestions"
                  id="a-category"
                  type="text"
                  value={data.category}
                  onChange={(e) => set("category", e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-[var(--border)] px-4 py-3 text-fg placeholder:text-fg-subtle focus:border-violet/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet/25"
                  placeholder="Video, Web, Audio, …"
                  maxLength={60}
                />
                <datalist id="cat-suggestions">
                  {SUGGESTED_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label htmlFor="a-emoji">Icon</Label>
                <Input
                  id="a-emoji"
                  type="text"
                  value={data.iconEmoji}
                  onChange={(e) => set("iconEmoji", e.target.value)}
                  className="w-20 text-center"
                  maxLength={4}
                />
              </div>
              <div>
                <Label htmlFor="a-accent">Accent</Label>
                <input
                  id="a-accent"
                  type="color"
                  value={data.accentHex}
                  onChange={(e) => set("accentHex", e.target.value)}
                  className="h-12 w-20 rounded-xl border border-[var(--border)] bg-white/5 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="a-tags">Tags (comma-separated)</Label>
              <Input
                id="a-tags"
                type="text"
                value={data.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="video, voiceover, remotion"
              />
            </div>

            <div>
              <Label htmlFor="a-shots">Screenshot captions (one per line)</Label>
              <Textarea
                id="a-shots"
                value={data.screenshots}
                onChange={(e) => set("screenshots", e.target.value)}
                placeholder={"Scene storyboard\nVoiceover preview\nFinal 30s render"}
              />
              <p className="mt-1 text-[11px] text-fg-subtle">
                Real image upload lands later — for now we render styled mock tiles with these captions.
              </p>
            </div>
          </section>
        )}

        {step === "schema" && (
          <section className="surface-elev p-6 space-y-4">
            <SectionTitle>Schemas &amp; examples</SectionTitle>
            <p className="text-sm text-fg-muted">
              Paste JSON Schema (object form) for input + output, plus example bodies that
              match. Real JSON-Schema validation lands in Sprint 6 — for now these are stored
              as opaque objects shown on the agent detail page.
            </p>

            <SchemaField
              label="Input JSON Schema"
              value={data.inputSchemaText}
              onChange={(v) => set("inputSchemaText", v)}
              placeholder={'{\n  "type": "object",\n  "required": ["product"],\n  "properties": { "product": { "type": "string" } }\n}'}
            />
            <SchemaField
              label="Output JSON Schema"
              value={data.outputSchemaText}
              onChange={(v) => set("outputSchemaText", v)}
              placeholder={'{\n  "type": "object",\n  "properties": { "url": { "type": "string", "format": "uri" } }\n}'}
            />
            <SchemaField
              label="Example request"
              value={data.exampleRequestText}
              onChange={(v) => set("exampleRequestText", v)}
              placeholder={'{ "product": "https://example.com" }'}
            />
            <SchemaField
              label="Example response"
              value={data.exampleResponseText}
              onChange={(v) => set("exampleResponseText", v)}
              placeholder={'{ "url": "https://orqis.xyz/r/abc.mp4" }'}
            />
          </section>
        )}

        {step === "endpoint" && (
          <section className="surface-elev p-6 space-y-4">
            <SectionTitle>Endpoint</SectionTitle>
            <p className="text-sm text-fg-muted">
              We POST validated input to this URL on every invocation. Your auth header
              (if any) is encrypted at rest with AES-256-GCM and only decrypted server-side
              when we actually call your endpoint.
            </p>

            <div>
              <Label htmlFor="a-endpoint" required>Endpoint URL</Label>
              <Input
                id="a-endpoint"
                type="url"
                value={data.endpointUrl}
                onChange={(e) => set("endpointUrl", e.target.value)}
                placeholder="https://my-agent.fly.dev/run"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <div>
                <Label htmlFor="a-hname">Auth header name</Label>
                <Input
                  id="a-hname"
                  type="text"
                  value={data.authHeaderName}
                  onChange={(e) => set("authHeaderName", e.target.value)}
                  placeholder="Authorization"
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="a-hval">Auth header value</Label>
                <div className="relative">
                  <Input
                    id="a-hval"
                    type="password"
                    value={data.authHeaderValue}
                    onChange={(e) => set("authHeaderValue", e.target.value)}
                    placeholder="Bearer sk-…"
                    autoComplete="off"
                  />
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle pointer-events-none" />
                </div>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                checked={data.isAsync}
                onChange={(e) => set("isAsync", e.target.checked)}
                className="accent-violet"
              />
              Async — I&apos;ll respond with a job id and notify orqis via webhook when done.
            </label>
          </section>
        )}

        {step === "pricing" && (
          <section className="surface-elev p-6 space-y-4">
            <SectionTitle>Pricing</SectionTitle>
            <p className="text-sm text-fg-muted">
              Buyers spend credits per call at the rate you set. During MVP credits are
              free; once payments are on, we&apos;ll take a platform fee on top of your price.
            </p>

            <div className="max-w-xs">
              <Label htmlFor="a-price" required>Credits per call</Label>
              <Input
                id="a-price"
                type="number"
                min={0}
                step={1}
                value={data.pricePerCall}
                onChange={(e) => set("pricePerCall", e.target.value)}
              />
              <p className="mt-1 text-[11px] text-fg-subtle">
                Tip: synchronous text agents typically charge 2–10 credits, async video
                agents 30–80.
              </p>
            </div>
          </section>
        )}

        {step === "preview" && (
          <section className="surface-elev p-6 space-y-4">
            <SectionTitle>Preview</SectionTitle>
            <p className="text-sm text-fg-muted">
              Last look. Submitting puts your agent in the admin review queue.
            </p>

            <div className="rounded-xl border border-[var(--border)] bg-bg/40 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-3xl border"
                  style={{
                    background: `${data.accentHex}1f`,
                    borderColor: `${data.accentHex}40`,
                  }}
                >
                  {data.iconEmoji || "✨"}
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-fg">{data.name}</p>
                  <p className="text-xs text-fg-subtle uppercase tracking-wider">
                    {data.category} · {data.isAsync ? "async" : "sync"} · {data.pricePerCall || 0} credits
                  </p>
                </div>
              </div>
              <p className="text-sm text-fg-muted">{data.tagline}</p>
              <p className="text-xs text-fg-subtle">
                URL: <code className="font-mono">/agents/{effectiveSlug}</code>
              </p>
              <p className="text-xs text-fg-subtle">
                Endpoint: <code className="font-mono break-all">{data.endpointUrl || "—"}</code>
              </p>
              {data.authHeaderName && (
                <p className="text-xs text-fg-subtle">
                  Auth header: <code className="font-mono">{data.authHeaderName}: ••••••</code>
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-pink" role="alert">{submitError}</p>
            )}
          </section>
        )}

        {validity[step] && step !== "preview" && (
          <p className="text-sm text-pink">{validity[step]}</p>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            type="button"
            onClick={back}
            disabled={stepIndex === 0 || submitting}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>

          {step === "preview" ? (
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Submit for review
                </>
              )}
            </Button>
          ) : (
            <Button type="submit" disabled={!canContinue}>
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.value} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center justify-center w-6 h-6 rounded-full border text-[11px] font-mono",
                active && "bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white border-transparent",
                done && "bg-cyan/15 text-cyan border-cyan/40",
                !active && !done && "border-[var(--border)] text-fg-subtle"
              )}
            >
              {done ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            <span
              className={cn(
                "uppercase tracking-wider",
                active ? "text-fg" : done ? "text-cyan" : "text-fg-subtle"
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="w-6 h-px bg-[var(--border)] mx-1" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold tracking-tight text-fg">{children}</h2>
  );
}

function SchemaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={`f-${label}`}>{label}</Label>
      <Textarea
        id={`f-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="font-mono text-[12.5px] min-h-[140px]"
      />
    </div>
  );
}
