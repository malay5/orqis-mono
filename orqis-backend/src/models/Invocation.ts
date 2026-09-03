import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per attempted invocation. Source of truth for usage analytics + the
 * Activity feed. We only store hashes/previews of payloads, not full bodies —
 * keeps the collection small and avoids accidentally indexing PII.
 */
const invocationSchema = new Schema(
  {
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    callerType: {
      type: String,
      enum: ["session", "api_key", "mcp"],
      default: "session",
      index: true,
    },
    creditsCharged: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    httpStatus: { type: Number, default: null },
    latencyMs: { type: Number, default: null },
    errorCode: { type: String, default: "" }, // short tag like "timeout", "upstream_5xx", "schema_invalid"
    errorMessage: { type: String, default: "" }, // human-readable
    requestBytes: { type: Number, default: 0 },
    responseBytes: { type: Number, default: 0 },
    requestHash: { type: String, default: "" }, // sha256 of canonical JSON, for dedupe analytics
    responsePreview: { type: String, default: "" }, // first ~512 chars of response body
    // ---- Async-only fields (Sprint 8) ----
    // For sync invocations these stay at their defaults.
    isAsync: { type: Boolean, default: false, index: true },
    result: { type: Schema.Types.Mixed, default: null }, // structured payload delivered via webhook
    completedAt: { type: Date, default: null }, // wall-clock when terminal status was set
    webhookSecretHash: { type: String, default: "" }, // sha256 of the secret we sent the seller; recomputed to verify callbacks
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

invocationSchema.index({ userId: 1, createdAt: -1 });
invocationSchema.index({ agentId: 1, createdAt: -1 });

export type InvocationDoc = InferSchemaType<typeof invocationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const InvocationModel: Model<InvocationDoc> =
  (mongoose.models.Invocation as Model<InvocationDoc>) ??
  mongoose.model<InvocationDoc>("Invocation", invocationSchema);
