import { Types } from "mongoose";
import { connectMongoose } from "../db/mongoose.js";
import { UserModel } from "../models/User.js";
import {
  CreditTransactionModel,
  type CreditTransactionDoc,
} from "../models/CreditTransaction.js";

/**
 * Mutation helpers for the credit ledger. The ledger is the source of truth;
 * `User.creditBalance` is a cache that we recompute after every mutation by
 * summing the user's transactions. Cheap at our current scale; revisit when
 * a user might have >100k transactions.
 *
 * Idempotency: pass an `idempotencyKey` to make a charge/grant safe to retry.
 * Re-issuing the same key returns the existing transaction without charging twice.
 */

export class InsufficientCreditsError extends Error {
  constructor(public balance: number, public requested: number) {
    super(`Insufficient credits: balance ${balance}, requested ${requested}`);
    this.name = "InsufficientCreditsError";
  }
}

export type GrantInput = {
  userId: string;
  amount: number; // positive integer
  reason: Extract<
    CreditTransactionDoc["reason"],
    "signup_bonus" | "admin_grant" | "refund" | "purchase"
  >;
  note?: string;
  idempotencyKey?: string;
  grantedByUserId?: string;
  invocationId?: string;
};

export type ChargeInput = {
  userId: string;
  amount: number; // positive integer (we negate it here)
  reason: Extract<CreditTransactionDoc["reason"], "invocation">;
  invocationId?: string;
  note?: string;
  idempotencyKey?: string;
};

export type CreditMutationResult = {
  transactionId: string;
  delta: number;
  newBalance: number;
  alreadyApplied: boolean;
};

export async function recomputeBalanceFor(userId: Types.ObjectId): Promise<number> {
  const [agg] = await CreditTransactionModel.aggregate<{ _id: null; sum: number }>([
    { $match: { userId } },
    { $group: { _id: null, sum: { $sum: "$delta" } } },
  ]);
  const sum = agg?.sum ?? 0;
  // No more Math.max(0, sum) — a negative ledger means a bug (failed
  // compensation in chargeCredits, or a manual DB edit). Surface it loudly
  // rather than hide a payment-correctness defect.
  if (sum < 0) {
    console.error(
      `[credit-mutations] negative ledger for user ${String(userId)}: ${sum}. Investigate — a charge compensated incorrectly or the ledger was edited manually.`
    );
  }
  await UserModel.updateOne({ _id: userId }, { $set: { creditBalance: sum } });
  return sum;
}

async function findExistingByIdempotency(
  key: string | undefined
): Promise<CreditTransactionDoc | null> {
  if (!key) return null;
  return CreditTransactionModel.findOne({ idempotencyKey: key }).lean<CreditTransactionDoc>();
}

export async function grantCredits(input: GrantInput): Promise<CreditMutationResult> {
  // Sprint 18 (M5 fix): admin grants accept negative amounts (a deduction).
  // signup_bonus and refund must stay positive — those reasons have semantic
  // meaning the ledger reports rely on.
  if (!Number.isFinite(input.amount) || !Number.isInteger(input.amount) || input.amount === 0) {
    throw new Error("Grant amount must be a non-zero integer");
  }
  if (input.amount < 0 && input.reason !== "admin_grant") {
    throw new Error(`Negative amounts are only allowed for admin_grant; got ${input.reason}`);
  }
  if (!Types.ObjectId.isValid(input.userId)) throw new Error("Invalid userId");

  await connectMongoose();
  const userId = new Types.ObjectId(input.userId);

  const existing = await findExistingByIdempotency(input.idempotencyKey);
  if (existing) {
    const balance = (await UserModel.findById(userId).select("creditBalance").lean())
      ?.creditBalance ?? 0;
    return {
      transactionId: String(existing._id),
      delta: existing.delta,
      newBalance: balance,
      alreadyApplied: true,
    };
  }

  const created = await CreditTransactionModel.create({
    userId,
    delta: input.amount,
    reason: input.reason,
    note: input.note ?? "",
    idempotencyKey: input.idempotencyKey ?? null,
    grantedByUserId: input.grantedByUserId
      ? new Types.ObjectId(input.grantedByUserId)
      : null,
    invocationId: input.invocationId ? new Types.ObjectId(input.invocationId) : null,
  });

  const newBalance = await recomputeBalanceFor(userId);
  return {
    transactionId: String(created._id),
    delta: input.amount,
    newBalance,
    alreadyApplied: false,
  };
}

