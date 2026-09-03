import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { getSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { SIGNUP_BONUS_CREDITS, USD_PER_CREDIT } from "@/lib/billing-config";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Create an account",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const callbackUrl = safeCallbackUrl(sp.callbackUrl);
  if (session?.user) redirect(callbackUrl);

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex">
            <Logo size={32} />
          </Link>
        </div>

        <div className="surface-elev p-7">
          <h1 className="text-2xl font-semibold tracking-tight text-center">
            Create your <span className="text-grad-primary">orqis</span> account
          </h1>

          <div className="mt-5 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white/[0.04] px-4 py-3">
            <Coins className="w-5 h-5 text-cyan shrink-0" />
            <p className="text-sm text-fg-muted leading-relaxed">
              <span className="text-fg font-medium">
                {SIGNUP_BONUS_CREDITS} free credits
              </span>{" "}
              when you sign up — worth ${SIGNUP_BONUS_CREDITS * USD_PER_CREDIT}, enough to try
              the catalogue.
            </p>
          </div>

          <AuthForm mode="signup" callbackUrl={callbackUrl} signupBonus={SIGNUP_BONUS_CREDITS} />

          <p className="mt-6 text-[11px] text-fg-subtle text-center leading-relaxed">
            By creating an account you agree that orqis is a beta product and
            that we may email you about your account.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-fg-muted">
          <Link href="/" className="hover:text-fg transition-colors">
            ← Back to orqis.xyz
          </Link>
        </p>
      </div>
    </main>
  );
}
