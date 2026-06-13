import os
import shutil
import subprocess
from moviepy import VideoFileClip

# Path to the watermark logo
_BASE_DIR = os.path.dirname(__file__)
WATERMARK_PATH = os.path.normpath(os.path.join(_BASE_DIR, "..", "frontend", "public", "logoh.png"))

# Watermark settings
WATERMARK_OPACITY = 0.70
WATERMARK_SCALE   = 0.10
WATERMARK_MARGIN  = 8

# Output quality
VIDEO_CRF    = 18        # lower = better quality (18 = visually lossless)
VIDEO_PRESET = "medium"  # better compression than "fast", still reasonable speed

# Output format: 9:16 portrait for TikTok / Reels / Shorts
TARGET_WIDTH  = 1080
TARGET_HEIGHT = 1920


def _find_ffmpeg() -> str:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return ffmpeg
    winget_base = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages")
    if os.path.isdir(winget_base):
        for entry in os.listdir(winget_base):
            if "FFmpeg" in entry or "ffmpeg" in entry:
                bin_dir = os.path.join(winget_base, entry)
                for sub in os.listdir(bin_dir):
                    candidate = os.path.join(bin_dir, sub, "bin", "ffmpeg.exe")
                    if os.path.exists(candidate):
                        return candidate
    for path in [r"C:\ffmpeg\bin\ffmpeg.exe", r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"]:
        if os.path.exists(path):
            return path
    return "ffmpeg"


def _convert_to_portrait(input_path: str, output_path: str, watermark_path: str | None) -> bool:
    """
    Convert video to 9:16 (1080x1920) portrait format using blur background:
    - Original content stays intact (no cropping)
    - Blurred + scaled version fills the background
    - Content centered over the blur
    - Watermark overlaid top-right
    """
    ffmpeg = _find_ffmpeg()

    # Blur background filter:
    # [0:v] split into two streams:
    #   [bg]  → scale to fill 1080x1920, heavy blur, used as background
    #   [fg]  → scale so it fits within 1080x1920 keeping aspect ratio, centered overlay
    vf_blur_bg = (
        f"[0:v]split=2[bg_in][fg_in];"
        f"[bg_in]scale={TARGET_WIDTH}:{TARGET_HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={TARGET_WIDTH}:{TARGET_HEIGHT},"
        f"gblur=sigma=30[bg];"
        f"[fg_in]scale={TARGET_WIDTH}:{TARGET_HEIGHT}:force_original_aspect_ratio=decrease,"
        f"pad={TARGET_WIDTH}:{TARGET_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black@0[fg];"
        f"[bg][fg]overlay=0:0[composed]"
    )

    if watermark_path and os.path.exists(watermark_path):
        scale   = WATERMARK_SCALE
        opacity = WATERMARK_OPACITY
        margin  = WATERMARK_MARGIN
        filter_complex = (
            vf_blur_bg + ";"
            f"[1:v]scale=iw*{scale}:-1,format=rgba,colorchannelmixer=aa={opacity}[wm];"
            f"[composed][wm]overlay=W-w-{margin}:{margin}[out]"
        )
        cmd = [
            ffmpeg, "-y",
            "-i", input_path,
            "-i", watermark_path,
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-map", "0:a?",
            "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", VIDEO_PRESET,
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            output_path,
        ]
    else:
        filter_complex = vf_blur_bg + ";[composed]copy[out]"
        cmd = [
            ffmpeg, "-y",
            "-i", input_path,
            "-filter_complex", filter_complex,
            "-map", "[out]",
            "-map", "0:a?",
            "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", VIDEO_PRESET,
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            output_path,
        ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            print(f"[clipper] FFmpeg portrait convert failed:\n{result.stderr[-600:]}")
            return False
        return True
    except Exception as e:
        print(f"[clipper] Portrait convert error: {e}")
        return False


def extract_clip(
    source_path: str,
    output_path: str,
    start_time: int = 0,
    duration: int = 30,
) -> bool:
    """
    1. Extract sub-clip with MoviePy
    2. Convert to 9:16 portrait (1080x1920) + watermark + high quality with FFmpeg
    Returns True on success.
    """
    tmp_path = output_path.replace(".mp4", "_raw.mp4")

    try:
        # ── Step 1: Extract clip with MoviePy ────────────────────────────
        with VideoFileClip(source_path) as video:
            total_duration = video.duration
            if start_time >= total_duration:
                start_time = 0
            end_time = min(start_time + duration, total_duration)
            clip = video.subclipped(start_time, end_time)
            clip.write_videofile(tmp_path, codec="libx264", audio_codec="aac", logger=None)

        # ── Step 2: Convert to 9:16 + watermark ──────────────────────────
        wm = WATERMARK_PATH if os.path.exists(WATERMARK_PATH) else None
        success = _convert_to_portrait(tmp_path, output_path, wm)

        if not success:
            print("[clipper] Portrait convert failed, using raw clip.")
            if os.path.exists(tmp_path):
                os.rename(tmp_path, output_path)
            return os.path.exists(output_path)

        return os.path.exists(output_path)

    except Exception as exc:
        print(f"[clipper] Clip extraction failed: {exc}")
        return False

    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
