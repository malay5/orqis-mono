# orqis — launch assets

Drafts for launch day. Not under git; mirror lives in `apps-script-setup/`-style sibling layout for easy retrieval. Edit freely; nothing here is auto-imported anywhere.

Files:

- `producthunt.md` — PH listing copy (tagline, description, first comment, gallery captions, maker bio)
- `hackernews.md` — HN "Show HN" post draft (title + body, FAQ-style follow-up answers)
- `twitter-thread.md` — launch X/Twitter thread (10 tweets) + LinkedIn variant
- `resend-waitlist.md` — Resend email blast to waitlist (subject + plain-text + React Email JSX outline)
- `checklist.md` — T-minus launch-day checklist (sequencing across PH, HN, social, email)

Pre-launch verification before you hit any of the buttons below:

```powershell
# orqis-frontend
cd orqis-frontend
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm run build
npx tsc --noEmit

# orqis-backend
cd ..\orqis-backend
npm run build

# orqis-sdk
cd ..\orqis-sdk
npm run build
node --loader tsx examples/sdk-smoke-test.ts

# orqis-mcp
cd ..\orqis-mcp
npm run build
node --loader tsx examples/mcp-smoke-test.ts
```

All five must be green. Then publish in this order:

1. Resend email (gives waitlist a 1-hour head start before public posts)
2. Twitter thread + LinkedIn cross-post
3. Product Hunt at 12:01 AM PT
4. Show HN around 8:30 AM PT (US morning)
