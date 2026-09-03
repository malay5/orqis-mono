import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing for orqis's own email + password auth (replaced Google
 * OAuth in Sprint 19).
 *
 * Uses scrypt from node:crypto rather than bcrypt/argon2 so we add no native
 * dependency — scrypt is a memory-hard KDF and is the right primitive for
 * this. Parameters are stored inside the hash string, so raising the cost
 * later doesn't invalidate existing hashes: verify reads N/r/p from the
 * stored value, and only newly-set passwords use the new cost.
 *
 * Stored format:  scrypt$<N>$<r>$<p>$<salt hex>$<derived key hex>
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

// N=16384, r=8, p=1 is the node default and a reasonable interactive cost.
// maxmem must exceed 128 * N * r (= 16 MiB here) or scrypt throws.
const N = 16_384;
const R = 8;
const P = 1;
const MAXMEM = 64 * 1024 * 1024;
const KEY_BYTES = 64;
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

/**
 * Deliberately permissive: length only. Composition rules (one upper, one
 * digit, one symbol) measurably push people toward `Password1!` without
 * adding entropy, and we'd rather not train that habit.
 */
export function passwordProblem(plain: string): string | null {
  if (typeof plain !== "string" || plain.length === 0) return "Password is required.";
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (plain.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(plain, salt, KEY_BYTES, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (typeof plain !== "string" || typeof stored !== "string" || !stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // Guard against a tampered/corrupt row asking for an absurd allocation.
  if (128 * n * r > MAXMEM) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "hex");
    expected = Buffer.from(parts[5], "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await scrypt(plain, salt, expected.length, { N: n, r, p, maxmem: MAXMEM });
  } catch {
    return false;
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
