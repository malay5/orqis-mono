"""
subtitle-bot sidecar — faster-whisper behind FastAPI.

Wire protocol matches orqis-backend/src/services/subtitle-bot.ts (runReal).
CPU-only by default; flip to CUDA by setting WHISPER_DEVICE=cuda + COMPUTE=float16
when the host has a GPU.
"""

from __future__ import annotations

import base64
import io
import os
import re
import tempfile
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from faster_whisper import WhisperModel

app = FastAPI(title="orqis-subtitle-bot")

_MODEL_CACHE: dict[str, WhisperModel] = {}
_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
_COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8" if _DEVICE == "cpu" else "float16")
_DATA_URL_RE = re.compile(r"^data:[^;]+;base64,(.+)$", re.IGNORECASE)


def _load(size: str) -> WhisperModel:
    if size not in _MODEL_CACHE:
        _MODEL_CACHE[size] = WhisperModel(size, device=_DEVICE, compute_type=_COMPUTE)
    return _MODEL_CACHE[size]


class TranscribeRequest(BaseModel):
    audioUrl: Optional[str] = None
    audioBase64: Optional[str] = None
    language: Optional[str] = Field(default=None, pattern=r"^[a-z]{2}$")
    model: str = "small"
    translateToEnglish: bool = False


class Segment(BaseModel):
    start: float
    end: float
    text: str


class TranscribeResponse(BaseModel):
    srt: str
    vtt: str
    language: str
    durationSec: float
    segments: list[Segment]
    modelUsed: str


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "orqis-subtitle-bot", "status": "ok"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(req: TranscribeRequest) -> TranscribeResponse:
    if not req.audioUrl and not req.audioBase64:
        raise HTTPException(400, "Either audioUrl or audioBase64 is required")
    if req.audioUrl and req.audioBase64:
        raise HTTPException(400, "Pass only one of audioUrl or audioBase64")
    if req.model not in {"tiny", "base", "small", "medium", "large"}:
        raise HTTPException(400, f"unsupported model: {req.model}")

    raw = await _resolve_audio(req)
    with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as f:
        f.write(raw)
        tmp_path = f.name

    try:
        whisper = _load(req.model)
        segments_iter, info = whisper.transcribe(
            tmp_path,
            language=req.language,
            task="translate" if req.translateToEnglish else "transcribe",
            beam_size=1,
            vad_filter=True,
        )
        segments = [
            Segment(start=float(s.start), end=float(s.end), text=s.text.strip())
            for s in segments_iter
        ]
        srt = _to_srt(segments)
        vtt = _to_vtt(segments)
        return TranscribeResponse(
            srt=srt,
            vtt=vtt,
            language=info.language or req.language or "auto",
            durationSec=float(info.duration or (segments[-1].end if segments else 0.0)),
            segments=segments,
            modelUsed=req.model,
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def _resolve_audio(req: TranscribeRequest) -> bytes:
    if req.audioBase64:
        m = _DATA_URL_RE.match(req.audioBase64)
        raw = base64.b64decode(m.group(1) if m else req.audioBase64)
        if not raw:
            raise HTTPException(400, "audioBase64 decoded to zero bytes")
        return raw
    assert req.audioUrl
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(req.audioUrl, follow_redirects=True)
        if r.status_code >= 400:
            raise HTTPException(502, f"audioUrl fetch failed: HTTP {r.status_code}")
        if len(r.content) > 200 * 1024 * 1024:
            raise HTTPException(400, "audio too large (max 200 MB)")
        return r.content


def _fmt_srt(seconds: float) -> str:
    s = max(0.0, seconds)
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = int(s % 60)
    ms = int(round((s - int(s)) * 1000))
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def _fmt_vtt(seconds: float) -> str:
    return _fmt_srt(seconds).replace(",", ".")


def _to_srt(segments: list[Segment]) -> str:
    return "\n".join(
        f"{i + 1}\n{_fmt_srt(s.start)} --> {_fmt_srt(s.end)}\n{s.text}\n"
        for i, s in enumerate(segments)
    )


def _to_vtt(segments: list[Segment]) -> str:
    body = "\n".join(
        f"{_fmt_vtt(s.start)} --> {_fmt_vtt(s.end)}\n{s.text}\n" for s in segments
    )
    return "WEBVTT\n\n" + body
