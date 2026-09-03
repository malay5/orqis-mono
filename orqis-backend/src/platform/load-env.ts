import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Side-effecting module: reads orqis-backend/.env into process.env.
 *
 * Import it FIRST, before any module that reads configuration:
 *
 *   import "./platform/load-env.js";
 *
 * The project deliberately carries no `dotenv` dependency (same reasoning as
 * scrypt and the JWT helper), and until Sprint 19 the backend never needed
 * one — it took MONGODB_URI from the ambient environment or ran without a
 * database. The platform API changed that: AUTH_SECRET and MONGODB_URI are
 * now required at boot, and without this the server refuses to start even
 * with a correctly populated .env file.
 *
 * Real environment variables always win, so Railway/Render/Docker config is
 * never overridden by a stray local file.
 */
function loadEnvFile(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/platform/ → package root
  const envPath = resolve(here, "..", "..", ".env");

  let raw: string;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return; // No .env is fine — deployed environments inject real env vars.
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();
