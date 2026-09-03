# Launch day — sequencing checklist

All times PT.

## T-72h (3 days out)

- [ ] Final pass: every page on mobile + desktop, signed-out + signed-in
- [ ] Lighthouse on /, /browse, /agents/landing-forge, /docs (perf ≥ 90)
- [ ] Sentry: zero unresolved errors from last 24h
- [ ] DNS: orqis.xyz + www CNAMEs verified, SSL valid > 30d
- [ ] Postgres / Mongo backups verified — restore-tested once
- [ ] `npm run build` clean across orqis-frontend, orqis-backend, orqis-sdk, orqis-mcp
- [ ] @orqis/sdk smoke test green (9/9)
- [ ] @orqis/mcp smoke test green (8/8)
- [ ] Tag releases: orqis-frontend@v1.0.0, orqis-backend@v1.0.0, @orqis/sdk@1.0.0, @orqis/mcp@1.0.0

## T-48h

- [ ] Schedule Product Hunt for 12:01 AM PT launch date (PH timezone)
- [ ] Confirm two hunters lined up to upvote in first hour
- [ ] Schedule X/Twitter thread post for 7:00 AM PT
- [ ] Schedule LinkedIn post for 7:30 AM PT
- [ ] Resend audience updated from latest WaitlistEntry export
- [ ] Update README badges: build, npm version, license

## T-24h

- [ ] Final manual smoke: signup → 100 credits → invoke landing-forge → see refund logic isn't triggered
- [ ] Status page green: status.orqis.xyz (or upptime)
- [ ] Pin launch tweet draft + LinkedIn draft for one-click send
- [ ] Sleep early

## Launch day — minute-by-minute

- **00:01 PT** — Product Hunt goes live (auto-scheduled). Reply to first 3 comments within 30 min.
- **06:00 PT** — Send Resend waitlist blast (1-hour head start over public posts)
- **07:00 PT** — Twitter thread + pin
- **07:30 PT** — LinkedIn cross-post
- **08:30 PT** — Show HN (US morning peak)
- **09:00–18:00 PT** — Live in:
  - PH comments (every reply within 30 min)
  - HN comments (every reply within 1 hour, no defensive tone)
  - Twitter replies + DMs
  - LinkedIn DMs
- **18:00 PT** — Status check: PH rank, HN rank, signup count, MRR-equivalent (credits granted), top errors in Sentry
- **22:00 PT** — Thank-you tweet + DAU/signup screenshot

## T+24h

- [ ] Public retro thread: signups, agents listed, top traffic source, biggest surprise
- [ ] Email everyone who replied to the launch email with a personal follow-up
- [ ] File launch-day Sentry / Vercel / Railway billing damage
- [ ] Open Sprint 13 plan (Stripe + payouts? Or BYO-Docker?)
