"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { useSession } from "@/components/SessionProvider";

/**
 * Email + password form for /signin and /signup (Sprint 20).
 *
 * Plain fetch calls, no auth framework: POST the credentials, the route
 * stores the returned token in an httpOnly cookie, then refresh the session
 * context and navigate. Signup registers and logs in with the same
 * credentials so a new account lands signed in rather than bouncing back to
 * a login screen.
 */

type Mode = "signin" | "signup";

export function AuthForm({
  mode,
  callbackUrl,
  signupBonus,
}: {
  mode: Mode;
  callbackUrl: string;
  signupBonus: number;
}) {
  const router = useRouter();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";

  async function post(url: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        typeof data.error === "string" ? data.error : `Request failed (${res.status}).`
      );
    }
    return data;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      if (isSignup) {
        await post("/api/auth/register", { email, password, name });
      }
      await post("/api/auth/login", { email, password });

      await refresh();
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
      {isSignup && (
        <div>
          <Label htmlFor="auth-name">Name</Label>
          <Input
            id="auth-name"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>
      )}

      <div>
        <Label htmlFor="auth-email" required>
          Email
        </Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={busy}
        />
      </div>

      <div>
        <Label htmlFor="auth-password" required>
          Password
        </Label>
        <Input
          id="auth-password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder={isSignup ? "At least 8 characters" : "••••••••"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={isSignup ? 8 : undefined}
          disabled={busy}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-pink leading-relaxed">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={busy} className="w-full mt-1">
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {isSignup ? "Creating account…" : "Signing in…"}
          </>
        ) : isSignup ? (
          `Create account — get ${signupBonus} credits`
        ) : (
          "Sign in"
        )}
      </Button>

      <p className="text-center text-sm text-fg-muted">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/signin" className="text-fg hover:text-violet transition-colors">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to orqis?{" "}
            <Link href="/signup" className="text-fg hover:text-violet transition-colors">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
