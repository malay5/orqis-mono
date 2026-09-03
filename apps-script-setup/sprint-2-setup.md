# orqis — Sprint 2 setup (MongoDB + Google OAuth)

Companion to the Apps Script guide in this same folder. Walks you through the
two new things Sprint 2 adds to the **frontend** repo:

1. A local **MongoDB** the app reads & writes.
2. A **Google OAuth** client so people can sign in.

Once both are wired, the existing forms keep working *and* now also write to
Mongo, the `/browse` and `/agents/[slug]` pages render from the DB, and clicking
**Sign in** in the header lands you on the new `/signin` page.

---

## 1. Local MongoDB

Pick one path:

### A) Docker (easiest, no install)

```bash
docker run -d --name orqis-mongo -p 27017:27017 -v orqis-mongo-data:/data/db mongo:7
```

That's it. The connection URI is `mongodb://127.0.0.1:27017/orqis`.

To stop / start later:

```bash
docker stop orqis-mongo
docker start orqis-mongo
```

### B) Native install on Windows

1. Download the **MongoDB Community Server** MSI: <https://www.mongodb.com/try/download/community>.
2. Install with the default options. Tick **Install MongoDB as a Service** so it starts automatically.
3. Open a new shell and verify: `mongosh` → you should land in a Mongo prompt.
4. Optional: install **MongoDB Compass** (GUI) from the same downloads page.

The default URI is the same: `mongodb://127.0.0.1:27017/orqis` (the `orqis` database is created on first write).

### Wire it in

In `orqis-frontend/.env.local`:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/orqis
```

### Seed the catalogue

```bash
cd orqis-frontend
npm run seed
```

You should see one log line per seeded agent. Re-running is safe — the script
upserts rather than re-inserting. Open Compass (or `mongosh`) and confirm there
are 8 documents in the `agents` collection.

> **No Mongo running yet?** That's fine. `/browse` and `/agents/[slug]` both
> fall back to the in-code `SEED_AGENTS` list, so the UI still renders. You'll
> just see a small "Showing seed catalogue" banner on /browse until you wire Mongo up.

---

## 2. Google OAuth client (for Sign-in with Google)

NextAuth (Auth.js v5) handles the dance. You need an OAuth client ID + secret
from Google Cloud, plus a session secret for token signing.

### 2.1 Create the OAuth client

1. Go to <https://console.cloud.google.com/projectcreate> and create a project named **orqis** (or pick an existing one).
2. Under **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - App name: `orqis`. Support email: your email. Developer email: your email.
   - Save & continue. (You can skip scopes for now; defaults are fine.)
   - On the **Test users** step, add your own Google email so you can sign in while the app is unverified.
3. Under **APIs & Services → Credentials → + Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name: `orqis dev`.
   - **Authorized redirect URIs** (add both):
     - `http://localhost:3000/api/auth/callback/google`
     - `https://orqis.xyz/api/auth/callback/google` (only matters once you deploy)
   - Click **Create** and copy the **Client ID** and **Client secret**.

### 2.2 Generate a session secret

```bash
# any of these works — pick one
npx auth secret                    # Auth.js helper
openssl rand -base64 32            # OpenSSL
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the resulting string.

### 2.3 Wire it in

In `orqis-frontend/.env.local`:

```bash
AUTH_SECRET=<paste the secret you just generated>
AUTH_GOOGLE_ID=<the OAuth client ID from step 2.1>
AUTH_GOOGLE_SECRET=<the OAuth client secret from step 2.1>
```

Restart `npm run dev`. Go to <http://localhost:3000/signin>, click **Continue with Google**, accept the consent screen, and you should land at `/browse` with your avatar in the top right and **100 credits** showing in the dropdown.

### 2.4 Verify Mongo got the user

Open Compass (or `mongosh`):

```
use orqis
db.users.find()
db.credittransactions.find()
```

You should see one user document with `creditBalance: 100` and one credit
transaction with `delta: 100, reason: "signup_bonus"`.

---

## 3. On Vercel

When you deploy, set the same vars in **Project Settings → Environment Variables**:

- `APPS_SCRIPT_URL` (Sprint 1)
- `MONGODB_URI` — point this at MongoDB Atlas (free tier) when you go to prod, **not** the localhost URI.
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- `AUTH_URL=https://orqis.xyz` (helps NextAuth construct callback URLs in some hosting setups)

Add the prod redirect URI in Google Cloud Credentials too if you haven't yet:
`https://orqis.xyz/api/auth/callback/google`.

---

## Troubleshooting

**`MONGODB_URI is not set`** — populate `.env.local` and restart `npm run dev`.

**`MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`** — Mongo isn't running. Start the Docker container or the Windows service.

**Sign-in redirects back to `/signin` with no error** — check the dev terminal for `[auth.signIn] failed to upsert user`. Usually Mongo is unreachable.

**Sign-in says "Access blocked: This app's request is invalid"** — your redirect URI doesn't match what's registered in Google Cloud. Copy it character-for-character.

**`AUTH_SECRET` warnings in dev** — generate a real secret per step 2.2 and put it in `.env.local`. Don't ship without one.
