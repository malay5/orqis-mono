import { listUsers } from "@/lib/admin";
import { GrantCreditsForm } from "@/components/admin/GrantCreditsForm";

export const metadata = { title: "Admin · users" };

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function AdminUsersPage() {
  const users = await listUsers().catch(() => [] as Awaited<ReturnType<typeof listUsers>>);

  return (
    <div className="space-y-6">
      <GrantCreditsForm />

      <section>
        <h2 className="text-base font-semibold tracking-tight text-fg mb-3">
          Users{" "}
          <span className="text-fg-subtle font-normal text-sm">
            ({users.length})
          </span>
        </h2>

        {users.length === 0 ? (
          <div className="surface-elev p-8 text-center text-fg-muted text-sm">
            No users yet — sign in as one to bootstrap.
          </div>
        ) : (
          <div className="surface-elev overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.14em] text-fg-subtle bg-white/[0.02]">
                  <tr>
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th align="right">Credits</Th>
                    <Th>Joined</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-[var(--border)]">
                      <Td>
                        <div className="min-w-0">
                          <p className="text-fg font-medium truncate">{u.name || "—"}</p>
                          <p className="text-xs text-fg-subtle truncate">{u.email}</p>
                        </div>
                      </Td>
                      <Td>
                        <RoleBadge role={u.role} />
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-fg">{u.creditBalance.toLocaleString()}</span>
                      </Td>
                      <Td>
                        <span className="text-fg-subtle text-xs">{fmt.format(new Date(u.createdAt))}</span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <td className={`px-4 py-3 align-middle ${align === "right" ? "text-right" : ""}`}>
      {children}
    </td>
  );
}

function RoleBadge({ role }: { role: "buyer" | "seller" | "admin" }) {
  const colors: Record<string, string> = {
    admin: "bg-violet/15 text-violet border-violet/30",
    seller: "bg-cyan/15 text-cyan border-cyan/30",
    buyer: "bg-white/[0.04] text-fg-muted border-[var(--border)]",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wider border ${colors[role]}`}>
      {role}
    </span>
  );
}
