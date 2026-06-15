import os
import shutil
import subprocess
from moviepy import VideoFileClip

_BASE_DIR = os.path.dirname(__file__)
WATERMARK_PATH = os.path.normpath(os.path.join(_BASE_DIR, "..", "frontend", "public", "logoh.png"))

# Watermark: large, centered in the TOP blur area
WATERMARK_OPACITY = 0.80
WATERMARK_SCALE   = 0.35   # 35% of width — bigger
WATERMARK_MARGIN  = 50     # margin from top edge

VIDEO_CRF    = 18
VIDEO_PRESET = "medium"

TARGET_WIDTH  = 1080
TARGET_HEIGHT = 1920
HALF_HEIGHT   = TARGET_HEIGHT // 2  # 960


def _find_ffmpeg() -> str:
    f = shutil.which("ffmpeg")
    if f: return f
    winget = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages")
    if os.path.isdir(winget):
        for entry in os.listdir(winget):
            if "FFmpeg" in entry or "ffmpeg" in entry:
                for sub in os.listdir(os.path.join(winget, entry)):
                    c = os.path.join(winget, entry, sub, "bin", "ffmpeg.exe")
                    if os.path.exists(c): return c
    for p in [r"C:\ffmpeg\bin\ffmpeg.exe", r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"]:
        if os.path.exists(p): return p
    return "ffmpeg"


def _base_encode_args() -> list[str]:
    return [
        "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", VIDEO_PRESET,
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    ]


def _run(cmd: list[str], timeout: int = 300) -> bool:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if r.returncode != 0:
            print(f"[clipper] FFmpeg error:\n{r.stderr[-700:]}")
            return False
        return True
    except Exception as e:
        print(f"[clipper] FFmpeg exception: {e}")
        return False


# ── Portrait Blur layout ──────────────────────────────────────────────────────
# Video content centered on blurred background.
# Watermark centered in the bottom blur area. Subtitle zone is the lower blur area.

def _convert_portrait_blur(input_path: str, output_path: str) -> bool:
    ffmpeg = _find_ffmpeg()
    W, H = TARGET_WIDTH, TARGET_HEIGHT
    s, a, m = WATERMARK_SCALE, WATERMARK_OPACITY, WATERMARK_MARGIN
    has_wm = os.path.exists(WATERMARK_PATH)

    # Filter:
    # 1. bg  = source scaled to fill 1080x1920, heavy blur
    # 2. fg  = source scaled to fit 1080x1920, centered
    # 3. composed = bg + fg overlay
    # 4. watermark overlay centered at the bottom blur area (if available)
    blur_filter = (
        f"[0:v]split=2[bg_in][fg_in];"
        f"[bg_in]scale={W}:{H}:force_original_aspect_ratio=increase,"
        f"crop={W}:{H},gblur=sigma=40[bg];"
        f"[fg_in]scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black@0[fg];"
        f"[bg][fg]overlay=0:0[composed]"
    )

    if has_wm:
        wm_idx = 1  # second input
        full_filter = (
            blur_filter + ";"
            f"[{wm_idx}:v]scale=iw*{s}:-1,format=rgba,"
            f"colorchannelmixer=aa={a}[wm];"
            # Center horizontally, position in TOP blur zone
            f"[composed][wm]overlay=(W-w)/2:{m}[out]"
        )
        cmd = [ffmpeg, "-y", "-i", input_path, "-i", WATERMARK_PATH,
               "-filter_complex", full_filter,
               "-map", "[out]", "-map", "0:a?"] + _base_encode_args() + [output_path]
    else:
        full_filter = blur_filter + ";[composed]copy[out]"
        cmd = [ffmpeg, "-y", "-i", input_path,
               "-filter_complex", full_filter,
               "-map", "[out]", "-map", "0:a?"] + _base_encode_args() + [output_path]

    return _run(cmd)


# ── Split Frame layout ────────────────────────────────────────────────────────
# Top half: source cropped/zoomed (tight on subject)
# Bottom half: same source with blur background
# White divider line in the middle

def _convert_split_frame(input_path: str, output_path: str) -> bool:
    ffmpeg = _find_ffmpeg()
    W, PH = TARGET_WIDTH, HALF_HEIGHT
    s, a, m = WATERMARK_SCALE, WATERMARK_OPACITY, WATERMARK_MARGIN
    has_wm = os.path.exists(WATERMARK_PATH)

    split_filter = (
        f"[0:v]split=3[src_t][src_b_fg][src_b_bg];"
        # Top: zoom+crop
        f"[src_t]scale={W}:{PH}:force_original_aspect_ratio=increase,"
        f"crop={W}:{PH}[top];"
        # Bottom blur bg
        f"[src_b_bg]scale={W}:{PH}:force_original_aspect_ratio=increase,"
        f"crop={W}:{PH},gblur=sigma=25[bot_bg];"
        # Bottom fg centered
        f"[src_b_fg]scale={W}:{PH}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{PH}:(ow-iw)/2:(oh-ih)/2:black@0[bot_fg];"
        f"[bot_bg][bot_fg]overlay=0:0[bottom];"
        # Stack vertically
        f"[top][bottom]vstack=inputs=2[stacked];"
        # Divider line
        f"[stacked]drawbox=x=0:y={PH-1}:w={W}:h=2:color=white@0.5:t=fill[divided]"
    )

    if has_wm:
        wm_idx = 1
        full_filter = (
            split_filter + ";"
            f"[{wm_idx}:v]scale=iw*{s}:-1,format=rgba,"
            f"colorchannelmixer=aa={a}[wm];"
            f"[divided][wm]overlay=(W-w)/2:H-h-{m}[out]"
        )
        cmd = [ffmpeg, "-y", "-i", input_path, "-i", WATERMARK_PATH,
               "-filter_complex", full_filter,
               "-map", "[out]", "-map", "0:a?"] + _base_encode_args() + [output_path]
    else:
        full_filter = split_filter + ";[divided]copy[out]"
        cmd = [ffmpeg, "-y", "-i", input_path,
               "-filter_complex", full_filter,
               "-map", "[out]", "-map", "0:a?"] + _base_encode_args() + [output_path]

    return _run(cmd)


# ── Main entry point ──────────────────────────────────────────────────────────

def extract_clip(
    source_path: str,
    output_path: str,
    start_time: int = 0,
    duration: int = 30,
    layout: str = "blur",
) -> bool:
    """
    Extract sub-clip then apply 9:16 layout + watermark.
    layout: "blur" (default) | "split"
    """
    tmp_path = output_path.replace(".mp4", "_raw.mp4")

    try:
        # Step 1: Extract raw clip with MoviePy
        with VideoFileClip(source_path) as video:
            total = video.duration
            if start_time >= total:
                start_time = 0
            end_time = min(start_time + duration, total)
            clip = video.subclipped(start_time, end_time)
            clip.write_videofile(tmp_path, codec="libx264", audio_codec="aac", logger=None)

        # Step 2: Apply layout
        convert_fn = _convert_split_frame if layout == "split" else _convert_portrait_blur
        success = convert_fn(tmp_path, output_path)

        if not success:
            print(f"[clipper] Layout '{layout}' failed, using raw clip as fallback.")
            if os.path.exists(tmp_path):
                os.rename(tmp_path, output_path)

        return os.path.exists(output_path)

    except Exception as exc:
        print(f"[clipper] extract_clip error: {exc}")
        return False
    finally:
        if os.path.exists(tmp_path):
            try: os.remove(tmp_path)
            except OSError: pass