export async function chargeCredits(input: ChargeInput): Promise<CreditMutationResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0 || !Number.isInteger(input.amount)) {
    throw new Error("Charge amount must be a positive integer");
  }
  if (!Types.ObjectId.isValid(input.userId)) throw new Error("Invalid userId");

  await connectMongoose();
  const userId = new Types.ObjectId(input.userId);

  const existing = await findExistingByIdempotency(input.idempotencyKey);
  if (existing) {
    const balance = (await UserModel.findById(userId).select("creditBalance").lean())
      ?.creditBalance ?? 0;
    return {
      transactionId: String(existing._id),
      delta: existing.delta,
      newBalance: balance,
      alreadyApplied: true,
    };
  }

  // Atomically reserve credits. findOneAndUpdate combines the balance check
  // and the decrement into a single MongoDB op — no race window between the
  // predicate and the update, so two concurrent charges can't both pass.
  // Returns null when the predicate fails (insufficient funds).
  const reserved = await UserModel.findOneAndUpdate(
    { _id: userId, creditBalance: { $gte: input.amount } },
    { $inc: { creditBalance: -input.amount } },
    { returnDocument: "after" }
  ).select("creditBalance").lean();

  if (!reserved) {
    const current =
      (await UserModel.findById(userId).select("creditBalance").lean())?.creditBalance ?? 0;
    throw new InsufficientCreditsError(current, input.amount);
  }

  // Write the audit row. If this fails (e.g. idempotency-key collision from
  // a simultaneous duplicate request) we MUST compensate the $inc above —
  // otherwise we've debited without an audit, and the recomputeBalanceFor
  // will eventually overwrite the cache with a sum that doesn't match.
  let created;
  try {
    created = await CreditTransactionModel.create({
      userId,
      delta: -input.amount,
      reason: input.reason,
      invocationId: input.invocationId ? new Types.ObjectId(input.invocationId) : null,
      note: input.note ?? "",
      idempotencyKey: input.idempotencyKey ?? null,
    });
  } catch (err) {
    // Roll back the reservation.
    await UserModel.updateOne(
      { _id: userId },
      { $inc: { creditBalance: input.amount } }
    );
    // If the failure was an idempotency collision, another caller's
    // transaction already committed — return that one as alreadyApplied.
    const existingAfter = await findExistingByIdempotency(input.idempotencyKey);
    if (existingAfter) {
      const balance =
        (await UserModel.findById(userId).select("creditBalance").lean())?.creditBalance ?? 0;
      return {
        transactionId: String(existingAfter._id),
        delta: existingAfter.delta,
        newBalance: balance,
        alreadyApplied: true,
      };
    }
    throw err;
  }

  // recomputeBalanceFor re-derives the cache from the ledger. With the
  // atomic $inc above the cache is already correct, but the recompute
  // catches drift from any past bugs / manual edits — keep as a safety net.
  const newBalance = await recomputeBalanceFor(userId);
  return {
    transactionId: String(created._id),
    delta: -input.amount,
    newBalance,
    alreadyApplied: false,
  };
}

/**
 * Refund a previous charge — also tracked in the ledger. Idempotent.
 */
export async function refundInvocation(input: {
  userId: string;
  amount: number;
  invocationId: string;
  note?: string;
}): Promise<CreditMutationResult> {
  return grantCredits({
    userId: input.userId,
    amount: input.amount,
    reason: "refund",
    note: input.note ?? "Invocation failed",
    idempotencyKey: `refund:${input.invocationId}`,
    invocationId: input.invocationId,
  });
}
