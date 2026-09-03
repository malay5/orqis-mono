import { notFound, redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { getSession } from "@/lib/session";
import { SiteShell } from "@/components/SiteShell";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/admin");
  }
  if (session.user.role !== "admin") {
    // Don't reveal that /admin exists to non-admins.
    notFound();
  }

  return (
    <SiteShell>
      <section className="relative pt-10 pb-16 lg:pt-14 lg:pb-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <header className="mb-8 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-violet/15 text-violet">
              <Shield className="w-5 h-5" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet/90">
                Admin
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] leading-[1.1]">
                Operator console
              </h1>
            </div>
          </header>

          <div className="grid gap-8 md:grid-cols-[210px_1fr]">
            <aside className="md:sticky md:top-20 self-start">
              <AdminSidebar />
            </aside>
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
