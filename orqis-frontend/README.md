# orqis frontend

The marketing landing page (and, eventually, the full marketplace UI) for
[orqis](https://orqis.xyz) — a marketplace for specialist AI agents.

This repo currently ships **Sprint 1** of a 12-week build plan: a stunning landing
page with two CTAs (**Join waitlist** / **List your agent**) backed by a Google
Sheets intake via Google Apps Script. Sprint 2 swaps the intake for a real backend
(see the sibling [`orqis-backend`](https://github.com/malay5/orqis-backend) repo).

## Stack

- **Next.js 16** (App Router) + **React 19.2**
- **TypeScript**
- **Tailwind CSS v4** (PostCSS-only, theme tokens via `@theme inline`)
- **Framer Motion** for hero animation, audience toggle, modal transitions
- **lucide-react** for icons
- Hand-rolled UI primitives in [`src/components/ui/`](./src/components/ui)
  (shadcn-flavoured, but no runtime dep — keeps install lean)

## Getting started

```bash
npm install
cp .env.example .env.local
# fill in APPS_SCRIPT_URL — see "Form intake" below
npm run dev          # http://localhost:3000
npm run build        # verify it compiles
```

### One-time external setup

The setup guides for the third-party services this repo talks to live **outside
this repo** (intentionally — keeps deployment URLs and account details local),
in the sibling [`../apps-script-setup/`](../apps-script-setup/) folder:

| File | What it covers |
| --- | --- |
| `README.md` | Sprint 1 — Google Apps Script + Sheet for the waitlist / list-agent intake. |
| `sprint-2-setup.md` | Sprint 2 — Local MongoDB and Google OAuth credentials. |
| `sprint-4-admin.md` | Sprint 4 — `ADMIN_EMAILS` allowlist for the `/admin` console. |
| `sprint-5-sellers.md` | Sprint 5 — `ENCRYPTION_KEY` for the seller listing flow. |
| `sprint-6-invocations.md` | Sprint 6 — running both apps + smoke-testing the invocation proxy via the `mock-echo` agent. |
| `sprint-7-landing-forge.md` | Sprint 7 — `ANTHROPIC_API_KEY` (or `mock`) for the in-house landing-forge agent. |
| `sprint-8-async.md` | Sprint 8 — async invocation runtime + the demo-forge agent + the new `/dashboard/jobs` page. |
| `sprint-9-agents.md` | Sprint 9 — resume-rx (sync) + course-quill (async) in-house agents. |
| `sprint-10-public-api.md` | Sprint 10 — poster-forge + public REST API (`/api/v1/*`) + the `@orqis/sdk` JS client. |
| `sprint-11-mcp-docs-analytics.md` | Sprint 11 — `@orqis/mcp` server + Scalar `/docs` + per-agent seller analytics. |
| `orqis-intake.gs` | Paste-into-Apps-Script source for the intake script. |

After working through those, fill the values into `.env.local` (template in
`.env.example`) and restart `npm run dev`.

Sprint 2 also adds a one-time DB seed:

```bash
npm run seed   # upserts the founding 8 agents into MongoDB
```

### Deploying to Vercel

The repo is wired for Vercel. After importing it:

1. Framework: Next.js (auto-detected). Defaults are fine.
2. **Settings → Environment Variables:** add `APPS_SCRIPT_URL` (and any later vars from `.env.example`). Apply to Production + Preview + Development.
3. **Settings → Domains:** add `orqis.xyz` (and `www.orqis.xyz` for the redirect).

## Project layout

```
src/
  app/
    layout.tsx          # fonts, metadata, OG tags
    page.tsx            # composes Hero + sections + modals
    globals.css         # Tailwind v4 theme + brand tokens + animations
    api/
      waitlist/route.ts     # POST → forwards to Apps Script
      list-agent/route.ts   # POST → forwards to Apps Script
  components/
    Logo.tsx, Header.tsx, Footer.tsx
    hero/
      Hero.tsx, AuroraBackground.tsx, TerminalDemo.tsx
    sections/
      CategoryMarquee.tsx, Bento.tsx, HowItWorks.tsx,
      AgentApi.tsx, Sellers.tsx, Faq.tsx, FinalCta.tsx
    modals/
      ModalShell.tsx, WaitlistModal.tsx, ListAgentModal.tsx
    ui/
      Button.tsx, Field.tsx
  lib/
    cn.ts               # className helper (clsx + tailwind-merge)
    apps-script.ts      # tiny client for the Apps Script Web App
public/
  logo-mark.svg, og-image.svg
```

(The Apps Script source + deployment guide live in the sibling
`apps-script-setup/` folder — kept out of git on purpose.)

## Brand

- **Background:** near-black (`#07070b`) with a soft indigo→violet aurora wash.
- **Primary gradient:** `#6366f1 → #a855f7` (indigo → violet).
- **Accent:** `#06b6d4` (cyan) for highlights and the "agent dot" in the logo.
- **Type:** Geist Sans for everything; Geist Mono for code/terminal blocks.

## Roadmap

Week-by-week plan (12 sprints) lives in the founder's planning docs. Highlights:

- **Sprint 1 (this)** — landing page + Apps Script intake
- **Sprint 2** — MongoDB + Google auth + browse-grid skeleton
- **Sprint 3** — agent detail pages + reviews + dashboard shell
- **Sprint 4** — credit ledger
- **Sprint 5** — seller submission flow (replaces the form)
- **Sprint 6** — invocation proxy + metering
- **Sprints 7–9** — three in-house agents (landing page gen, demo video gen, LaTeX coursework)
- **Sprint 10** — public REST search/invoke API + JS SDK
- **Sprint 11** — MCP server (`npx @orqis/mcp`)
- **Sprint 12** — polish + launch

## License

Private. All rights reserved.
