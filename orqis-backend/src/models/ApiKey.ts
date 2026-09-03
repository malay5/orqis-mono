import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Public API keys (Sprint 10). Format: or_live_<28 random base64url chars>.
 * Never stored plaintext — only the SHA-256 hash. The first 12 chars are
 * stored separately as a `prefix` for display ("or_live_aBcD…") so users
 * can identify which key is which without revealing the secret.
 *
 * The plaintext is only ever returned at create time, exactly once.
 */
const apiKeySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, required: true, maxlength: 80 },
    prefix: { type: String, required: true, maxlength: 24 }, // for display
    hashedKey: { type: String, required: true, unique: true, index: true },
    scopes: {
      type: [String],
      enum: ["read", "invoke"],
      default: ["read", "invoke"],
    },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export type ApiKeyDoc = InferSchemaType<typeof apiKeySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ApiKeyModel: Model<ApiKeyDoc> =
  (mongoose.models.ApiKey as Model<ApiKeyDoc>) ??
  mongoose.model<ApiKeyDoc>("ApiKey", apiKeySchema);
