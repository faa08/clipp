FROM python:3.11-slim

# Install FFmpeg + yt-dlp dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first (layer caching)
COPY requirements.txt .

# Install torch CPU only (jauh lebih kecil dari CUDA, ~200MB vs 2GB)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install other dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Create storage directories
RUN mkdir -p storage/videos storage/output storage/audio storage/clips storage/downloads

EXPOSE 8000

# Render inject $PORT otomatis
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
