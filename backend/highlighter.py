import os
import re
import json
import shutil
import subprocess
import sys
import tempfile
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
from groq import Groq
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY tidak ditemukan")
        _client = Groq(api_key=api_key)
    return _client


def _extract_video_id(url: str) -> str | None:
    for pattern in [r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})"]:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def _get_ytdlp_cmd() -> str:
    scripts_dir = os.path.dirname(sys.executable)
    for name in ("yt-dlp.exe", "yt-dlp"):
        candidate = os.path.join(scripts_dir, name)
        if os.path.isfile(candidate):
            return candidate
    return "yt-dlp"


def _find_ffmpeg() -> str | None:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return os.path.dirname(ffmpeg)
    winget_base = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages")
    if os.path.isdir(winget_base):
        for entry in os.listdir(winget_base):
            if "FFmpeg" in entry or "ffmpeg" in entry:
                for sub in os.listdir(os.path.join(winget_base, entry)):
                    candidate = os.path.join(winget_base, entry, sub, "bin")
                    if os.path.isdir(candidate):
                        return candidate
    for path in [r"C:\ffmpeg\bin", r"C:\Program Files\ffmpeg\bin"]:
        if os.path.exists(os.path.join(path, "ffmpeg.exe")):
            return path
    return None


# ── YouTube transcript fetch ──────────────────────────────────────────────────

def _fetch_yt_transcript(video_id: str) -> list[dict] | None:
    """Try all available transcripts, any language."""
    try:
        tlist = YouTubeTranscriptApi.list_transcripts(video_id)
        # prefer manually created, then generated, any language
        try:
            t = tlist.find_manually_created_transcript(
                ["id", "en", "en-US", "en-GB", "ja", "ko", "es", "fr", "de", "pt", "zh"]
            )
        except Exception:
            t = next(iter(tlist))  # just take whatever is first
        return t.fetch()
    except (NoTranscriptFound, TranscriptsDisabled):
        return None
    except Exception as e:
        print(f"[highlighter] YT transcript error: {e}")
        return None


# ── Groq Whisper API fallback ─────────────────────────────────────────────────

def _whisper_transcript(url: str) -> list[dict] | None:
    """
    Download audio-only from YouTube (max 5 minutes, m4a format — small file),
    send to Groq Whisper API for fast cloud transcription (~3-5 seconds).
    Returns entries in [{text, start, duration}] format.
    """
    ytdlp    = _get_ytdlp_cmd()
    ffmpeg_b = _find_ffmpeg()
    tmpdir   = tempfile.mkdtemp(prefix="highlight_")

    try:
        audio_out = os.path.join(tmpdir, "audio.%(ext)s")

        # Download max 5 minutes as m4a (small file, fast upload)
        cmd = [
            ytdlp,
            "--extractor-args", "youtube:player_client=android,web",
            "--no-playlist",
            "--download-sections", "*00:00:00-00:05:00",
            "-f", "bestaudio[ext=m4a]/bestaudio/best",
            "--no-post-overwrites",
            "-o", audio_out,
            url,
        ]
        if ffmpeg_b:
            cmd += ["--ffmpeg-location", ffmpeg_b]

        print("[highlighter] Downloading audio for Groq Whisper...")
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            print(f"[highlighter] yt-dlp audio failed: {r.stderr[-300:]}")
            return None

        # Find downloaded file
        audio_file = None
        for f in os.listdir(tmpdir):
            if not f.endswith(".part"):
                audio_file = os.path.join(tmpdir, f)
                break

        if not audio_file or not os.path.exists(audio_file):
            print("[highlighter] Audio file not found after download")
            return None

        file_size = os.path.getsize(audio_file)
        print(f"[highlighter] Audio file: {os.path.basename(audio_file)} ({file_size // 1024}KB)")

        # Send to Groq Whisper API
        print("[highlighter] Sending to Groq Whisper API...")
        client = _get_client()
        with open(audio_file, "rb") as af:
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(audio_file), af),
                model="whisper-large-v3-turbo",  # fastest Groq Whisper model
                response_format="verbose_json",   # includes word/segment timestamps
                timestamp_granularities=["segment"],
            )

        # Convert Groq response to our format
        entries = []
        if hasattr(transcription, "segments") and transcription.segments:
            for seg in transcription.segments:
                entries.append({
                    "text": seg.get("text", "").strip() if isinstance(seg, dict) else seg.text.strip(),
                    "start": seg.get("start", 0) if isinstance(seg, dict) else seg.start,
                    "duration": (seg.get("end", 0) - seg.get("start", 0)) if isinstance(seg, dict)
                                else (seg.end - seg.start),
                })
        elif hasattr(transcription, "text") and transcription.text:
            # Fallback: no segments, use full text as single entry
            entries.append({"text": transcription.text.strip(), "start": 0, "duration": 300})

        print(f"[highlighter] Groq Whisper done: {len(entries)} segments")
        return entries if entries else None

    except subprocess.TimeoutExpired:
        print("[highlighter] Audio download timed out")
        return None
    except Exception as e:
        print(f"[highlighter] Groq Whisper error: {e}")
        return None
    finally:
        import shutil as _sh
        try:
            _sh.rmtree(tmpdir, ignore_errors=True)
        except Exception:
            pass


