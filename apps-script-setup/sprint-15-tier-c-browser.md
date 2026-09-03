# orqis — Sprint 15: Tier C-A browser-dep agents (4)

Four specialist agents that wrap headless Chromium — directly competing
with categories where dedicated SaaS companies already monetize:

| Slug | Existing paid competitors | OSS wrapped | Mode | Price |
|---|---|---|---|---|
| `page-shot` | Urlbox, ScreenshotAPI.net, ScreenshotOne, Browserless | Playwright Chromium | sync | 2 |
| `pdf-render` | DocRaptor, PDFShift, PDFmonkey, HTML/CSS to PDF | Playwright Chromium | sync | 3 |
| `scrape-render` | ScrapingBee, ZenRows, Bright Data, Apify | Playwright Chromium | sync | 3 |
| `lighthouse-audit` | Treo, PageSpeed services, Speedlify | Lighthouse + chrome-launcher | sync | 4 |

This is the first sprint where the in-house catalogue has *direct,
named competitors* — every API in the table above is sold standalone today.
Orqis's pitch is bundled access at marketplace pricing, plus the same
listing being callable from MCP clients (Claude, Cursor).

## New backend deps

```powershell
cd orqis-backend
npm install --save playwright lighthouse chrome-launcher
npx playwright install chromium
```

