import bcrypt from "bcryptjs";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing for orqis's email + password auth.
 *
 * bcrypt is the primary algorithm. `bcryptjs` rather than the native `bcrypt`
 * package: it is pure JavaScript, so there is no node-gyp step, no prebuilt
 * binary to match against the host's libc, and nothing to go wrong on a
 * container build. It produces standard `$2b$` hashes, byte-identical to the
 * native implementation and readable by it, so switching later is a one-line
 * change with no re-hashing.
 *
 * Cost factor 12: roughly 200-300ms per hash on typical hardware. High enough
 * to be expensive to attack offline, low enough that a login doesn't feel
 * slow. Raise it as hardware improves — `verifyPassword` reads the cost from
 * each stored hash, so old hashes keep verifying at whatever cost they were
 * written with.
 *
 * ── Legacy scrypt hashes ────────────────────────────────────────────
 * Accounts created before this change hold scrypt hashes in the format
 * `scrypt$<N>$<r>$<p>$<salt hex>$<key hex>`. Those are still verified, so
 * nobody is locked out, and `needsRehash()` lets the login path quietly
 * upgrade them to bcrypt on the next successful sign-in.
 */

const BCRYPT_ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt silently truncates at 72 bytes. Rejecting above that is honest —
// accepting a 200-character password and only using the first 72 is not.
export const MAX_PASSWORD_LENGTH = 72;

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
  // Measure bytes, not characters — bcrypt's limit is on bytes, and an emoji
  // or accented character costs more than one.
  if (Buffer.byteLength(plain, "utf8") > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} bytes (about ${MAX_PASSWORD_LENGTH} plain characters).`;
  }
  return null;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** A stored hash is bcrypt if it carries one of the standard bcrypt prefixes. */
function isBcryptHash(stored: string): boolean {
  return /^\$2[abxy]\$/.test(stored);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (typeof plain !== "string" || typeof stored !== "string" || !stored) return false;

  if (isBcryptHash(stored)) {
    try {
      return await bcrypt.compare(plain, stored);
    } catch {
      return false;
    }
  }

  // Pre-bcrypt account. Verify against the old scheme so existing users can
  // still sign in; the caller re-hashes afterwards via needsRehash().
  return verifyLegacyScrypt(plain, stored);
}

/**
 * True when a stored hash should be replaced after a successful login —
 * either it predates bcrypt, or it was written at a lower cost factor than
 * we now use.
 */
export function needsRehash(stored: string): boolean {
  if (!isBcryptHash(stored)) return true;
  const rounds = Number(stored.split("$")[2]);
  return !Number.isFinite(rounds) || rounds < BCRYPT_ROUNDS;
}

// ── Legacy scrypt verification ──────────────────────────────────────

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

const MAXMEM = 64 * 1024 * 1024;

async function verifyLegacyScrypt(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // Guard against a tampered row asking for an absurd allocation.
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

// `randomBytes` is retained for tests that want to synthesise a legacy hash.
export { randomBytes as _randomBytesForTests };
