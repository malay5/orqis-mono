import "server-only";
import { apiFetch, apiFetchSafe } from "@/lib/api-client";

/**
 * API key management (Sprint 19 — via the platform API).
 *
 * Hashing, minting and validation moved to the backend; this is now a typed
 * wrapper over /v1/keys. The plaintext key is still returned exactly once, by
 * the backend, at creation.
 */

export type ApiKeyScope = "read" | "invoke";

export type ApiKeyRow = {
  id: string;
  label: string;
  prefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type CreatedApiKey = ApiKeyRow & { plaintext: string };

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const data = await apiFetchSafe<{ keys: ApiKeyRow[] }>("/v1/keys", { authenticated: true });
  return data?.keys ?? [];
}

export async function mintApiKey(input: {
  label: string;
  scopes?: ApiKeyScope[];
}): Promise<CreatedApiKey> {
  const data = await apiFetch<{ key: CreatedApiKey }>("/v1/keys", {
    method: "POST",
    authenticated: true,
    body: { label: input.label, scopes: input.scopes },
  });
  return data.key;
}

export async function revokeApiKey(input: { keyId: string }): Promise<boolean> {
  try {
    await apiFetch(`/v1/keys/${encodeURIComponent(input.keyId)}`, {
      method: "DELETE",
      authenticated: true,
    });
    return true;
  } catch {
    return false;
  }
}
