import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Logged "I'd like more credits" requests from the dashboard. We surface
 * these for admins to act on (manual grant via /admin/users for now).
 *
 * Real Resend email integration is deferred — this gives admins a queue
 * either way.
 */
const creditRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: "" },
    requestedAmount: { type: Number, default: 0, min: 0 },
    note: { type: String, default: "", maxlength: 1000 },
    status: {
      type: String,
      enum: ["new", "fulfilled", "declined"],
      default: "new",
      index: true,
    },
  },
  { timestamps: true }
);

export type CreditRequestDoc = InferSchemaType<typeof creditRequestSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CreditRequestModel: Model<CreditRequestDoc> =
  (mongoose.models.CreditRequest as Model<CreditRequestDoc>) ??
  mongoose.model<CreditRequestDoc>("CreditRequest", creditRequestSchema);
