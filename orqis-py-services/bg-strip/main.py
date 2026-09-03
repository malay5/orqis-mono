"""
bg-strip sidecar — rembg / U^2-Net behind a tiny FastAPI.

Wire protocol matches orqis-backend/src/services/bg-strip.ts (runReal).
"""

from __future__ import annotations

import base64
import io
import re
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image
from rembg import remove, new_session

app = FastAPI(title="orqis-bg-strip")

# rembg lazy-loads its model on first call per session. We pre-build one
# session per model so subsequent calls skip the lazy-load cost.
_SESSION_CACHE: dict[str, object] = {}


def _session(model: str) -> object:
    if model not in _SESSION_CACHE:
        _SESSION_CACHE[model] = new_session(model)
    return _SESSION_CACHE[model]


_DATA_URL_RE = re.compile(r"^data:image/[a-z0-9+]+;base64,(.+)$", re.IGNORECASE)
_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


class StripRequest(BaseModel):
    imageBase64: str = Field(min_length=1)
    model: str = Field(default="u2net")
    fillHex: Optional[str] = None


class StripResponse(BaseModel):
    pngBase64: str
    modelUsed: str


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "orqis-bg-strip", "status": "ok"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/strip", response_model=StripResponse)
def strip(req: StripRequest) -> StripResponse:
    if req.model not in {"u2net", "u2netp", "isnet-general-use", "silueta"}:
        raise HTTPException(400, f"unsupported model: {req.model}")
    if req.fillHex is not None and not _HEX_RE.match(req.fillHex):
        raise HTTPException(400, "fillHex must be #rrggbb")

    m = _DATA_URL_RE.match(req.imageBase64)
    raw = base64.b64decode(m.group(1) if m else req.imageBase64)
    if not raw:
        raise HTTPException(400, "imageBase64 decoded to zero bytes")
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(400, f"image too large: {len(raw)} bytes")

    try:
        src = Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"could not decode image: {e}") from e

    out = remove(src, session=_session(req.model))
    if not isinstance(out, Image.Image):
        out = Image.open(io.BytesIO(out))  # type: ignore[arg-type]

    if req.fillHex:
        bg = Image.new("RGBA", out.size, _parse_hex(req.fillHex))
        bg.paste(out, mask=out.split()[3])
        out = bg

    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return StripResponse(
        pngBase64=base64.b64encode(buf.getvalue()).decode("ascii"),
        modelUsed=req.model,
    )


def _parse_hex(hex_str: str) -> tuple[int, int, int, int]:
    return (
        int(hex_str[1:3], 16),
        int(hex_str[3:5], 16),
        int(hex_str[5:7], 16),
        255,
    )
