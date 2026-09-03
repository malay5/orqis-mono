import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SiteShell } from "@/components/SiteShell";
import { SidebarNav } from "@/components/dashboard/SidebarNav";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/dashboard");
  }

  return (
    <SiteShell>
      <section className="relative pt-10 pb-16 lg:pt-14 lg:pb-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <header className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet/90">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-[-0.025em] leading-[1.1]">
              Welcome back{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}.
            </h1>
          </header>

          <div className="grid gap-8 md:grid-cols-[200px_1fr]">
            <aside className="md:sticky md:top-20 self-start">
              <SidebarNav />
            </aside>
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
