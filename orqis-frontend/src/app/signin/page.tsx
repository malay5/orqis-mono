import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeCallbackUrl } from "@/lib/safe-callback-url";
import { SIGNUP_BONUS_CREDITS } from "@/lib/billing-config";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Sign in",
};

export default async function SignInPage({
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
            Sign in to <span className="text-grad-primary">orqis</span>
          </h1>
          <p className="mt-2 text-sm text-fg-muted text-center leading-relaxed">
            New here? You&apos;ll get{" "}
            <span className="text-fg font-medium">{SIGNUP_BONUS_CREDITS} credits</span> on the
            house.
          </p>

          <AuthForm mode="signin" callbackUrl={callbackUrl} signupBonus={SIGNUP_BONUS_CREDITS} />

          <p className="mt-6 text-[11px] text-fg-subtle text-center leading-relaxed">
            By continuing you agree that orqis is a beta product and that we may
            email you about your account.
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
