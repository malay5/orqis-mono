import type { FastifyPluginAsync } from "fastify";
import { Types } from "mongoose";
import { connectMongoose } from "../../db/mongoose.js";
import { UserModel } from "../../models/User.js";
import { CreditTransactionModel } from "../../models/CreditTransaction.js";
import { grantCredits } from "../../platform/credit-mutations.js";
import { requireCaller } from "../../platform/caller.js";
import { CREDIT_PACKS, FAKE_PAYMENTS, findPack } from "../../platform/billing-config.js";

/**
 * Credit balance, ledger, and checkout (Sprint 19).
 *
 *   GET  /v1/credits            → balance + recent transactions
 *   GET  /v1/credits/packs      → purchasable packs (no auth; used to render pricing)
 *   POST /v1/credits/checkout   → buy a pack
 *
 * ⚠️ HACKATHON: while `FAKE_PAYMENTS` is true, checkout takes no payment. It
 * grants the pack's credits immediately and writes a ledger row marked as
 * simulated. No gateway, no order, no signature to verify — because nothing is
 * charged. See SCALING-TODO.md → P1 → "Payments — going live".
 */

const TX_PAGE_SIZE = 50;

export const platformCreditRoutes: FastifyPluginAsync = async (app) => {
  app.get("/credits/packs", async () => ({ packs: CREDIT_PACKS, simulated: FAKE_PAYMENTS }));

  app.get("/credits", { preHandler: requireCaller }, async (req, reply) => {
    const userId = req.caller!.userId;
    await connectMongoose();

    const user = await UserModel.findById(userId).select("creditBalance").lean();
    if (!user) return reply.code(404).send({ error: "Account no longer exists." });

    const txs = await CreditTransactionModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(TX_PAGE_SIZE)
      .lean();

    return reply.send({
      balance: user.creditBalance ?? 0,
      transactions: txs.map((t) => ({
        id: String(t._id),
        delta: t.delta,
        reason: t.reason,
        note: t.note ?? "",
        createdAt: t.createdAt,
      })),
    });
  });

  app.post("/credits/checkout", { preHandler: requireCaller }, async (req, reply) => {
    const userId = req.caller!.userId;
    const body = (req.body ?? {}) as { packId?: unknown };
    const packId = String(body.packId ?? "");
    const pack = findPack(packId);

    if (!pack) {
      return reply.code(400).send({
        error: `Unknown pack "${packId}". Pick one of: ${CREDIT_PACKS.map((p) => p.id).join(", ")}.`,
      });
    }

    if (!FAKE_PAYMENTS) {
      // Guard rail: if the flag is flipped without a gateway behind it, fail
      // loudly rather than silently handing out free credits.
      return reply.code(501).send({ error: "Payments are not configured on this deployment." });
    }

    const result = await grantCredits({
      userId,
      amount: pack.credits,
      reason: "purchase",
      note: `Simulated purchase — ${pack.label} pack ($${pack.usd}). No payment was taken.`,
    });

    return reply.send({
      ok: true,
      simulated: true,
      pack: { id: pack.id, label: pack.label, credits: pack.credits, usd: pack.usd },
      creditsAdded: pack.credits,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
    });
  });
};
