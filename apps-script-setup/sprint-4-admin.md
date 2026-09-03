# orqis — Sprint 4: admin allowlist

Sprint 4 introduces the `/admin` console (gated to specific Google accounts).
There's exactly one new env var to set.

## 1. Add yourself to `ADMIN_EMAILS`

In `orqis-frontend/.env.local`:

```bash
# Comma-separated list. Lower-cased automatically.
ADMIN_EMAILS=damanimalay@gmail.com
# Or multiple:
# ADMIN_EMAILS=you@gmail.com,cofounder@gmail.com
```

Restart `npm run dev`. Sign out and back in (the role is stamped onto the JWT
during the sign-in callback — you need a fresh token).

## 2. Visit /admin

Once your role is `admin`, you'll see:

- **/admin** — overview: total users, pending agent submissions, credits granted vs. spent.
- **/admin/users** — every user with role + balance + a grant-credits form (paste any email + amount + note → row written to the ledger, balance recomputed).
- **/admin/agents** — every submission from the public "List your agent" form, filterable by status (`new` / `reviewing` / `approved` / `rejected`). Click the buttons to transition each submission.

Non-admins who land on `/admin` get a 404 (we don't reveal that the route exists).

## 3. On Vercel

Add `ADMIN_EMAILS` in **Settings → Environment Variables**, same value as local.
Apply to **Production + Preview + Development**.

## How it works

- The `ADMIN_EMAILS` env var is parsed in `src/lib/auth.ts` on every sign-in. Listed emails get `role: "admin"` in the User document; previously-admin emails that drop off the list are demoted to `buyer` (never the other way around for sellers — they keep their role).
- All admin actions go through normal API routes (`/api/admin/grant-credits`, `/api/admin/agent-status`) which re-check `session.user.role === "admin"` server-side. The UI gating is just for ergonomics.
- Credit grants are written via the same `grantCredits()` helper as the signup bonus and (eventually) refunds, so the ledger stays the source of truth and `User.creditBalance` stays a recomputed cache.
