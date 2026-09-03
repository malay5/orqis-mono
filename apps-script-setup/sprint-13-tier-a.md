# orqis — Sprint 13: Tier A native agents (6)

Six new specialist agents, all pure-Node, all wrapping well-known OSS. No
new env vars, no AI keys, no Docker, no sidecar services. Each runs
in-process and produces output in <2 seconds (except first ocr-vision
call, which downloads ~10 MB of Tesseract language data and caches it).

## Catalogue additions

| Slug | OSS wrapped | Mode | Price | Output |
|---|---|---|---|---|
| `ocr-vision` | [tesseract.js](https://github.com/naptha/tesseract.js) | sync | 3 | `{ text, language, confidence, words[] }` |
| `scrape-clean` | [@extractus/article-extractor](https://github.com/extractus/article-extractor) + [turndown](https://github.com/mixmark-io/turndown) | sync | 2 | `{ title, byline, markdown, plaintext, wordCount }` |
| `qr-toolkit` | [qrcode](https://github.com/soldair/node-qrcode) + [jsqr](https://github.com/cozmo/jsQR) | sync | 1 | encode: `{ svg, previewUrl }`; decode: `{ text, payloadKind, parsed }` |
| `exif-clean` | [exifr](https://github.com/MikeKovarik/exifr) + sharp | sync | 1 | `{ previewUrl, removed: { hasExif, hasGps, camera, gps, … } }` |
| `diagram-forge` | [nomnoml](https://github.com/skanaar/nomnoml) | sync | 2 | `{ svg, previewUrl, width, height }` |
| `csv-mage` | [PapaParse](https://github.com/mholt/PapaParse) | sync | 1 | `{ format, output, columns[], rowsParsed, rowsOutput }` |

## New dependencies (orqis-backend)

```
tesseract.js
@extractus/article-extractor
turndown
qrcode
jsqr
exifr
nomnoml
papaparse
@types/turndown
@types/qrcode
@types/papaparse
```

Already installed in this sprint via:

```powershell
cd orqis-backend
npm install --save tesseract.js @extractus/article-extractor turndown qrcode jsqr exifr nomnoml papaparse
npm install --save-dev @types/turndown @types/qrcode @types/papaparse
```

## File layout

```
orqis-backend/src/
  services/
    ocr-vision.ts        # ← new
    scrape-clean.ts      # ← new
    qr-toolkit.ts        # ← new
    exif-clean.ts        # ← new
    diagram-forge.ts     # ← new
    csv-mage.ts          # ← new
  routes/v1/
    tier-a-agents.ts     # ← new — single plugin, 6 GET docstrings + 6 POST run handlers
  server.ts              # ← registers makeTierARoutes alongside existing routes

orqis-frontend/src/data/seed-agents.ts
  # 6 new seed entries appended at the bottom under a "Sprint 13" banner
```

All 6 services share the same patterns established in earlier sprints:

- Inputs accepted as either URL or base64 (where applicable).
- SSRF guard reused from `img-shrink.ts` (private/loopback/link-local DNS-resolved).
- Artifacts written to `STORAGE_R_DIR` (`orqis-backend/storage/r/`) and served at `/r/<id>.<ext>`.
- Errors classified into 400 (validation) vs 502 (upstream failure) by the route layer.

## First-call notes

- **ocr-vision** triggers a one-time download of the Tesseract language pack
  (~10 MB per language) to the OS temp dir on first use of each language code.
  Default `eng` is downloaded automatically; bilingual codes like `eng+jpn`
  download both. After the first call, subsequent calls are ~500 ms warm.
- **scrape-clean** uses a synthetic user-agent (`orqis-scrape-clean/0.1`).
  Some publishers serve different markup to unknown UAs — if extraction
  fails for a known URL, that's usually why.
- **qr-toolkit encode** writes the PNG to `/r/`; the SVG is also returned
  inline so callers can embed without a second fetch.
- **exif-clean** does NOT need `withMetadata()` calls — sharp encoders
  default to stripping every metadata segment, which is exactly what we want.
- **diagram-forge** ignores the style prelude if the user has already set
  their own `#fill: …` / `#stroke: …` directives at the top of `source`.
- **csv-mage** SQL output: `tableName` must match `^[a-zA-Z_][a-zA-Z0-9_]*$`
  (no quotes, no spaces). Identifier escaping happens automatically for column
  names that contain special characters.

## Verification

```powershell
cd orqis-backend
npm run build
# → tsc -p tsconfig.json, no errors

cd ..\orqis-frontend
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm run build
# → Next 16 build, all 6 seed entries surfaced in /browse and individually at
#   /agents/<slug>; sitemap.xml lists them
```

To smoke-test one live (with the backend running):

```powershell
curl -X POST http://localhost:4000/v1/agents/csv-mage/run `
  -H "content-type: application/json" `
  -d '{ "csv": "id,name\n1,Widget\n2,Gadget", "format": "json" }'
```

## What's not in this sprint

The Tier B agents from the same shortlist — `tex-press`, `doc-converter`,
`bg-strip`, `subtitle-bot` — need external binaries (tectonic, pandoc) or a
Python sidecar (rembg, faster-whisper) and are deferred to Sprint 14.
Picking them up is also the natural moment to formalise the seller-Docker
pattern we'll need anyway for the Month-4 BYO-Docker milestone.
