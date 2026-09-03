/**
 * Rewrites the `endpointUrl` baked into `src/data/seed-agents.ts` to whatever
 * host actually serves the in-house agents in this environment.
 *
 * The seed file records the legacy `http://localhost:4000` prefix; this swaps
 * it for `OWNED_SERVICES_BASE_URL` at seed time, so pointing the catalogue at
 * a deployed agent host is an env var rather than a code change.
 *
 * Default is `127.0.0.1`, not `localhost`, on purpose: Node's fetch resolves
 * `localhost` to ::1 first and both Fastify apps bind IPv4 only, so a
 * localhost URL here fails with ECONNREFUSED on every invocation — and it
 * surfaces as "fetch failed", which reads like a broken agent rather than a
 * name-resolution problem.
 */

const LEGACY_HOST = "http://localhost:4000";
const DEFAULT_BASE = "http://127.0.0.1:4100";

export function resolveSeedEndpoint(seedUrl: string | undefined): string {
  if (!seedUrl) return "";
  const raw = process.env.OWNED_SERVICES_BASE_URL ?? DEFAULT_BASE;
  const base = raw.replace(/\/$/, "");
  if (seedUrl.startsWith(LEGACY_HOST)) {
    return base + seedUrl.slice(LEGACY_HOST.length);
  }
  return seedUrl;
}
