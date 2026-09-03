import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Append-only credit ledger. Real source of truth — User.creditBalance is a
 * denormalized cache that helpers in lib/credits-mutations.ts keep in sync.
 *
 * `idempotencyKey` is a sparse unique string used by chargeCredits to make
 * retries safe (e.g. an invocation proxy retrying after a transient error
 * shouldn't double-charge). Pass null/undefined for entries that don't need it.
 */
const creditTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    delta: { type: Number, required: true }, // signed: +grant, -charge
    reason: {
      type: String,
      // "purchase" = credits bought through checkout. During the hackathon
      // that checkout is simulated (billing-config.FAKE_PAYMENTS) — the ledger
      // row is real, the payment behind it is not.
      enum: ["signup_bonus", "admin_grant", "invocation", "refund", "purchase"],
      required: true,
      index: true,
    },
    invocationId: { type: Schema.Types.ObjectId, default: null, index: true },
    note: { type: String, default: "" },
    // No `index: true` here — the partial unique index below covers it.
    // Declaring both made Mongoose warn about a duplicate index definition.
    idempotencyKey: { type: String, default: null },
    grantedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null }, // admin grants
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Sparse so multiple docs with null/missing key are allowed; unique among those that do have one.
creditTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export type CreditTransactionDoc = InferSchemaType<typeof creditTransactionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CreditTransactionModel: Model<CreditTransactionDoc> =
  (mongoose.models.CreditTransaction as Model<CreditTransactionDoc>) ??
  mongoose.model<CreditTransactionDoc>("CreditTransaction", creditTransactionSchema);
