import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Symmetric AES-256-GCM encryption for at-rest secrets (e.g. seller API auth
 * headers). Uses Node's built-in crypto — no native deps. The key comes from
 * the ENCRYPTION_KEY env var; we hash whatever's there with SHA-256 so any
 * length string still produces a 32-byte key.
 *
 * The serialized format is `<iv>.<ciphertext>.<authTag>`, all base64. Easy to
 * store as a single string field on a Mongoose doc.
 *
 * Note: Mongo storing arbitrary base64 is fine; we only need to be able to
 * round-trip via decryptString().
 */

const PREFIX = "v1:"; // version prefix so we can rotate algorithms later

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      "ENCRYPTION_KEY is not set or too short. Generate one with `openssl rand -base64 32` and put it in .env.local."
    );
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptString(plaintext: string): string {
  if (typeof plaintext !== "string") {
    throw new Error("encryptString expects a string");
  }
  const iv = randomBytes(12); // GCM standard
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}.${ct.toString("base64")}.${tag.toString(
    "base64"
  )}`;
}

export function decryptString(serialized: string): string {
  if (!serialized.startsWith(PREFIX)) {
    throw new Error("Unknown ciphertext format / version");
  }
  const [ivB64, ctB64, tagB64] = serialized.slice(PREFIX.length).split(".");
  if (!ivB64 || !ctB64 || !tagB64) {
    throw new Error("Malformed ciphertext");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

/**
 * "Show last 4" mask used by the dashboard so sellers can sanity-check which
 * key/value they uploaded without us sending the plaintext back over the wire.
 */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return "";
  if (plaintext.length <= 4) return "•".repeat(plaintext.length);
  return `•••• ${plaintext.slice(-4)}`;
}
