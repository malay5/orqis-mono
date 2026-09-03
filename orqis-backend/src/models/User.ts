import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: "" },
    image: { type: String, default: "" },
    role: { type: String, enum: ["buyer", "seller", "admin"], default: "buyer", index: true },
    // Cached from CreditTransaction ledger (real source of truth lands Sprint 4).
    creditBalance: { type: Number, default: 0, min: 0 },
    // Sprint 19: orqis's own email + password auth. scrypt hash produced by
    // lib/password.ts — never select this into anything user-facing.
    passwordHash: { type: String, default: "", select: false },
    // Legacy Google subject id. Retained so pre-Sprint-19 accounts keep their
    // identity link; new signups leave it empty.
    googleId: { type: String, default: "" },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const UserModel: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>("User", userSchema);
