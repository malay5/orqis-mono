/**
 * Smoke test for the Sprint 19 platform API — the routes that moved out of
 * orqis-frontend when the frontend and backend were decoupled.
 *
 * Drives the Fastify app in-process via app.inject(), so no port is opened and
 * no `npm run dev` is needed. Needs a reachable MongoDB (MONGODB_URI) because
 * these routes are the data layer; agent smoke tests stay DB-free.
 *
 * Run:
 *   cd orqis-backend
 *   npm run smoke:platform
 *
 * Creates a throwaway user per run and deletes it (and its ledger rows) at the
 * end, so it's safe to run against a dev database repeatedly.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/server.js";
import { signJwt, verifyJwt } from "../src/platform/jwt.js";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

/** Minimal .env reader — the project has no dotenv dependency and doesn't need one. */
function loadDotEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  let raw: string;
  try {
    raw = readFileSync(resolve(here, "..", ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v && process.env[k] === undefined) process.env[k] = v;
  }
}

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, note = "", detail?: string): void {
  if (ok) {
    passed++;
    console.log(`  ${GREEN}✓${RESET}  ${name.padEnd(38)} ${DIM}${note}${RESET}`);
  } else {
    failed++;
    console.log(`  ${RED}✗${RESET}  ${name.padEnd(38)} ${DIM}${note}${RESET}`);
    if (detail) console.log(`     ${RED}${detail.slice(0, 300)}${RESET}`);
  }
}

