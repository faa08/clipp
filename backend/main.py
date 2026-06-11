import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from downloader import download_video, get_video_duration
from clipper import extract_clip

app = FastAPI(title="Auto Clip API")

# Allow the Next.js frontend (port 3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = os.path.dirname(__file__)
VIDEOS_DIR = os.path.join(BASE_DIR, "storage", "videos")
OUTPUT_DIR = os.path.join(BASE_DIR, "storage", "output")
os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Serve generated clips as static files at /clips/<filename>
app.mount("/clips", StaticFiles(directory=OUTPUT_DIR), name="clips")


class ClipRequest(BaseModel):
    url: str
    start_time: int = 0   # seconds into the video to start the clip
    duration: int = 30    # length of the clip in seconds


class ClipResponse(BaseModel):
    clip_url: str
    filename: str
    message: str


class VideoInfoResponse(BaseModel):
    duration: int
    message: str


@app.get("/")
def root():
    return {"status": "Auto Clip API is running"}


@app.get("/video-info", response_model=VideoInfoResponse)
def video_info(url: str):
    duration = get_video_duration(url)
    if not duration:
        raise HTTPException(status_code=400, detail="Failed to fetch video duration")

    return VideoInfoResponse(
        duration=duration,
        message="Video info fetched successfully",
    )


@app.post("/generate-clip", response_model=ClipResponse)
def generate_clip(req: ClipRequest):
    job_id = str(uuid.uuid4())[:8]

    # 1. Download only the required section of the video
    video_path = download_video(req.url, VIDEOS_DIR, job_id, req.start_time, req.duration)
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=500, detail="Failed to download video")

    # 2. Extract the clip
    output_filename = f"clip_{job_id}.mp4"
    output_path = os.path.join(OUTPUT_DIR, output_filename)
    success = extract_clip(video_path, output_path, req.start_time, req.duration)

    if not success or not os.path.exists(output_path):
        raise HTTPException(status_code=500, detail="Failed to extract clip")

    clip_url = f"http://localhost:8000/clips/{output_filename}"

    return ClipResponse(
        clip_url=clip_url,
        filename=output_filename,
        message="Clip generated successfully",
    )
