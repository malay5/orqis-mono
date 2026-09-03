# orqis — Sprint 14: Tier B agents (4)

Specialist agents that wrap external binaries (tectonic, pandoc) or Python
ML libraries (rembg, faster-whisper). All four ship with mock mode so the
catalogue runs end-to-end without the heavy deps.

## Catalogue additions

| Slug | Backed by | Mode | Price | Real-mode requirement |
|---|---|---|---|---|
| `tex-press` | tectonic | sync | 5 | `tectonic` binary on PATH + `TEX_PIPELINE=real` |
| `doc-converter` | pandoc | sync | 3 | `pandoc` binary on PATH + `PANDOC_PIPELINE=real` |
| `bg-strip` | rembg (Python sidecar) | sync | 5 | `BG_STRIP_PIPELINE=real` + `BG_STRIP_SIDECAR_URL` |
| `subtitle-bot` | faster-whisper (Python sidecar) | **async** | 20 | `WHISPER_PIPELINE=real` + `WHISPER_SIDECAR_URL` |

All four flip to mock when their env var is absent. Mock outputs:

- **tex-press** → a hand-assembled 1-page PDF that embeds the document title
  parsed from `\title{…}`. Real PDF; valid; small.
- **doc-converter** → format-pair-specific stubs (e.g. md→html runs a tiny
  regex pass, md→latex wraps in `\documentclass{article}`). Good enough to
  exercise downstream UI but not fidelity.
- **bg-strip** → corner-pixel chroma key over the input image. Surprisingly
  decent on studio shots; predictably bad on complex backgrounds.
- **subtitle-bot** → 3-cue canned SRT after a 5-second simulated latency.
  Exercises the full async pipeline (charge → 202 ack → webhook → polling).

## New backend files

```
orqis-backend/src/
  services/
    tex-press.ts            # ← new (spawns tectonic, has mock-PDF generator)
    doc-converter.ts        # ← new (spawns pandoc, has per-format mock outputs)
    bg-strip.ts             # ← new (HTTP → Python sidecar, has Node mock)
    subtitle-bot.ts         # ← new (HTTP → Python sidecar, has Node mock)
  routes/v1/
    tier-b-agents.ts        # ← new — single plugin, all 4 mounted
  server.ts                 # ← registers makeTierBRoutes alongside Tier A
```

No new npm deps. Tier B uses only:

- `node:child_process` for spawning tectonic / pandoc
- `node:fs` + `node:os` + `node:crypto` for temp file shuffling
- the existing `sharp` install for raster pre-processing in bg-strip
- the existing `async-runner` lib for subtitle-bot's webhook pipeline

## Python sidecars (new sibling folder)

`orqis-py-services/` — same off-git convention as `apps-script-setup/` and
`launch-assets/`. Contains:

```
orqis-py-services/
  README.md              # protocol + dev + Railway notes
  bg-strip/
    Dockerfile
    requirements.txt
    main.py              # FastAPI POST /strip
  subtitle-bot/
    Dockerfile
    requirements.txt
    main.py              # FastAPI POST /transcribe
```

The Node-side mock falls back automatically when these sidecars are
unreachable (no env var set), so the catalogue keeps working in dev.

### Local sidecar dev

```powershell
# bg-strip (CPU-only rembg, ~170 MB model)
cd orqis-py-services\bg-strip
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 5001

# Then in the orqis-backend shell:
$env:BG_STRIP_PIPELINE = "real"
$env:BG_STRIP_SIDECAR_URL = "http://127.0.0.1:5001/strip"
```

```powershell
# subtitle-bot (CPU-only faster-whisper, ~470 MB 'small' model)
cd orqis-py-services\subtitle-bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 5002

$env:WHISPER_PIPELINE = "real"
$env:WHISPER_SIDECAR_URL = "http://127.0.0.1:5002/transcribe"
```

Both Dockerfiles pre-warm their default model at build time so the first
real call doesn't stall on a download.

## Local dev: binary install

For tex-press and doc-converter we shell out to two CLI binaries.

### tectonic

Windows (Scoop): `scoop install tectonic`. Or download a static build from
<https://tectonic-typesetting.github.io/en-US/install.html> and put it on
PATH. Confirm with `tectonic --version`. Then:

```powershell
$env:TEX_PIPELINE = "real"
```

### pandoc

Windows (Scoop): `scoop install pandoc`. Or the installer at
<https://pandoc.org/installing.html>. Confirm with `pandoc --version`. Then:

```powershell
$env:PANDOC_PIPELINE = "real"
```

Neither binary is required for builds or tests — the Node services flip to
mock if the env var is missing.

## Why a sidecar pattern at all

It's the same shape we'll need in Month 4 for seller-supplied Docker
services (BYO-Docker). When sellers hand us a container, the orqis backend
will talk to it the same way it talks to bg-strip / subtitle-bot today:
HTTP POST → JSON in / JSON out. Solving the pattern once for our in-house
agents now means we don't have to redesign it later.

## Verification

```powershell
cd orqis-backend
npm run build
# → tsc clean, no errors

cd ..\orqis-frontend
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm run build
# → all 4 new seed entries listed in /browse, individually accessible
```

Smoke-test a mock locally:

```powershell
# tex-press mock
$body = @{
  files = @(
    @{
      name = "main.tex"
      contentBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(
        '\documentclass{article}\title{hello orqis}\begin{document}body\end{document}'
      ))
    }
  )
  entrypoint = "main.tex"
} | ConvertTo-Json -Depth 4
curl -X POST http://localhost:4000/v1/agents/tex-press/run `
  -H "content-type: application/json" -d $body
```

## What's covered after Sprints 13 + 14

Total in-house agents: 16

- 8 from the original MVP (Sprints 7–11): landing-forge, demo-forge,
  course-quill, resume-rx, poster-forge, img-shrink, rng-uniform, sort-bench
- 6 from Sprint 13 (Tier A): ocr-vision, scrape-clean, qr-toolkit,
  exif-clean, diagram-forge, csv-mage
- 4 from Sprint 14 (Tier B): tex-press, doc-converter, bg-strip, subtitle-bot

Categories now spanning: AI generation (text, audio, video, image),
non-AI utility (image, audio, document, data, code), academic content,
GTM/sales tooling. That's a credible seed catalogue for launch.