async function main(): Promise<void> {
  loadDotEnv();

  if (!process.env.AUTH_SECRET?.trim()) {
    // Deterministic value so a developer without a .env can still run this.
    process.env.AUTH_SECRET = "smoke-test-secret-not-for-production-use";
    console.log(`${DIM}AUTH_SECRET not set — using a throwaway test value.${RESET}`);
  }
  if (!process.env.MONGODB_URI?.trim()) {
    console.log(
      `\n${YELLOW}MONGODB_URI is not set — the platform API needs a database.${RESET}\n\n` +
        `  Start Mongo and set it in orqis-backend/.env:\n\n` +
        `    MONGODB_URI=mongodb://127.0.0.1:27017/orqis\n`
    );
    return;
  }

  console.log(`\n${YELLOW}orqis — platform API smoke (Sprint 19)${RESET}\n`);

  // ── JWT unit checks (no app, no DB) ──────────────────────────────
  console.log(`${YELLOW}JWT${RESET}`);
  const token = signJwt({ sub: "abc123", email: "a@b.com", role: "buyer" });
  const verified = verifyJwt(token);
  check("signs and verifies", verified.ok && verified.payload.sub === "abc123");

  const tampered = token.slice(0, -3) + (token.slice(-3) === "aaa" ? "bbb" : "aaa");
  const tamperedResult = verifyJwt(tampered);
  check(
    "rejects a tampered signature",
    !tamperedResult.ok && tamperedResult.reason === "bad_signature",
    !tamperedResult.ok ? tamperedResult.reason : "accepted it"
  );

  // alg:none is the classic JWT attack — we hardcode HS256 and never read
  // `alg` from the token, so this must be refused.
  const [, body] = token.split(".");
  const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }))
    .toString("base64url");
  const algNone = verifyJwt(`${noneHeader}.${body}.`);
  check("rejects alg:none", !algNone.ok, !algNone.ok ? algNone.reason : "ACCEPTED — vulnerable");

  const expired = signJwt({ sub: "x", email: "a@b.com", role: "buyer" }, -10);
  const expiredResult = verifyJwt(expired);
  check(
    "rejects an expired token",
    !expiredResult.ok && expiredResult.reason === "expired",
    !expiredResult.ok ? expiredResult.reason : "accepted it"
  );

  // ── HTTP checks ──────────────────────────────────────────────────
  const app: FastifyInstance = await buildApp({ logger: false });
  const email = `smoke-${Date.now()}@orqis.test`;
  const password = "smoke-test-password";
  let jwt = "";
  let userId = "";

  try {
    console.log(`\n${YELLOW}Auth${RESET}`);

    const reg = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password, name: "Smoke Test" },
    });
    const regBody = reg.json() as {
      token?: string;
      user?: { id: string; creditBalance: number; role: string };
    };
    check("register", reg.statusCode === 201 && !!regBody.token, `[${reg.statusCode}]`, reg.body);
    jwt = regBody.token ?? "";
    userId = regBody.user?.id ?? "";
    check(
      "signup grant applied",
      regBody.user?.creditBalance === 5,
      `balance ${regBody.user?.creditBalance}`
    );

    const dup = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password },
    });
    check("duplicate email rejected", dup.statusCode === 409, `[${dup.statusCode}]`);

    const weak = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: `x${Date.now()}@orqis.test`, password: "short" },
    });
    check("short password rejected", weak.statusCode === 400, `[${weak.statusCode}]`);

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password },
    });
    check("login", login.statusCode === 200 && !!(login.json() as { token?: string }).token, `[${login.statusCode}]`);

    const badLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: "wrong-password" },
    });
    check("wrong password rejected", badLogin.statusCode === 401, `[${badLogin.statusCode}]`);

    const unknownUser = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "nobody@orqis.test", password: "whatever" },
    });
    check(
      "no user enumeration",
      unknownUser.statusCode === badLogin.statusCode &&
        unknownUser.body === badLogin.body,
      "unknown user and wrong password respond identically"
    );

    const me = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${jwt}` },
    });
    check("me (with token)", me.statusCode === 200, `[${me.statusCode}]`);

    const meNoAuth = await app.inject({ method: "GET", url: "/v1/auth/me" });
    check("me (no token) → 401", meNoAuth.statusCode === 401, `[${meNoAuth.statusCode}]`);

    // ── Credits ────────────────────────────────────────────────────
    console.log(`\n${YELLOW}Credits${RESET}`);

    const credits = await app.inject({
      method: "GET",
      url: "/v1/credits",
      headers: { authorization: `Bearer ${jwt}` },
    });
    const creditsBody = credits.json() as {
      balance?: number;
      transactions?: Array<{ reason: string; delta: number }>;
    };
    check("balance", creditsBody.balance === 5, `balance ${creditsBody.balance}`);
    check(
      "signup row on the ledger",
      creditsBody.transactions?.[0]?.reason === "signup_bonus",
      `${creditsBody.transactions?.length} row(s)`
    );

    const packs = await app.inject({ method: "GET", url: "/v1/credits/packs" });
    check("packs listed", packs.statusCode === 200, `[${packs.statusCode}]`);

    const checkout = await app.inject({
      method: "POST",
      url: "/v1/credits/checkout",
      headers: { authorization: `Bearer ${jwt}` },
      payload: { packId: "starter" },
    });
    const checkoutBody = checkout.json() as { newBalance?: number; simulated?: boolean };
    check(
      "checkout grants credits",
      checkout.statusCode === 200 && checkoutBody.newBalance === 30,
      `balance ${checkoutBody.newBalance}`,
      checkout.body
    );
    check("checkout marked simulated", checkoutBody.simulated === true);

    const badPack = await app.inject({
      method: "POST",
      url: "/v1/credits/checkout",
      headers: { authorization: `Bearer ${jwt}` },
      payload: { packId: "not-a-pack" },
    });
    check("unknown pack rejected", badPack.statusCode === 400, `[${badPack.statusCode}]`);

    const anonCheckout = await app.inject({
      method: "POST",
      url: "/v1/credits/checkout",
      payload: { packId: "starter" },
    });
    check("checkout needs auth", anonCheckout.statusCode === 401, `[${anonCheckout.statusCode}]`);

    // ── Catalogue ──────────────────────────────────────────────────
    console.log(`\n${YELLOW}Catalogue${RESET}`);

    const list = await app.inject({ method: "GET", url: "/v1/catalog/agents" });
    const listBody = list.json() as { count?: number; agents?: Array<Record<string, unknown>> };
    check("list agents", list.statusCode === 200 && (listBody.count ?? 0) > 0, `${listBody.count} agents`);

    const leaks = (listBody.agents ?? []).filter(
      (a) => "endpointUrl" in a || "authHeaderValueEnc" in a
    );
    check(
      "endpointUrl not exposed",
      leaks.length === 0,
      leaks.length ? `${leaks.length} agents leaked it` : "no seller endpoints in the payload"
    );

    const search = await app.inject({ method: "GET", url: "/v1/catalog/agents?q=chat" });
    check("search filters", (search.json() as { count: number }).count > 0, `q=chat`);

    const one = await app.inject({ method: "GET", url: "/v1/catalog/agents/budget-chat" });
    check("agent detail", one.statusCode === 200, `[${one.statusCode}]`);

    const missing = await app.inject({ method: "GET", url: "/v1/catalog/agents/nope-not-real" });
    check("unknown slug → 404", missing.statusCode === 404, `[${missing.statusCode}]`);

    const cats = await app.inject({ method: "GET", url: "/v1/catalog/categories" });
    check("categories", cats.statusCode === 200, `[${cats.statusCode}]`);

    // ── API keys ───────────────────────────────────────────────────
    console.log(`\n${YELLOW}API keys${RESET}`);

    const mint = await app.inject({
      method: "POST",
      url: "/v1/keys",
      headers: { authorization: `Bearer ${jwt}` },
      payload: { label: "smoke", scopes: ["read", "invoke"] },
    });
    const mintBody = mint.json() as { key?: { plaintext?: string; id?: string } };
    const apiKey = mintBody.key?.plaintext ?? "";
    check("mint key", mint.statusCode === 200 && apiKey.startsWith("or_live_"), `[${mint.statusCode}]`, mint.body);

    const listKeys = await app.inject({
      method: "GET",
      url: "/v1/keys",
      headers: { authorization: `Bearer ${jwt}` },
    });
    const keyRows = (listKeys.json() as { keys?: Array<Record<string, unknown>> }).keys ?? [];
    check("list keys", keyRows.length === 1, `${keyRows.length} key(s)`);
    check(
      "secret never returned by list",
      keyRows.every((k) => !("plaintext" in k) && !("hashedKey" in k)),
      "only prefix + metadata"
    );

    // The key must authenticate as the same user...
    const keyMe = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${apiKey}` },
    });
    const keyMeBody = keyMe.json() as { callerType?: string; user?: { id?: string } };
    check(
      "api key authenticates",
      keyMe.statusCode === 200 && keyMeBody.callerType === "api_key" && keyMeBody.user?.id === userId,
      `callerType ${keyMeBody.callerType}`
    );

    // ...but must NOT be able to mint more keys (privilege escalation).
    const keyMintsKey = await app.inject({
      method: "POST",
      url: "/v1/keys",
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { label: "escalation" },
    });
    check(
      "api key cannot mint keys",
      keyMintsKey.statusCode === 403,
      `[${keyMintsKey.statusCode}]`
    );

    const badKey = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: "Bearer or_live_totallyfakekeyvalue000000000" },
    });
    check("bogus key rejected", badKey.statusCode === 401, `[${badKey.statusCode}]`);

    // ── Invocation proxy ───────────────────────────────────────────
    console.log(`\n${YELLOW}Invocation proxy${RESET}`);

    const anonInvoke = await app.inject({
      method: "POST",
      url: "/v1/invoke/budget-chat",
      payload: { messages: [{ role: "user", content: "hi" }] },
    });
    check("invoke needs auth", anonInvoke.statusCode === 401, `[${anonInvoke.statusCode}]`);

    const noSuchAgent = await app.inject({
      method: "POST",
      url: "/v1/invoke/does-not-exist",
      headers: { authorization: `Bearer ${jwt}` },
      payload: {},
    });
    check("unknown agent → 404", noSuchAgent.statusCode === 404, `[${noSuchAgent.statusCode}]`);

    const badInput = await app.inject({
      method: "POST",
      url: "/v1/invoke/email-truth",
      headers: { authorization: `Bearer ${jwt}` },
      payload: { notAnEmail: true },
    });
    check("schema violation → 400", badInput.statusCode === 400, `[${badInput.statusCode}]`);

    const balanceBefore = (
      (
        await app.inject({
          method: "GET",
          url: "/v1/credits",
          headers: { authorization: `Bearer ${jwt}` },
        })
      ).json() as { balance: number }
    ).balance;
    check("no charge for rejected input", balanceBefore === 30, `balance ${balanceBefore}`);

    // Real end-to-end invocation. Needs the agent host reachable; skipped
    // gracefully if it isn't, so this script stays runnable standalone.
    const invoke = await app.inject({
      method: "POST",
      url: "/v1/invoke/email-truth",
      headers: { authorization: `Bearer ${jwt}` },
      payload: { email: "test@mailinator.com" },
    });
    const invokeBody = invoke.json() as {
      ok?: boolean;
      creditsCharged?: number;
      newBalance?: number;
      error?: string;
    };
    if (invoke.statusCode === 200) {
      check("invoke succeeds", invokeBody.ok === true, `charged ${invokeBody.creditsCharged}`);
      check(
        "credits debited",
        invokeBody.newBalance === balanceBefore - (invokeBody.creditsCharged ?? 0),
        `balance ${invokeBody.newBalance}`
      );

      const mockInvoke = await app.inject({
        method: "POST",
        url: "/v1/invoke/budget-chat",
        headers: { authorization: `Bearer ${jwt}` },
        payload: { messages: [{ role: "user", content: "hi" }], maxTokens: 16 },
      });
      const mockBody = mockInvoke.json() as { creditsCharged?: number; result?: { mode?: string } };
      check(
        "mock response is rebated to 0",
        mockInvoke.statusCode === 200 && mockBody.creditsCharged === 0,
        `charged ${mockBody.creditsCharged}, mode ${mockBody.result?.mode}`
      );

      const activity = await app.inject({
        method: "GET",
        url: "/v1/activity",
        headers: { authorization: `Bearer ${jwt}` },
      });
      check(
        "activity feed records it",
        ((activity.json() as { count?: number }).count ?? 0) >= 2,
        `${(activity.json() as { count?: number }).count} rows`
      );
    } else {
      console.log(
        `${DIM}     agent host unreachable (${invokeBody.error ?? invoke.statusCode}) — ` +
          `skipping live invocation checks. Start orqis-backend's agent routes ` +
          `and ensure seed endpointUrls resolve.${RESET}`
      );
    }

    // ── Reviews + intake ───────────────────────────────────────────
    console.log(`\n${YELLOW}Reviews, intake, admin${RESET}`);

    const postReview = await app.inject({
      method: "POST",
      url: "/v1/agents/email-truth/reviews",
      headers: { authorization: `Bearer ${jwt}` },
      payload: { rating: 5, title: "Solid", body: "Works well." },
    });
    check("post review", postReview.statusCode === 200, `[${postReview.statusCode}]`);

    const badReview = await app.inject({
      method: "POST",
      url: "/v1/agents/email-truth/reviews",
      headers: { authorization: `Bearer ${jwt}` },
      payload: { rating: 9 },
    });
    check("rating out of range → 400", badReview.statusCode === 400, `[${badReview.statusCode}]`);

    const listReviews = await app.inject({ method: "GET", url: "/v1/agents/email-truth/reviews" });
    check(
      "list reviews (public)",
      listReviews.statusCode === 200 && ((listReviews.json() as { count: number }).count ?? 0) >= 1,
      `[${listReviews.statusCode}]`
    );

    const listAgent = await app.inject({
      method: "POST",
      url: "/v1/list-agent",
      payload: {
        contactEmail: `seller-${Date.now()}@orqis.test`,
        agentName: "Smoke Agent",
        description: "A test submission.",
      },
    });
    check("seller intake", listAgent.statusCode === 201, `[${listAgent.statusCode}]`);

    const badIntake = await app.inject({
      method: "POST",
      url: "/v1/list-agent",
      payload: { contactEmail: "not-an-email", agentName: "x", description: "y" },
    });
    check("seller intake validates email", badIntake.statusCode === 400, `[${badIntake.statusCode}]`);

    // Admin routes must reject a non-admin caller.
    const adminAsBuyer = await app.inject({
      method: "GET",
      url: "/v1/admin/users",
      headers: { authorization: `Bearer ${jwt}` },
    });
    check("admin route blocks buyer", adminAsBuyer.statusCode === 403, `[${adminAsBuyer.statusCode}]`);

    const adminAnon = await app.inject({ method: "GET", url: "/v1/admin/users" });
    check("admin route blocks anon", adminAnon.statusCode === 401, `[${adminAnon.statusCode}]`);

    // ── Jobs ───────────────────────────────────────────────────────
    console.log(`\n${YELLOW}Jobs + webhook${RESET}`);

    const jobs = await app.inject({
      method: "GET",
      url: "/v1/jobs",
      headers: { authorization: `Bearer ${jwt}` },
    });
    check("jobs list", jobs.statusCode === 200, `[${jobs.statusCode}]`);

    const badWebhook = await app.inject({
      method: "POST",
      url: `/v1/webhooks/jobs/${new mongoose.Types.ObjectId().toString()}`,
      headers: { "x-orqis-webhook-secret": "nope" },
      payload: { ok: true },
    });
    check("webhook unknown job → 404", badWebhook.statusCode === 404, `[${badWebhook.statusCode}]`);

    const malformedWebhook = await app.inject({
      method: "POST",
      url: "/v1/webhooks/jobs/not-an-object-id",
      payload: { ok: true },
    });
    check(
      "webhook bad id → 400",
      malformedWebhook.statusCode === 400,
      `[${malformedWebhook.statusCode}]`
    );
  } finally {
    // Clean up the throwaway account so repeat runs don't accumulate users.
    if (userId) {
      try {
        const db = mongoose.connection.db;
        if (db) {
          const oid = new mongoose.Types.ObjectId(userId);
          await db.collection("credittransactions").deleteMany({ userId: oid });
          await db.collection("invocations").deleteMany({ userId: oid });
          await db.collection("reviews").deleteMany({ userId: oid });
          await db.collection("apikeys").deleteMany({ userId: oid });
          await db.collection("users").deleteOne({ _id: oid });
        }
      } catch (err) {
        console.log(`${DIM}cleanup failed: ${String(err)}${RESET}`);
      }
    }
    await app.close();
    await mongoose.disconnect();
  }

  const colour = failed ? RED : GREEN;
  console.log(`\n${colour}${passed} passed, ${failed} failed${RESET}\n`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`${RED}fatal:${RESET}`, err);
  process.exitCode = 1;
});
