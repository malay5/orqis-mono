# bg-strip sidecar — FastAPI + rembg (U^2-Net), CPU only.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UVICORN_HOST=0.0.0.0 \
    UVICORN_PORT=5001

WORKDIR /app

# System deps for Pillow / onnxruntime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender1 \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

# Warm the default model into the image so the first /strip call doesn't
# stall on a ~170 MB download.
RUN python -c "from rembg import new_session; new_session('u2net')"

COPY main.py .

EXPOSE 5001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]
