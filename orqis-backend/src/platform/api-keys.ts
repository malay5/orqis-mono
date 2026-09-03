import { Types } from "mongoose";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { connectMongoose } from "../db/mongoose.js";
import { ApiKeyModel, type ApiKeyDoc } from "../models/ApiKey.js";

/**
 * Mint, store, list, revoke, and validate orqis API keys.
 *
 * Format: or_live_<28 chars base64url>. The "live" segment leaves room for
 * future "test" keys (sandbox / no real billing). 28 chars of base64url ≈
 * 168 bits of entropy — plenty.
 */

const KEY_PREFIX = "or_live_";
const RANDOM_BYTES = 21; // 28 base64url chars

export type ApiKeyScope = "read" | "invoke";

function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export type CreatedApiKey = {
  id: string;
  plaintext: string; // shown to user once, never persisted
  prefix: string;
  label: string;
  scopes: ApiKeyScope[];
  createdAt: string;
};

export async function mintApiKey(input: {
  userId: string;
  label: string;
  scopes?: ApiKeyScope[];
}): Promise<CreatedApiKey> {
  if (!Types.ObjectId.isValid(input.userId)) throw new Error("Invalid userId");
  const label = input.label.trim().slice(0, 80) || "Untitled key";
  const scopes: ApiKeyScope[] = input.scopes?.length
    ? Array.from(new Set(input.scopes)).filter(
        (s): s is ApiKeyScope => s === "read" || s === "invoke"
      )
    : ["read", "invoke"];

  await connectMongoose();
  const random = randomBytes(RANDOM_BYTES).toString("base64url");
  const plaintext = `${KEY_PREFIX}${random}`;
  const prefix = plaintext.slice(0, 12) + "…";
  const hashedKey = hashKey(plaintext);

  const doc = await ApiKeyModel.create({
    userId: new Types.ObjectId(input.userId),
    label,
    prefix,
    hashedKey,
    scopes,
  });

  return {
    id: String(doc._id),
    plaintext,
    prefix,
    label,
    scopes,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : new Date(doc.createdAt as unknown as string).toISOString(),
  };
}

export type ApiKeyRow = {
  id: string;
  label: string;
  prefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  createdAt: string;
};

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  if (!Types.ObjectId.isValid(userId)) return [];
  await connectMongoose();
  const docs = await ApiKeyModel.find({
    userId: new Types.ObjectId(userId),
    revokedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean<ApiKeyDoc[]>();
  return docs.map((d) => ({
    id: String(d._id),
    label: d.label,
    prefix: d.prefix,
    scopes: (d.scopes ?? []) as ApiKeyScope[],
    lastUsedAt:
      d.lastUsedAt instanceof Date
        ? d.lastUsedAt.toISOString()
        : d.lastUsedAt
          ? new Date(d.lastUsedAt as unknown as string).toISOString()
          : null,
    createdAt:
      d.createdAt instanceof Date
        ? d.createdAt.toISOString()
        : new Date(d.createdAt as unknown as string).toISOString(),
  }));
}

export async function revokeApiKey(input: {
  keyId: string;
  userId: string;
}): Promise<boolean> {
  if (!Types.ObjectId.isValid(input.keyId)) return false;
  if (!Types.ObjectId.isValid(input.userId)) return false;
  await connectMongoose();
  const res = await ApiKeyModel.updateOne(
    {
      _id: new Types.ObjectId(input.keyId),
      userId: new Types.ObjectId(input.userId),
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } }
  );
  return res.modifiedCount > 0;
}

export type ResolvedApiKey = {
  apiKeyId: string;
  userId: string;
  scopes: ApiKeyScope[];
};

/**
 * Constant-time lookup by hashed key. Returns null on miss; never reveals
 * whether the key existed-but-revoked vs never-existed.
 */
export async function validateApiKey(plaintext: string): Promise<ResolvedApiKey | null> {
  if (!plaintext.startsWith(KEY_PREFIX)) return null;
  if (plaintext.length < KEY_PREFIX.length + 16) return null;

  await connectMongoose();
  const hashed = hashKey(plaintext);
  // SHA-256 hex strings are constant-length, so equality on the indexed field
  // is fine. timingSafeEqual is overkill here (Mongo lookup is constant work
  // by hash), but doesn't hurt for the hot-path comparison.
  const doc = await ApiKeyModel.findOne({ hashedKey: hashed }).lean<ApiKeyDoc>();
  if (!doc) return null;
  if (doc.revokedAt) return null;
  if (
    !timingSafeEqual(Buffer.from(doc.hashedKey), Buffer.from(hashed))
  ) {
    return null;
  }
  // Fire-and-forget bump of lastUsedAt so we don't slow the request.
  ApiKeyModel.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } })
    .catch(() => {
      /* swallow — analytics field, not load-bearing */
    });
  return {
    apiKeyId: String(doc._id),
    userId: String(doc.userId),
    scopes: (doc.scopes ?? []) as ApiKeyScope[],
  };
}
