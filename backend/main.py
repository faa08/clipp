import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from downloader import download_video, get_video_duration
from clipper import extract_clip
from subtitler import burn_subtitles, transcribe_audio
from captioner import generate_all_captions
from highlighter import get_highlights

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
    start_time: int = 0
    duration: int = 30
    add_subtitle: bool = False
    subtitle_style: str = "mozi"  # "beasty" | "youshaei" | "mozi"


class ClipResponse(BaseModel):
    clip_url: str
    filename: str
    message: str
    transcript: str = ""   # whisper transcript, available when add_subtitle=True


class HighlightClip(BaseModel):
    start_time: int
    start_label: str
    duration: int
    title: str
    reason: str


class HighlightResponse(BaseModel):
    clips: list[HighlightClip]
    error: str | None = None
    transcript_source: str = "youtube"  # "youtube" or "whisper"


class CaptionResponse(BaseModel):
    instagram: str
    tiktok: str
    youtube: str


class CaptionRequest(BaseModel):
    transcript: str


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

    # 3. Optionally burn subtitles + capture transcript
    transcript = ""
    if req.add_subtitle:
        subtitled_filename = f"clip_{job_id}_sub.mp4"
        subtitled_path = os.path.join(OUTPUT_DIR, subtitled_filename)
        sub_success, transcript = burn_subtitles(output_path, subtitled_path, req.subtitle_style)
        if sub_success and os.path.exists(subtitled_path):
            os.remove(output_path)
            os.rename(subtitled_path, output_path)
        else:
            print(f"[main] Subtitle burn failed for {job_id}, returning clip without subtitles.")

    clip_url = f"http://localhost:8000/clips/{output_filename}"

    return ClipResponse(
        clip_url=clip_url,
        filename=output_filename,
        message="Clip generated successfully",
        transcript=transcript,
    )


@app.post("/generate-caption", response_model=CaptionResponse)
def generate_caption_endpoint(req: CaptionRequest):
    if not req.transcript or not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Transkrip tidak boleh kosong")
    try:
        captions = generate_all_captions(req.transcript)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return CaptionResponse(**captions)


@app.get("/auto-highlight", response_model=HighlightResponse)
def auto_highlight(url: str, max_clips: int = 5):
    """
    Fetch YouTube transcript (or fallback to Whisper) and use Groq AI
    to identify the most engaging highlight moments.
    """
    result = get_highlights(url, max_clips=min(max_clips, 5))
    return HighlightResponse(
        clips=result["clips"],
        error=result.get("error"),
        transcript_source=result.get("transcript_source", "youtube"),
    )
