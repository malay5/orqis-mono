import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const reviewSchema = new Schema(
  {
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: "", maxlength: 120 },
    body: { type: String, default: "", maxlength: 4000 },
    // Flipped to true in Sprint 6 once we can confirm a real Invocation row exists.
    verifiedUse: { type: Boolean, default: false, index: true },

    // Snapshot of the user at write time so the review survives profile edits.
    authorName: { type: String, default: "" },
    authorImage: { type: String, default: "" },
  },
  { timestamps: true }
);

// One review per (agent, user) — re-submitting overwrites via upsert in the route.
reviewSchema.index({ agentId: 1, userId: 1 }, { unique: true });

export type ReviewDoc = InferSchemaType<typeof reviewSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ReviewModel: Model<ReviewDoc> =
  (mongoose.models.Review as Model<ReviewDoc>) ?? mongoose.model<ReviewDoc>("Review", reviewSchema);
