/**
 * ⚠️ HACKATHON CONFIGURATION — NOT PRODUCTION ECONOMICS ⚠️
 *
 * Every constant in this file exists to make the demo work end-to-end without
 * a payment gateway, a KYC'd merchant account, or real money. Before orqis
 * takes a single real rupee, all of this has to be revisited — see the P1
 * "Payments — going live" section of SCALING-TODO.md.
 *
 * Specifically, for the hackathon:
 *
 *   1. Signup grants 5 credits (nominally $5) instead of the previous 100.
 *   2. `FAKE_PAYMENTS` is on: the "Make payment" button credits the account
 *      immediately with no gateway, no card, and no charge. There is no
 *      Razorpay call, no order, no signature verification — because there is
 *      no payment. Do not ship this flag enabled.
 *
 * When real payments land, `FAKE_PAYMENTS` flips to false and the checkout
 * route must create a Razorpay order and verify `razorpay_signature`
 * server-side before granting anything.
 */

/** Credits granted the first time an account is created. Hackathon: 5 (~$5). */
export const SIGNUP_BONUS_CREDITS = 5;

/** Nominal USD value of one credit. Hackathon: 1 credit = $1. */
export const USD_PER_CREDIT = 1;

/**
 * Master switch for the no-gateway checkout. MUST be false in production.
 * Kept as an explicit constant (not an env var) so it can't be turned on by
 * accident in a deployed environment.
 */
export const FAKE_PAYMENTS = true;

export type CreditPack = {
  id: string;
  credits: number;
  /** Display price. Never charged while FAKE_PAYMENTS is true. */
  usd: number;
  label: string;
  popular?: boolean;
};

export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: "starter", credits: 25, usd: 25, label: "Starter" },
  { id: "builder", credits: 100, usd: 100, label: "Builder", popular: true },
  { id: "scale", credits: 500, usd: 500, label: "Scale" },
];

export function findPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
