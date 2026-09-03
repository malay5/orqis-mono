/**
 * Base URL of orqis-backend's platform API.
 *
 * Split out from `api-client.ts` so `lib/auth.ts` can reach the backend
 * without importing the client — the client imports `auth` to read the
 * session token, which would otherwise be a circular import.
 *
 * `ORQIS_API_URL` is server-side only (no NEXT_PUBLIC_ prefix): the browser
 * never talks to the backend directly, it goes through this app's route
 * handlers, which hold the JWT.
 *
 * Defaults to 127.0.0.1 rather than localhost deliberately — Node's fetch
 * resolves `localhost` to ::1 first, and Fastify binds IPv4, so `localhost`
 * here fails with ECONNREFUSED in local dev.
 */
export const API_BASE_URL = (process.env.ORQIS_API_URL ?? "http://127.0.0.1:4000").replace(
  /\/$/,
  ""
);
