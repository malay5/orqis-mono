# orqis — Apps Script intake setup

This is the kept-out-of-git pocket guide for wiring the Sprint 1 forms (waitlist
and "list your agent") to a Google Sheet via Google Apps Script.

The companion script lives next to this file: [`orqis-intake.gs`](./orqis-intake.gs).

> **Where this lives:** `d:/startups/agentic-shop-orchis/apps-script-setup/` —
> sibling of `orqis-frontend/` and `orqis-backend/`. Intentionally outside both
> repos so the `/exec` URL and any tweaks stay local.

---

## 0. Prerequisites

- A Google account (for the Sheet + Apps Script).
- The `orqis-frontend` repo cloned and able to run locally (`npm install && npm run dev`).

---

## 1. Create the spreadsheet

1. Go to <https://sheets.new>. A blank Sheet opens on your account.
2. Rename it: **`orqis — submissions`**.
3. The default tab is `Sheet1` — rename it to **`Waitlist`**.
4. Click **+** at the bottom and add a second tab named **`AgentSubmissions`**.

You don't need to add header rows — the script writes them on first run.

---

## 2. Create the Apps Script

1. In the spreadsheet, **Extensions → Apps Script**. A new editor tab opens.
2. Rename the project (top-left) to **`orqis-intake`**.
3. Delete the default `Code.gs` content.
4. Open [`orqis-intake.gs`](./orqis-intake.gs) (the file next to this README) and paste its **entire** contents into `Code.gs`.
5. Save (`Ctrl/Cmd+S`).

---

## 3. Deploy as a Web App

1. In the Apps Script editor, **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and pick **Web app**.
3. Fill in:
   - **Description:** `orqis intake v1`
   - **Execute as:** **Me** (your Google account)
   - **Who has access:** **Anyone**  ← required so the Next.js server can POST without auth.
4. Click **Deploy**. Google will ask you to authorize the script — accept the scopes.
5. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/AKfyc.../exec`).

> **Re-deploying after script edits:** Apps Script Web App URLs are tied to a
> *deployment version*. If you change `orqis-intake.gs` later, click **Deploy →
> Manage deployments → ✏️** on the existing deployment and pick **New version**
> so the URL keeps working.

---

## 4. Wire it into the frontend

In the `orqis-frontend` repo, open `.env.local` (create from `.env.example` if missing) and paste:

```bash
APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfyc.../exec
```

Restart `npm run dev`. Submit the waitlist form on <http://localhost:3000> — a new row should appear in the **Waitlist** tab almost immediately. Same for the **List your agent** form into **AgentSubmissions**.

For Vercel, set the same `APPS_SCRIPT_URL` env var in **Project Settings → Environment Variables** (apply to Production + Preview + Development).

---

## Troubleshooting

**Form returns "APPS_SCRIPT_URL is not set"**
You forgot to populate `.env.local` (or you're running the production build without
the env var set in Vercel). Restart the dev server after editing `.env.local`.

**Form returns 502 "Upstream Apps Script responded 401" / "302"**
Your Web App is not deployed with **Who has access: Anyone**. Re-deploy with that
setting.

**Rows aren't appearing in the Sheet**
Check the Apps Script editor → **Executions** sidebar (clock icon). You'll see each
POST and any errors thrown from `orqis-intake.gs`.

**I changed the script and now nothing works**
You need to deploy a new *version* (see §3). Updating the script alone doesn't update the live `/exec` URL.

---

## After Sprint 2

In Sprint 2 we add MongoDB and the Next.js routes start writing to both the
Sheet **and** Mongo (Sheet stays as a backup for one more sprint). After Sprint 3
the Sheet is decommissioned and this folder becomes a historical artifact you can
delete.
