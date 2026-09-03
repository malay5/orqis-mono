# orqis — Sprint 5: seller flow

Sprint 5 ships the self-serve agent listing flow + the admin queue for it.
Two changes you have to make locally before it works.

## 1. Add `ENCRYPTION_KEY` to `.env.local`

Sellers' auth headers are encrypted at rest with AES-256-GCM (`lib/crypto-server.ts`).
The key is derived (SHA-256) from this env var, so any string ≥16 chars works.

```bash
# Pick one
openssl rand -base64 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Drop the result into `orqis-frontend/.env.local`:

```bash
ENCRYPTION_KEY=<paste it here>
```

> ⚠️ **Don't change this once sellers exist.** Rotating the key would invalidate
> every existing `authHeaderValueEnc`. Treat it like a database password. If you
> ever do need to rotate, write a one-shot migration that decrypts with the old
> key and re-encrypts with the new before flipping the env var.

Also add it to **Vercel → Settings → Environment Variables** (Production +
Preview + Development) before going live.

## 2. Restart `npm run dev`

The new env vars + new routes are picked up on restart. Once back up:

- **/sell** — public marketing page for agent builders. Links to the listing form.
- **/dashboard/agents/new** — five-step submission flow (basics → schema → endpoint → pricing → preview).
- **/dashboard/agents** — your own listings with status badges (pending / approved / rejected).
- **/admin/listings** — admin queue for seller-submitted Agent docs (separate from `/admin/agents` which still handles the Sprint-1 public-form `AgentSubmission` collection).

## What's intentionally deferred

- **Image uploads.** Screenshots are still typed as captions and rendered as
  styled mock tiles. R2 / signed-URL uploads land later. Existing seed agents
  already use this same shape, so nothing new for the UI.
- **Resend emails.** "Pending review" / "approved" notifications don't fire
  yet. The admin queue is the source of truth.
- **Edit after submit.** You can submit, but not yet edit. Resubmit a new
  listing if you need to change something for now.

## Smoke test

After restarting:

1. Sign in as a non-admin (or yourself if `ADMIN_EMAILS` is empty).
2. Go to **/dashboard/agents → List a new agent**, fill in the five steps with anything plausible (the endpoint URL just has to be a valid http(s) URL — it isn't called yet), submit.
3. Sign in as an admin (add your email to `ADMIN_EMAILS`, sign out + back in).
4. Open **/admin/listings** — your submission should be there with status `pending`. Click **Approve**.
5. Visit **/agents/<your-slug>** — it now renders the public detail page exactly like a seed agent.
6. Visit **/browse** — it shows up in the grid.
