# subtitle-bot sidecar — FastAPI + faster-whisper, CPU only by default.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    WHISPER_DEVICE=cpu \
    WHISPER_COMPUTE=int8 \
    UVICORN_HOST=0.0.0.0 \
    UVICORN_PORT=5002

WORKDIR /app

# ffmpeg is required by faster-whisper to demux audio from MP4/MOV inputs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgomp1 \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

# Warm the default model (small, ~470 MB) into the image — saves a 1-2 min
# stall on the first transcription.
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

COPY main.py .

EXPOSE 5002
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5002"]
