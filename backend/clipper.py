import os
import shutil
import subprocess

_BASE_DIR = os.path.dirname(__file__)
WATERMARK_PATH = os.path.normpath(os.path.join(_BASE_DIR, "assets", "logoh.png"))
OUTRO_PATH     = os.path.normpath(os.path.join(_BASE_DIR, "assets", "outro_vertikal.mp4"))

# Watermark: large, centered in the TOP blur area
WATERMARK_OPACITY = 0.80
WATERMARK_SCALE   = 0.35   # 35% of width — bigger
WATERMARK_MARGIN  = 50     # margin from top edge

VIDEO_CRF    = 23          # was 18 — still good quality, 2x faster encode
VIDEO_PRESET = "ultrafast" # was "veryfast" — 3x faster, file slightly bigger

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
        "-threads", "1",  # limit threads to reduce RAM on free tier
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
    ]


def _run(cmd: list[str], timeout: int = 600) -> bool:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if r.returncode != 0:
            print(f"[clipper] FFmpeg error:\n{r.stderr[-700:]}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print(f"[clipper] FFmpeg timeout ({timeout}s)")
        return False
    except Exception as e:
        print(f"[clipper] FFmpeg exception: {e}")
        return False


def _get_video_duration(video_path: str) -> float:
    """Get video duration in seconds using ffprobe."""
    try:
        cmd = [
            _find_ffmpeg().replace("ffmpeg", "ffprobe"),
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1:noprint_wrappers=1",
            video_path,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            return float(r.stdout.strip())
    except:
        pass
    return 0.0


# ── Portrait Blur layout ──────────────────────────────────────────────────────

def _convert_portrait_blur(input_path: str, output_path: str) -> bool:
    """Single-pass FFmpeg: clip + resize + blur + watermark + encode all at once."""
    ffmpeg = _find_ffmpeg()
    W, H = TARGET_WIDTH, TARGET_HEIGHT
    # Blur at 1/4 resolution then scale up = identical result, 5x faster
    BW, BH = W // 4, H // 4
    s, a, m = WATERMARK_SCALE, WATERMARK_OPACITY, WATERMARK_MARGIN
    has_wm = os.path.exists(WATERMARK_PATH)

    blur_filter = (
        f"[0:v]split=2[bg_in][fg_in];"
        f"[bg_in]scale={BW}:{BH}:force_original_aspect_ratio=increase,"
        f"crop={BW}:{BH},gblur=sigma=8,scale={W}:{H}[bg];"
        f"[fg_in]scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black@0[fg];"
        f"[bg][fg]overlay=0:0[composed]"
    )

    if has_wm:
        wm_idx = 1
        full_filter = (
            blur_filter + ";"
            f"[{wm_idx}:v]scale=iw*{s}:-1,format=rgba,"
            f"colorchannelmixer=aa={a}[wm];"
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

def _convert_split_frame(input_path: str, output_path: str) -> bool:
    """Single-pass FFmpeg: split frame + resize + blur + watermark + encode."""
    ffmpeg = _find_ffmpeg()
    W, PH = TARGET_WIDTH, HALF_HEIGHT
    BW, BPH = W // 4, PH // 4  # blur at 1/4 res, same trick
    s, a, m = WATERMARK_SCALE, WATERMARK_OPACITY, WATERMARK_MARGIN
    has_wm = os.path.exists(WATERMARK_PATH)

    split_filter = (
        f"[0:v]split=3[src_t][src_b_fg][src_b_bg];"
        f"[src_t]scale={W}:{PH}:force_original_aspect_ratio=increase,"
        f"crop={W}:{PH}[top];"
        f"[src_b_bg]scale={BW}:{BPH}:force_original_aspect_ratio=increase,"
        f"crop={BW}:{BPH},gblur=sigma=8,scale={W}:{PH}[bot_bg];"
        f"[src_b_fg]scale={W}:{PH}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{PH}:(ow-iw)/2:(oh-ih)/2:black@0[bot_fg];"
        f"[bot_bg][bot_fg]overlay=0:0[bottom];"
        f"[top][bottom]vstack=inputs=2[stacked];"
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

def _convert_portrait_blur_trimmed(
    input_path: str, output_path: str,
    start_time: int, duration: int
) -> bool:
    """Single-pass: seek + trim + blur layout + encode. No intermediate file."""
    ffmpeg = _find_ffmpeg()
    W, H = TARGET_WIDTH, TARGET_HEIGHT
    BW, BH = W // 4, H // 4
    s, a, m = WATERMARK_SCALE, WATERMARK_OPACITY, WATERMARK_MARGIN
    has_wm = os.path.exists(WATERMARK_PATH)

    blur_filter = (
        f"[0:v]trim=start={start_time}:duration={duration},setpts=PTS-STARTPTS,split=2[bg_in][fg_in];"
        f"[bg_in]scale={BW}:{BH}:force_original_aspect_ratio=increase,"
        f"crop={BW}:{BH},gblur=sigma=8,scale={W}:{H}[bg];"
        f"[fg_in]scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black@0[fg];"
        f"[bg][fg]overlay=0:0[composed]"
    )
    audio_filter = f"[0:a]atrim=start={start_time}:duration={duration},asetpts=PTS-STARTPTS[aud]"

    if has_wm:
        full_filter = (
            blur_filter + ";"
            + audio_filter + ";"
            f"[1:v]scale=iw*{s}:-1,format=rgba,colorchannelmixer=aa={a}[wm];"
            f"[composed][wm]overlay=(W-w)/2:{m}[out]"
        )
        cmd = [ffmpeg, "-y",
               "-ss", str(max(0, start_time - 5)), "-i", input_path,
               "-i", WATERMARK_PATH,
               "-filter_complex", full_filter,
               "-map", "[out]", "-map", "[aud]"] + _base_encode_args() + [output_path]
    else:
        full_filter = blur_filter + ";" + audio_filter
        cmd = [ffmpeg, "-y",
               "-ss", str(max(0, start_time - 5)), "-i", input_path,
               "-filter_complex", full_filter,
               "-map", "[composed]", "-map", "[aud]"] + _base_encode_args() + [output_path]

    return _run(cmd)


def _convert_split_frame_trimmed(
    input_path: str, output_path: str,
    start_time: int, duration: int
) -> bool:
    """Single-pass: seek + trim + split layout + encode. No intermediate file."""
    ffmpeg = _find_ffmpeg()
    W, PH = TARGET_WIDTH, HALF_HEIGHT
    BW, BPH = W // 4, PH // 4
    s, a, m = WATERMARK_SCALE, WATERMARK_OPACITY, WATERMARK_MARGIN
    has_wm = os.path.exists(WATERMARK_PATH)

    split_filter = (
        f"[0:v]trim=start={start_time}:duration={duration},setpts=PTS-STARTPTS,split=3[src_t][src_b_fg][src_b_bg];"
        f"[src_t]scale={W}:{PH}:force_original_aspect_ratio=increase,crop={W}:{PH}[top];"
        f"[src_b_bg]scale={BW}:{BPH}:force_original_aspect_ratio=increase,crop={BW}:{BPH},gblur=sigma=8,scale={W}:{PH}[bot_bg];"
        f"[src_b_fg]scale={W}:{PH}:force_original_aspect_ratio=decrease,pad={W}:{PH}:(ow-iw)/2:(oh-ih)/2:black@0[bot_fg];"
        f"[bot_bg][bot_fg]overlay=0:0[bottom];"
        f"[top][bottom]vstack=inputs=2[stacked];"
        f"[stacked]drawbox=x=0:y={PH-1}:w={W}:h=2:color=white@0.5:t=fill[divided]"
    )
    audio_filter = f"[0:a]atrim=start={start_time}:duration={duration},asetpts=PTS-STARTPTS[aud]"

    if has_wm:
        full_filter = (
            split_filter + ";"
            + audio_filter + ";"
            f"[1:v]scale=iw*{s}:-1,format=rgba,colorchannelmixer=aa={a}[wm];"
            f"[divided][wm]overlay=(W-w)/2:H-h-{m}[out]"
        )
        cmd = [ffmpeg, "-y",
               "-ss", str(max(0, start_time - 5)), "-i", input_path,
               "-i", WATERMARK_PATH,
               "-filter_complex", full_filter,
               "-map", "[out]", "-map", "[aud]"] + _base_encode_args() + [output_path]
    else:
        full_filter = split_filter + ";" + audio_filter
        cmd = [ffmpeg, "-y",
               "-ss", str(max(0, start_time - 5)), "-i", input_path,
               "-filter_complex", full_filter,
               "-map", "[divided]", "-map", "[aud]"] + _base_encode_args() + [output_path]

    return _run(cmd)


def _append_outro(clip_path: str, output_path: str) -> bool:
    """
    Append outro video ke akhir clip menggunakan FFmpeg concat.
    Outro di-normalize ke resolusi & framerate yang sama dulu.
    """
    ffmpeg = _find_ffmpeg()

    if not os.path.exists(OUTRO_PATH):
        print(f"[clipper] Outro file not found: {OUTRO_PATH}")
        return False

    tmp_outro = output_path.replace(".mp4", "_outro_norm.mp4")
    try:
        # Step 1: Normalize outro ke resolusi & codec yang sama dengan clip
        norm_ok = _run([
            ffmpeg, "-y", "-i", OUTRO_PATH,
            "-vf", f"scale={TARGET_WIDTH}:{TARGET_HEIGHT}:force_original_aspect_ratio=decrease,"
                   f"pad={TARGET_WIDTH}:{TARGET_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black",
            "-r", "30",
            "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", VIDEO_PRESET,
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
            "-movflags", "+faststart",
            tmp_outro
        ], timeout=120)

        if not norm_ok:
            print("[clipper] Outro normalization failed")
            return False

        # Step 2: Concat clip + outro
        concat_list = output_path.replace(".mp4", "_concat.txt")
        with open(concat_list, "w", encoding="utf-8") as f:
            f.write(f"file '{clip_path.replace(chr(92), '/')}'\n")
            f.write(f"file '{tmp_outro.replace(chr(92), '/')}'\n")

        concat_ok = _run([
            ffmpeg, "-y",
            "-f", "concat", "-safe", "0",
            "-i", concat_list,
            "-c", "copy",
            "-movflags", "+faststart",
            output_path
        ], timeout=120)

        return concat_ok

    except Exception as e:
        print(f"[clipper] append_outro error: {e}")
        return False
    finally:
        for tmp in [tmp_outro, concat_list if 'concat_list' in dir() else ""]:
            if tmp and os.path.exists(tmp):
                try: os.remove(tmp)
                except OSError: pass


def extract_clip(
    source_path: str,
    output_path: str,
    start_time: int = 0,
    duration: int = 30,
    layout: str = "blur",
    add_outro: bool = True,   # default ON — append outro ke setiap clip
) -> bool:
    """
    Single-pass FFmpeg: seek + trim + layout + encode all in one command.
    Lalu append outro jika add_outro=True dan file outro tersedia.
    """
    try:
        if layout == "split":
            ok = _convert_split_frame_trimmed(source_path, output_path, start_time, duration)
        else:
            ok = _convert_portrait_blur_trimmed(source_path, output_path, start_time, duration)

        if not ok or not os.path.exists(output_path):
            print("[clipper] Single-pass failed, falling back to 2-step")
            ok = _fallback_two_step(source_path, output_path, start_time, duration, layout)

        if not ok:
            return False

        # Append outro jika diminta dan file ada
        if add_outro and os.path.exists(OUTRO_PATH):
            print("[clipper] Appending outro...")
            tmp_with_outro = output_path.replace(".mp4", "_with_outro.mp4")
            outro_ok = _append_outro(output_path, tmp_with_outro)
            if outro_ok and os.path.exists(tmp_with_outro):
                os.replace(tmp_with_outro, output_path)
                print("[clipper] Outro appended OK")
            else:
                print("[clipper] Outro append failed, keeping clip without outro")

        return os.path.exists(output_path)

    except Exception as exc:
        print(f"[clipper] extract_clip error: {exc}")
        return False


def _fallback_two_step(
    source_path: str, output_path: str,
    start_time: int, duration: int, layout: str
) -> bool:
    """Fallback: trim first, then apply layout."""
    ffmpeg = _find_ffmpeg()
    tmp = output_path.replace(".mp4", "_trim.mp4")
    try:
        trim_ok = _run([
            ffmpeg, "-y",
            "-ss", str(start_time), "-i", source_path,
            "-t", str(duration),
            "-c:v", "libx264", "-crf", "18", "-preset", "veryfast",
            "-c:a", "aac", "-b:a", "128k",
            tmp
        ], timeout=300)
        if not trim_ok:
            return False
        convert_fn = _convert_split_frame if layout == "split" else _convert_portrait_blur
        return convert_fn(tmp, output_path)
    finally:
        if os.path.exists(tmp):
            try: os.remove(tmp)
            except OSError: pass
