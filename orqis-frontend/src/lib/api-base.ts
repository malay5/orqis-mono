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
 */

// 127.0.0.1 rather than localhost deliberately — Node's fetch resolves
// `localhost` to ::1 first and Fastify binds IPv4, so `localhost` fails with
// ECONNREFUSED in local dev even when the backend is running.
const LOCAL_DEFAULT = "http://127.0.0.1:4000";

const configured = process.env.ORQIS_API_URL?.trim();

export const API_BASE_URL = (configured || LOCAL_DEFAULT).replace(/\/$/, "");

/**
 * True when a production build fell back to the loopback default.
 *
 * Deployed, that fallback means requests go to the frontend's *own* machine,
 * where nothing is listening — surfacing as `ECONNREFUSED 127.0.0.1:4000`,
 * which reads as "the backend is down" when the truth is "this app was never
 * told where the backend lives".
 *
 * Checked at request time rather than thrown at import: a module-load throw
 * would break `next build` in CI, where the variable legitimately may not be
 * present, and a build that can't run is a worse failure than a request that
 * explains itself.
 */
export const API_BASE_URL_MISCONFIGURED =
  process.env.NODE_ENV === "production" && !configured;

export const MISCONFIGURED_MESSAGE =
  "ORQIS_API_URL is not set. The frontend has no database of its own — it reads " +
  "everything from orqis-backend — so it needs the backend's public URL, e.g. " +
  "ORQIS_API_URL=https://orqis-api.onrender.com. Set it in your hosting " +
  "provider's environment variables and redeploy.";
