# orqis-py-services

Python sidecar services that back Tier B agents which can't run in-process
inside Node (rembg / faster-whisper). Sibling folder, NOT under git — same
convention as `apps-script-setup/` and `launch-assets/`.

The Node services in `orqis-backend/src/services/` proxy to these via HTTP
when their `*_PIPELINE=real` env var is set. Both sidecars are tiny FastAPI
apps; they exist mostly to host the heavy Python ML model in a process the
Node service can call into.

## Why a sidecar pattern at all

Two reasons:

1. **rembg** and **faster-whisper** are Python-only. Their model weights are
   100–500 MB and they pin specific torch / onnxruntime versions; running
   them inside the Node process would mean shipping a Docker image with a
   Python runtime *and* every ML wheel pre-installed. The sidecar isolates
   that footprint.

2. It's the **same shape** we'll need in Month 4 for seller-supplied Docker
   services (BYO-Docker). When sellers hand us a container, the orqis
   backend will talk to it the same way it talks to these sidecars: HTTP
   POST → JSON in / JSON out. Solving the pattern once for our in-house
   agents means we don't have to redesign it later for sellers.

## Layout

```
orqis-py-services/
  bg-strip/
    Dockerfile
    requirements.txt
    main.py            # FastAPI: POST /strip
  subtitle-bot/
    Dockerfile
    requirements.txt
    main.py            # FastAPI: POST /transcribe
```

## Local dev

```powershell
# bg-strip on :5001
cd orqis-py-services\bg-strip
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 5001

# in another shell, point orqis-backend at it
$env:BG_STRIP_PIPELINE = "real"
$env:BG_STRIP_SIDECAR_URL = "http://127.0.0.1:5001/strip"
cd orqis-backend
npm run dev
```

```powershell
# subtitle-bot on :5002
cd orqis-py-services\subtitle-bot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 5002

$env:WHISPER_PIPELINE = "real"
$env:WHISPER_SIDECAR_URL = "http://127.0.0.1:5002/transcribe"
```

## Production

Each sidecar gets its own Railway service. Set:

- `BG_STRIP_SIDECAR_URL` on the `orqis-backend` service → bg-strip Railway URL
- `WHISPER_SIDECAR_URL` on the `orqis-backend` service → subtitle-bot Railway URL

The Node services bake mock-mode fallbacks, so a sidecar outage degrades to
mock rather than 500s. We'll flip that to a hard failure once the sidecars
are stable.

## Wire protocol — bg-strip

```
POST /strip
{
  "imageBase64": "<base64>",
  "model": "u2net" | "u2netp" | "isnet-general-use" | "silueta",
  "fillHex": "#ffffff" | null
}
→ 200 OK
{
  "pngBase64": "<base64 png with alpha>",
  "modelUsed": "u2net"
}
```

## Wire protocol — subtitle-bot

```
POST /transcribe
{
  "audioUrl": "https://...",   // or audioBase64
  "audioBase64": null,
  "language": "en" | null,     // omit for auto-detect
  "model": "tiny" | "base" | "small" | "medium" | "large",
  "translateToEnglish": false
}
→ 200 OK
{
  "srt": "1\n00:00:00,000 --> ...",
  "vtt": "WEBVTT\n\n...",
  "language": "en",
  "durationSec": 32.4,
  "segments": [ { "start": 0, "end": 3.4, "text": "..." }, ... ],
  "modelUsed": "small"
}
```
