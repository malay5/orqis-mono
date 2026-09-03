"use client";

import { useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  Loader2,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import type { ApiKeyRow, CreatedApiKey } from "@/lib/api-keys";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function ApiKeysClient({ initial }: { initial: ApiKeyRow[] }) {
  const [rows, setRows] = useState<ApiKeyRow[]>(initial);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(rows.length === 0);
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<{ read: boolean; invoke: boolean }>({
    read: true,
    invoke: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  async function create() {
    if (!label.trim()) {
      setError("label is required");
      return;
    }
    const enabledScopes = (Object.keys(scopes) as Array<"read" | "invoke">).filter(
      (k) => scopes[k]
    );
    if (enabledScopes.length === 0) {
      setError("at least one scope is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), scopes: enabledScopes }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        key?: CreatedApiKey;
        error?: string;
      };
      if (!res.ok || !j.key) {
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      setRevealed(j.key);
      setRows((prev) => [
        {
          id: j.key!.id,
          label: j.key!.label,
          prefix: j.key!.prefix,
          scopes: j.key!.scopes,
          lastUsedAt: null,
          revokedAt: null,
          createdAt: j.key!.createdAt,
        },
        ...prev,
      ]);
      setLabel("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string, prefix: string) {
    if (!confirm(`Revoke key ${prefix}? This cannot be undone.`)) return;
    const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Failed to revoke");
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface-elev p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white shrink-0">
            <KeyRound className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-fg">API keys</h2>
            <p className="mt-1 text-sm text-fg-muted leading-relaxed max-w-xl">
              Mint scoped keys to call orqis from code or to drop into the{" "}
              <code className="font-mono text-fg">npx&nbsp;@orqis/mcp</code> MCP server. Keys
              debit credits from your balance like UI calls do.
            </p>
          </div>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            New key
          </Button>
        )}
      </div>

      {revealed && (
        <div className="rounded-xl border border-cyan/40 bg-cyan/5 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-cyan shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">
                Copy this key now — you won&apos;t see it again.
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                We only store a hash. If you lose this string, mint a new key.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-bg/40 border border-[var(--border)] px-3 py-2.5">
            <code className="flex-1 font-mono text-sm text-fg break-all">
              {revealed.plaintext}
            </code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(revealed.plaintext);
                setCopied(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-fg transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-cyan" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setRevealed(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {showForm && (
        <div className="surface-elev p-6 space-y-4">
          <h3 className="text-base font-semibold tracking-tight">Create a new key</h3>
          <div>
            <Label htmlFor="k-label" required>
              Label
            </Label>
            <Input
              id="k-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. CI server, Claude Code, my-laptop"
              maxLength={80}
              disabled={creating}
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-fg-muted mb-1.5">Scopes</span>
            <div className="flex flex-wrap gap-3">
              <ScopeCheckbox
                checked={scopes.read}
                onChange={(v) => setScopes((s) => ({ ...s, read: v }))}
                label="read"
                hint="Browse + search agents"
                disabled={creating}
              />
              <ScopeCheckbox
                checked={scopes.invoke}
                onChange={(v) => setScopes((s) => ({ ...s, invoke: v }))}
                label="invoke"
                hint="Run agents (debits credits)"
                disabled={creating}
              />
            </div>
          </div>
          {error && <p className="text-sm text-pink">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={create} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Minting…
                </>
              ) : (
                "Mint key"
              )}
            </Button>
          </div>
        </div>
      )}

      <section>
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-fg-subtle mb-3">
          Active keys
        </h3>
        {rows.length === 0 ? (
          <div className="surface-elev p-8 text-center text-fg-muted text-sm">
            No active keys. Mint one above.
          </div>
        ) : (
          <ul className="surface-elev divide-y divide-[var(--border)] overflow-hidden">
            {rows.map((r) => (
              <li
                key={r.id}
                className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg truncate">{r.label}</p>
                  <p className="text-xs text-fg-subtle font-mono mt-0.5">{r.prefix}</p>
                  <p className="text-[11px] text-fg-subtle mt-1">
                    scopes: {r.scopes.join(", ")} · created{" "}
                    {fmt.format(new Date(r.createdAt))}
                    {r.lastUsedAt
                      ? ` · last used ${fmt.format(new Date(r.lastUsedAt))}`
                      : " · never used"}
                  </p>
                </div>
                <button
                  onClick={() => revoke(r.id, r.prefix)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-fg-muted hover:text-pink hover:bg-pink/10 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ScopeCheckbox({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2 cursor-pointer hover:border-white/25 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-violet mt-0.5"
        disabled={disabled}
      />
      <span className="text-sm">
        <span className="text-fg font-mono">{label}</span>
        <span className="block text-[11px] text-fg-subtle">{hint}</span>
      </span>
    </label>
  );
}