The `npx playwright install chromium` step downloads ~170 MB of Chromium
into the Playwright cache (`%LOCALAPPDATA%\ms-playwright\` on Windows).
Required on every machine that runs the backend; **not** required for
`tsc`-only build verification.

`lighthouse` and `chrome-launcher` come bundled with the npm install. The
first lighthouse run will use the Playwright Chromium if `chrome-launcher`
finds it on PATH, or fall back to system Chrome. If neither is present,
`lighthouse-audit` will throw a 5xx — the validation path still works.

## New backend files

```
orqis-backend/src/
  lib/
    url-guard.ts             # ← new — hoisted SSRF helper (previously
                             #   duplicated across img-shrink / scrape-clean
                             #   / ocr-vision; new agents use this)
  services/
    page-shot.ts             # ← new (Playwright)
    pdf-render.ts            # ← new (Playwright page.pdf())
    scrape-render.ts         # ← new (Playwright + DOM evaluate)
    lighthouse-audit.ts      # ← new (lighthouse + chrome-launcher)
  routes/v1/
    tier-c-browser.ts        # ← new — single plugin, all 4 mounted
  scripts/
    smoke-tier-a-b.ts        # ← extended — added 4 new test cases
                             #   (page-shot + pdf-render run live;
                             #    scrape-render + lighthouse-audit
                             #    validation-only for determinism / speed)
```

## Verification

`npm run build` clean across backend + frontend. Smoke test passing 15/15
(11 from Sprints 13-14 + 4 from Sprint 15):

```
✓ page-shot (live)             [200]   825ms   real Playwright run against example.com
✓ pdf-render (live)            [200]   361ms   real page.pdf() against inline HTML
✓ scrape-render (validation)   [400]    0ms    rejects missing url
✓ lighthouse-audit (validation)[400]    0ms    rejects missing url
```

Run again with:

```powershell
cd orqis-backend
npx tsx scripts/smoke-tier-a-b.ts
```

## Notes on each agent

### page-shot

- Drops webp from `format` — Playwright only natively encodes png / jpeg.
  We can add webp via a sharp re-encode step later if there's demand.
- `hideAds: true` aborts the ~12 highest-traffic ad / analytics hosts via
  Playwright `route.abort()`. Not a full uBlock list; users who need that
  should run their own proxy with EasyList.
- Device shortcuts (`desktop`, `tablet`, `mobile`) preset viewport +
  isMobile + UA so single-arg "give me a phone screenshot" works.

### pdf-render

- Different stack from `doc-converter` (which goes through pandoc). pandoc
  is great for prose, lossy on CSS / fonts. pdf-render uses real Chromium,
  matches Chrome's Print → Save As PDF exactly.
- HTML input is capped at 8 MB.
- Page count is a heuristic (counts `/Type /Page` occurrences in the
  output stream, excluding `/Pages`). Off-by-a-few in pathological cases.
- Header / footer accept HTML snippets — use Chromium's magic span classes
  (`pageNumber`, `totalPages`, `date`) for dynamic values.

### scrape-render

- Companion to `scrape-clean`. scrape-clean uses static-fetch +
  `@extractus/article-extractor` — fine for blog posts, blind to anything
  rendered by client-side JS. scrape-render runs the page in real Chromium.
- Two extraction shortcuts so callers don't have to parse the full DOM:
  `extractText: true` (innerText of body) and `selectorMap` (CSS selector
  per key → matched text).
- DOM types aren't included in our tsconfig's `lib`, so the in-browser
  `page.evaluate(...)` callbacks declare minimal local shapes for
  `document.querySelector` / `querySelectorAll` rather than pull the whole
  DOM lib into server-side code.

### lighthouse-audit

- Slowest agent in the catalogue (~10-20s per run) because Lighthouse
  intentionally simulates slow 4G + CPU throttling to produce
  representative scores. Match expectations vs. PageSpeed Insights.
- Returns 4 category scores + 6 Core Web Vitals + network rollup + top-10
  perf opportunities + failed a11y audits (filtered to high-signal types).
- Lighthouse spawns its own Chromium via `chrome-launcher`. On Windows
  it'll prefer the Playwright install if present; otherwise it looks for
  system Chrome. CI / Docker hosts that don't have either will need a
  Chrome install step.

## What's still mocked vs. live

All 16 new agents (Tier A + Tier B + Tier C-A) run live with these
constraints:

| Sprint 13-15 agent | Real backend | Special install? |
|---|---|---|
| ocr-vision | Tesseract.js | First call downloads ~10 MB lang data |
| scrape-clean | @extractus/article-extractor | None |
| qr-toolkit | qrcode + jsqr | None |
| exif-clean | exifr + sharp | None |
| diagram-forge | nomnoml | None |
| csv-mage | PapaParse | None |
| tex-press | tectonic binary OR mock | `TEX_PIPELINE=real` + tectonic on PATH |
| doc-converter | pandoc binary OR mock | `PANDOC_PIPELINE=real` + pandoc on PATH |
| bg-strip | rembg Python sidecar OR mock | `BG_STRIP_PIPELINE=real` + sidecar URL |
| subtitle-bot | faster-whisper Python sidecar OR mock | `WHISPER_PIPELINE=real` + sidecar URL |
| page-shot | Playwright Chromium | `npx playwright install chromium` |
| pdf-render | Playwright Chromium | same |
| scrape-render | Playwright Chromium | same |
| lighthouse-audit | Lighthouse + chrome-launcher | Chrome/Chromium on PATH |

## In-house catalogue total: 20 agents

- **8** from Sprints 7-11 (founding AI generation + utilities)
- **6** from Sprint 13 — Tier A (native Node OSS wrappers)
- **4** from Sprint 14 — Tier B (binaries + Python sidecars)
- **4** from Sprint 15 — Tier C-A (Playwright / browser-dep)

Categories span AI generation, non-AI utility, academic, GTM, web, and
document. Solid seed for launch.

## Sprint 16 candidates (the next CPU-only batch)

Pure-Node validators / inspectors with paid-API competitors:

- `email-truth` (NeverBounce, ZeroBounce, Mailgun Validate)
- `dns-trace` (mxtoolbox, DNSChecker)
- `ssl-inspect` (SSL Labs, Hardenize)
- `og-card` (Microlink, Iframely, OpenGraph.io)
- `phone-truth` (Twilio Lookup, Numverify)
- `a11y-quick` (axe-core JSON report)

All ship without sidecars, all in a single sprint.
