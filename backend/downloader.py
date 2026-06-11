import json
import os
import shutil
import subprocess
import sys


def _get_ytdlp_cmd() -> str:
    """Return the full path to yt-dlp in the current venv, or fall back to 'yt-dlp'."""
    # Look next to the current Python executable (inside venv/Scripts/)
    scripts_dir = os.path.dirname(sys.executable)
    for name in ("yt-dlp.exe", "yt-dlp"):
        candidate = os.path.join(scripts_dir, name)
        if os.path.isfile(candidate):
            return candidate
    # Fall back to whatever is on PATH
    return "yt-dlp"


def _find_ffmpeg_bin() -> str | None:
    """Return the directory containing ffmpeg, checking PATH first then common install dirs."""
    # 1. Check if ffmpeg is already on PATH
    ffmpeg_on_path = shutil.which("ffmpeg")
    if ffmpeg_on_path:
        return os.path.dirname(ffmpeg_on_path)

    # 2. WinGet / Gyan.FFmpeg
    winget_base = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages")
    if os.path.isdir(winget_base):
        for entry in os.listdir(winget_base):
            if "FFmpeg" in entry or "ffmpeg" in entry:
                bin_dir = os.path.join(winget_base, entry)
                for sub in os.listdir(bin_dir):
                    candidate = os.path.join(bin_dir, sub, "bin")
                    if os.path.isdir(candidate) and os.path.exists(
                        os.path.join(candidate, "ffmpeg.exe")
                    ):
                        return candidate

    # 3. Common manual install locations
    for path in [
        r"C:\ffmpeg\bin",
        r"C:\Program Files\ffmpeg\bin",
        r"C:\Program Files (x86)\ffmpeg\bin",
    ]:
        if os.path.exists(os.path.join(path, "ffmpeg.exe")):
            return path

    return None


def get_video_duration(url: str) -> int | None:
    """Return total video duration in seconds using yt-dlp metadata only."""
    ytdlp = _get_ytdlp_cmd()
    command = [
        ytdlp,
        "-j",
        "--no-playlist",
        "--no-warnings",
        "--extractor-args", "youtube:player_client=android,web",
        url,
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            print("[downloader] get_video_duration failed:", result.stderr[-1000:] if result.stderr else "")
            return None

        data = json.loads(result.stdout)
        duration = data.get("duration")
        if isinstance(duration, (int, float)) and duration > 0:
            return int(duration)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError) as e:
        print(f"[downloader] get_video_duration error: {e}")

    return None


def download_video(
    url: str,
    output_dir: str,
    job_id: str,
    start_time: int = 0,
    duration: int = 30,
) -> str | None:
    """
    Downloads only the required section of a YouTube video using yt-dlp.
    Returns the path to the downloaded file, or None on failure.
    """
    output_template = os.path.join(output_dir, f"video_{job_id}.%(ext)s")
    end_time = start_time + duration

    # Format the time range for --download-sections  e.g. "*00:00:00-00:00:30"
    def fmt(sec: int) -> str:
        h, rem = divmod(sec, 3600)
        m, s = divmod(rem, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    section = f"*{fmt(start_time)}-{fmt(end_time)}"
    ytdlp = _get_ytdlp_cmd()
    ffmpeg_bin = _find_ffmpeg_bin()

    command = [
        ytdlp,
        # Use android client to avoid JS-runtime requirement
        "--extractor-args", "youtube:player_client=android,web",
        "--no-playlist",
        # Only download the needed section (avoids downloading the entire video)
        "--download-sections", section,
        # Force re-encode so the section timestamps are accurate
        "--force-keyframes-at-cuts",
        # Prefer a single mp4 file; fall back to best available
        "-f", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]/best",
        "--merge-output-format", "mp4",
        "-o", output_template,
        url,
    ]

    if ffmpeg_bin:
        command += ["--ffmpeg-location", ffmpeg_bin]

    print(f"[downloader] yt-dlp path : {ytdlp}")
    print(f"[downloader] ffmpeg path : {ffmpeg_bin}")
    print(f"[downloader] Running: {' '.join(command)}")

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=300,  # 5-minute cap
        )
        print("[downloader] stdout:", result.stdout[-2000:] if result.stdout else "")
        print("[downloader] stderr:", result.stderr[-2000:] if result.stderr else "")

        if result.returncode != 0:
            print(f"[downloader] yt-dlp exited with code {result.returncode}")
            # Try a simpler fallback format
            return _fallback_download(url, output_dir, job_id, section, ytdlp, ffmpeg_bin)
    except subprocess.TimeoutExpired:
        print("[downloader] yt-dlp timed out")
        return None
    except FileNotFoundError:
        print(f"[downloader] yt-dlp not found at: {ytdlp}")
        return None

    # Find the downloaded file
    return _find_output(output_dir, job_id)


def _fallback_download(
    url: str,
    output_dir: str,
    job_id: str,
    section: str,
    ytdlp: str,
    ffmpeg_bin: str | None,
) -> str | None:
    """Simple fallback: best single-file format."""
    print("[downloader] Trying fallback (best[ext=mp4]/best)…")
    output_template = os.path.join(output_dir, f"video_{job_id}.%(ext)s")

    command = [
        ytdlp,
        "--extractor-args", "youtube:player_client=android,web",
        "--no-playlist",
        "--download-sections", section,
        "-f", "best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", output_template,
        url,
    ]
    if ffmpeg_bin:
        command += ["--ffmpeg-location", ffmpeg_bin]

    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=300)
        print("[downloader] fallback stdout:", result.stdout[-1000:] if result.stdout else "")
        print("[downloader] fallback stderr:", result.stderr[-1000:] if result.stderr else "")
    except Exception as e:
        print(f"[downloader] fallback failed: {e}")
        return None

    return _find_output(output_dir, job_id)


def _find_output(output_dir: str, job_id: str) -> str | None:
    """Find the file yt-dlp created for this job."""
    # Exact match first
    expected_path = os.path.join(output_dir, f"video_{job_id}.mp4")
    if os.path.exists(expected_path):
        return expected_path

    # Scan for any file starting with the job prefix (ignore .part files)
    for fname in os.listdir(output_dir):
        if fname.startswith(f"video_{job_id}") and not fname.endswith(".part"):
            full = os.path.join(output_dir, fname)
            if os.path.getsize(full) > 0:
                return full

    return None
