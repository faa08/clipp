# Auto Clip 🎬

Paste a YouTube URL → get a 30-second MP4 clip, instantly.  
**100 % local** — no database, no login, no cloud.

---

## Project Structure

```
clip/
├── backend/
│   ├── main.py          ← FastAPI app (routes + static file server)
│   ├── downloader.py    ← yt-dlp wrapper
│   ├── clipper.py       ← MoviePy clip extractor
│   ├── requirements.txt
│   └── storage/
│       ├── videos/      ← raw downloaded videos (auto-created)
│       └── output/      ← generated clips (served at /clips/<file>)
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx     ← full UI
    │   └── globals.css
    └── next.config.ts
```

---

## Prerequisites

| Tool | Install |
|------|---------|
| Python 3.10+ | https://python.org |
| Node.js 18+ | https://nodejs.org |
| yt-dlp | `pip install yt-dlp` (or via winget / scoop) |
| FFmpeg | https://ffmpeg.org — **must be on PATH** |

> **FFmpeg is required** by both yt-dlp (for merging audio+video) and MoviePy.  
> Download a Windows build from https://github.com/BtbN/FFmpeg-Builds/releases,  
> extract it, and add the `bin/` folder to your system PATH.

---

## Setup & Run

### 1 — Backend

```powershell
cd clip\backend

# Create & activate virtual env (once)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies (once)
pip install -r requirements.txt

# Start the API server
uvicorn main:app --reload --port 8000
```


The API will be available at **http://localhost:8000**  
Swagger docs: **http://localhost:8000/docs**

### 2 — Frontend

Open a **second** terminal:

```powershell
cd clip\frontend

# Install Node deps (once)
npm install

# Start dev server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## How to use

1. Paste a YouTube URL into the input box.
2. Optionally adjust **Start (seconds)** and **Duration (seconds)**.
3. Click **✂ Generate Clip**.
4. Wait for the backend to download and clip the video (30–120 s typically).
5. A video player appears — watch the clip, then hit **Download**.

---

## API Reference

```
POST /generate-clip
Content-Type: application/json

{
  "url":        "https://www.youtube.com/watch?v=...",
  "start_time": 0,    // seconds into video (default 0)
  "duration":   30    // clip length in seconds (default 30)
}
```

Response:
```json
{
  "clip_url":  "http://localhost:8000/clips/clip_abc12345.mp4",
  "filename":  "clip_abc12345.mp4",
  "message":   "Clip generated successfully"
}
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `yt-dlp not found` | Install yt-dlp and make sure it's on PATH |
| `FFmpeg not found` | Add FFmpeg `bin/` to system PATH and restart terminal |
| `moviepy` errors | Ensure FFmpeg is installed; upgrade with `pip install --upgrade moviepy` |
| CORS error in browser | Make sure the FastAPI server is running on port 8000 |
| Video won't play | Some browsers need H.264 support — use Chrome or Edge |
