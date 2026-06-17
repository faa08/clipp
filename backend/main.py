import os
import uuid
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
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

origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
print(f"[CORS] Allowed origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(__file__)
VIDEOS_DIR = os.path.join(BASE_DIR, "storage", "videos")
OUTPUT_DIR = os.path.join(BASE_DIR, "storage", "output")
os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

app.mount("/clips", StaticFiles(directory=OUTPUT_DIR), name="clips")

# Thread pool for parallel clip generation (limit to 3 concurrent to avoid overloading)
_executor = ThreadPoolExecutor(max_workers=3)

FILE_MAX_AGE_SECONDS = 60 * 60  # 1 jam


def _cleanup_old_files(directory: str, max_age: int = FILE_MAX_AGE_SECONDS) -> int:
    """Hapus file yang lebih tua dari max_age detik. Return jumlah file yang dihapus."""
    now = time.time()
    deleted = 0
    if not os.path.isdir(directory):
        return 0
    for fname in os.listdir(directory):
        fpath = os.path.join(directory, fname)
        try:
            if os.path.isfile(fpath):
                age = now - os.path.getmtime(fpath)
                if age > max_age:
                    os.remove(fpath)
                    deleted += 1
                    print(f"[cleanup] Deleted old file: {fname} ({age/3600:.1f}h old)")
        except Exception as e:
            print(f"[cleanup] Error deleting {fname}: {e}")
    return deleted


async def _cleanup_loop():
    """Background task: cleanup setiap 1 jam."""
    while True:
        await asyncio.sleep(FILE_MAX_AGE_SECONDS)
        print("[cleanup] Running scheduled cleanup...")
        n1 = _cleanup_old_files(OUTPUT_DIR)
        n2 = _cleanup_old_files(VIDEOS_DIR)
        print(f"[cleanup] Done — deleted {n1} output clips, {n2} source videos")


@app.on_event("startup")
async def startup_event():
    # Cleanup saat startup (hapus sisa dari session sebelumnya)
    n1 = _cleanup_old_files(OUTPUT_DIR)
    n2 = _cleanup_old_files(VIDEOS_DIR)
    if n1 or n2:
        print(f"[cleanup] Startup cleanup: {n1} clips, {n2} videos deleted")
    # Start background cleanup loop
    asyncio.create_task(_cleanup_loop())


class ClipRequest(BaseModel):
    url: str
    start_time: int = 0
    duration: int = 30
    add_subtitle: bool = False
    subtitle_style: str = "mozi"
    layout: str = "blur"  # "blur" | "split"
    add_outro: bool = True  # append outro ke akhir clip


class BulkClipItem(BaseModel):
    start_time: int
    duration: int
    layout: str = "blur"
    add_subtitle: bool = False
    subtitle_style: str = "mozi"
    add_outro: bool = True


class BulkClipRequest(BaseModel):
    url: str
    clips: list[BulkClipItem]


class ClipResponse(BaseModel):
    clip_url: str
    filename: str
    message: str
    transcript: str = ""


class BulkClipResult(BaseModel):
    clip_url: str = ""
    filename: str = ""
    transcript: str = ""
    error: str = ""
    index: int = 0


class BulkClipResponse(BaseModel):
    results: list[BulkClipResult]
    success_count: int
    total: int


class HighlightClip(BaseModel):
    start_time: int
    start_label: str
    duration: int
    title: str
    reason: str


class HighlightResponse(BaseModel):
    clips: list[HighlightClip]
    error: str | None = None
    transcript_source: str = "youtube"


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


@app.get("/cleanup")
def manual_cleanup():
    """Trigger cleanup manual — hapus semua file > 1 jam."""
    n1 = _cleanup_old_files(OUTPUT_DIR)
    n2 = _cleanup_old_files(VIDEOS_DIR)
    return {"deleted_clips": n1, "deleted_videos": n2, "message": f"Deleted {n1+n2} files"}


@app.get("/video-info", response_model=VideoInfoResponse)
def video_info(url: str):
    duration = get_video_duration(url)
    if not duration:
        raise HTTPException(status_code=400, detail="Failed to fetch video duration")
    return VideoInfoResponse(duration=duration, message="Video info fetched successfully")


def _process_single_clip(
    url: str,
    start_time: int,
    duration: int,
    layout: str,
    add_subtitle: bool,
    subtitle_style: str,
    add_outro: bool,
    job_id: str,
    index: int,
) -> BulkClipResult:
    """Process one clip — runs in a thread pool worker."""
    try:
        video_path = download_video(url, VIDEOS_DIR, job_id, start_time, duration)
        if not video_path or not os.path.exists(video_path):
            return BulkClipResult(error="Download failed", index=index)

        output_filename = f"clip_{job_id}.mp4"
        output_path = os.path.join(OUTPUT_DIR, output_filename)

        success = extract_clip(video_path, output_path, start_time=0, duration=duration, layout=layout, add_outro=add_outro)
        if not success or not os.path.exists(output_path):
            return BulkClipResult(error="Clip extraction failed", index=index)

        transcript = ""
        if add_subtitle:
            subtitled_filename = f"clip_{job_id}_sub.mp4"
            subtitled_path = os.path.join(OUTPUT_DIR, subtitled_filename)
            sub_success, transcript = burn_subtitles(output_path, subtitled_path, subtitle_style)
            if sub_success and os.path.exists(subtitled_path):
                os.remove(output_path)
                os.rename(subtitled_path, output_path)

        clip_url = f"{os.environ.get('RENDER_EXTERNAL_URL', 'http://localhost:8000')}/clips/{output_filename}"
        return BulkClipResult(
            clip_url=clip_url,
            filename=output_filename,
            transcript=transcript,
            index=index,
        )
    except Exception as e:
        print(f"[main] clip {index} error: {e}")
        return BulkClipResult(error=str(e), index=index)


@app.post("/generate-clip", response_model=ClipResponse)
def generate_clip(req: ClipRequest):
    job_id = str(uuid.uuid4())[:8]
    result = _process_single_clip(
        req.url, req.start_time, req.duration, req.layout,
        req.add_subtitle, req.subtitle_style, req.add_outro, job_id, 0,
    )
    if result.error:
        raise HTTPException(status_code=500, detail=result.error)
    return ClipResponse(
        clip_url=result.clip_url,
        filename=result.filename,
        message="Clip generated successfully",
        transcript=result.transcript,
    )


@app.post("/generate-bulk-clips", response_model=BulkClipResponse)
async def generate_bulk_clips(req: BulkClipRequest):
    """
    Generate multiple clips in parallel (up to 3 concurrent).
    Much faster than calling /generate-clip 5 times serially.
    """
    loop = asyncio.get_event_loop()

    tasks = []
    for i, clip in enumerate(req.clips):
        job_id = str(uuid.uuid4())[:8]
        task = loop.run_in_executor(
            _executor,
            _process_single_clip,
            req.url,
            clip.start_time,
            clip.duration,
            clip.layout,
            clip.add_subtitle,
            clip.subtitle_style,
            clip.add_outro,
            job_id,
            i,
        )
        tasks.append(task)

    results = await asyncio.gather(*tasks)
    results = sorted(results, key=lambda r: r.index)

    success = [r for r in results if not r.error]
    return BulkClipResponse(results=list(results), success_count=len(success), total=len(results))


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
    result = get_highlights(url, max_clips=min(max_clips, 5))
    return HighlightResponse(
        clips=result["clips"],
        error=result.get("error"),
        transcript_source=result.get("transcript_source", "youtube"),
    )