# ── Build timed text for LLM ─────────────────────────────────────────────────

def _build_timed_text(entries: list[dict], max_chars: int = 6000) -> tuple[str, int]:
    """
    Convert entries to '[MM:SS] text' format.
    Returns (timed_text, total_seconds).
    """
    lines = []
    for entry in entries:
        start = int(entry["start"])
        m, s = divmod(start, 60)
        lines.append(f"[{m:02d}:{s:02d}] {entry['text'].strip()}")

    full = "\n".join(lines)
    total = int(entries[-1]["start"] + entries[-1].get("duration", 0)) if entries else 0

    if len(full) > max_chars:
        half = max_chars // 2
        full = full[:half] + "\n...[truncated]...\n" + full[-half:]

    return full, total


# ── Groq analysis ─────────────────────────────────────────────────────────────

def _analyze_with_groq(timed_text: str, total_seconds: int, max_clips: int) -> dict:
    system_prompt = (
        "Kamu adalah video editor profesional yang ahli membuat konten viral untuk media sosial. "
        "Tugasmu adalah menganalisis transcript video YouTube dan menemukan momen paling menarik, "
        "informatif, atau viral yang cocok dijadikan short clip (30-60 detik)."
    )

    user_prompt = f"""Berikut adalah transcript video YouTube (format [MM:SS] teks):

{timed_text}

Durasi total video: {total_seconds // 60} menit {total_seconds % 60} detik.

Identifikasi {max_clips} momen terbaik untuk dijadikan klip pendek viral. Prioritaskan:
- Momen yang punya hook kuat (pertanyaan menarik, pernyataan mengejutkan, tips berguna)
- Bagian yang bisa berdiri sendiri tanpa konteks video lengkap
- Momen emosional, lucu, atau informatif

Balas HANYA dalam format JSON berikut, tanpa teks lain:
{{
  "clips": [
    {{
      "start_label": "MM:SS",
      "duration": <angka detik, antara 30-60>,
      "title": "<judul singkat klip, max 8 kata>",
      "reason": "<alasan singkat kenapa momen ini menarik, max 15 kata>"
    }}
  ]
}}"""

    client = _get_client()
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
        max_tokens=800,
    )

    raw = response.choices[0].message.content.strip()
    json_match = re.search(r"\{[\s\S]*\}", raw)
    if not json_match:
        raise ValueError("Gagal parse response AI")

    data = json.loads(json_match.group())
    clips_raw = data.get("clips", [])

    clips = []
    for c in clips_raw[:max_clips]:
        label = c.get("start_label", "00:00")
        parts = label.split(":")
        try:
            if len(parts) == 2:
                start_secs = int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                start_secs = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            else:
                start_secs = 0
        except ValueError:
            start_secs = 0

        duration = max(10, min(90, int(c.get("duration", 30))))
        h, rem = divmod(start_secs, 3600)
        m, s = divmod(rem, 60)

        clips.append({
            "start_time": start_secs,
            "start_label": f"{h:02d}:{m:02d}:{s:02d}",
            "duration": duration,
            "title": c.get("title", "Highlight"),
            "reason": c.get("reason", ""),
        })

    return {"clips": clips, "error": None}


# ── Main entry point ──────────────────────────────────────────────────────────

def get_highlights(url: str, max_clips: int = 5) -> dict:
    """
    1. Try YouTube transcript API (instant, no download)
    2. If unavailable → fallback to yt-dlp audio download + Whisper transcription
    3. Send transcript to Groq for highlight detection
    """
    video_id = _extract_video_id(url)
    if not video_id:
        return {"clips": [], "error": "URL YouTube tidak valid"}

    # ── Step 1: YouTube transcript ────────────────────────────────────────
    print(f"[highlighter] Trying YouTube transcript for {video_id}...")
    entries = _fetch_yt_transcript(video_id)
    transcript_source = "youtube"

    # ── Step 2: Whisper fallback ──────────────────────────────────────────
    if not entries:
        print("[highlighter] YouTube transcript unavailable, falling back to Whisper...")
        entries = _whisper_transcript(url)
        transcript_source = "whisper"

    if not entries:
        return {
            "clips": [],
            "error": (
                "Tidak bisa mendapatkan transcript video ini. "
                "Pastikan video bisa diakses dan coba lagi."
            ),
        }

    print(f"[highlighter] Got {len(entries)} entries via {transcript_source}")
    timed_text, total_seconds = _build_timed_text(entries)

    # ── Step 3: Groq analysis ─────────────────────────────────────────────
    try:
        result = _analyze_with_groq(timed_text, total_seconds, max_clips)
        # Add transcript source info
        result["transcript_source"] = transcript_source
        return result
    except json.JSONDecodeError:
        return {"clips": [], "error": "Response AI tidak valid"}
    except Exception as e:
        print(f"[highlighter] Groq error: {e}")
        return {"clips": [], "error": f"Gagal analisa video: {str(e)}"}
