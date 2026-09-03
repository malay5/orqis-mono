import { getSession } from "@/lib/session";
import { listApiKeys, type ApiKeyRow } from "@/lib/api-keys";
import { ApiKeysClient } from "@/components/dashboard/ApiKeysClient";

export const metadata = { title: "API keys" };

export const dynamic = "force-dynamic";

export default async function DashboardApiKeysPage() {
  const session = await getSession();
  const initial: ApiKeyRow[] = session?.user?.id
    ? await listApiKeys().catch(() => [])
    : [];
  return <ApiKeysClient initial={initial} />;
}
