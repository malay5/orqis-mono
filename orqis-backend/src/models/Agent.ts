import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const agentSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true },
    tagline: { type: String, required: true },
    description: { type: String, default: "" },
    longDescription: { type: String, default: "" }, // multi-paragraph plain text
    category: { type: String, required: true, index: true },
    tags: { type: [String], default: [], index: true },
    iconEmoji: { type: String, default: "" },
    accentHex: { type: String, default: "#a855f7" },
    screenshots: { type: [String], default: [] }, // captions, rendered as gradient mocks for now
    pricePerCall: { type: Number, required: true, min: 0 }, // credits
    isAsync: { type: Boolean, default: false },

    // Schemas — stored as opaque objects; validated against Ajv in Sprint 6.
    inputSchema: { type: Schema.Types.Mixed, default: null },
    outputSchema: { type: Schema.Types.Mixed, default: null },
    exampleRequest: { type: Schema.Types.Mixed, default: null },
    exampleResponse: { type: Schema.Types.Mixed, default: null },

    // Seller / endpoint — kept optional for seed agents; required when sellerId is set.
    sellerId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    endpointUrl: { type: String, default: "" },
    // Auth header injected on every invocation. authHeaderValueEnc is AES-256-GCM
    // ciphertext via lib/crypto-server.ts — plaintext never round-trips back to clients.
    authHeaderName: { type: String, default: "" },
    authHeaderValueEnc: { type: String, default: "" },

    // Aggregates — denormalized, recomputed on Review write.
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    invocationCount: { type: Number, default: 0, min: 0 },

    // Sprint 18 (LOW fix): default was "approved" → any agent inserted via
    // any code path bypassed admin review. New rows now default to "pending";
    // the seed script and admin approve flow set status: "approved" explicitly.
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    publishedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

agentSchema.index({ name: "text", tagline: "text", description: "text", tags: "text" });

export type AgentDoc = InferSchemaType<typeof agentSchema> & { _id: mongoose.Types.ObjectId };

export const AgentModel: Model<AgentDoc> =
  (mongoose.models.Agent as Model<AgentDoc>) ?? mongoose.model<AgentDoc>("Agent", agentSchema);
