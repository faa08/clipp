import os
import subprocess
import shutil
import textwrap
import tempfile

# Use Groq Whisper API instead of local model (saves ~450MB RAM on free tier)
from groq import Groq
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

_groq_client: Groq | None = None

def _get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY tidak ditemukan")
        _groq_client = Groq(api_key=api_key)
    return _groq_client

# ── Available subtitle styles ─────────────────────────────────────────────────
SUBTITLE_STYLES = ["beasty", "youshaei", "mozi"]
DEFAULT_STYLE   = "mozi"

# ── Style: Beasty ─────────────────────────────────────────────────────────────
# Bold italic white, heavy shadow, 1-2 words per line, center screen
BEASTY_FONT      = "Arial"
BEASTY_SIZE      = 32
BEASTY_COLOR     = "&H00FFFFFF"   # white
BEASTY_OUTLINE   = "&H00000000"   # black
BEASTY_SHADOW_C  = "&H88000000"   # dark shadow
BEASTY_OUTLINE_W = 3
BEASTY_SHADOW_D  = 3
BEASTY_MARGIN_V  = 440            # inside bottom blur zone (portrait 1920)
BEASTY_MAX_WORDS = 2

# ── Style: Youshaei ───────────────────────────────────────────────────────────
# Karaoke: active word = bright green, others = white semi-transparent
YOUSHAEI_FONT       = "Arial"
YOUSHAEI_SIZE       = 28
YOUSHAEI_ACTIVE     = "&H0000FF00"   # bright green
YOUSHAEI_INACTIVE   = "&H99FFFFFF"   # white ~60% opacity
YOUSHAEI_OUTLINE    = "&H00000000"
YOUSHAEI_OUTLINE_W  = 2
YOUSHAEI_SHADOW     = 1
YOUSHAEI_MARGIN_V   = 440   # inside bottom blur zone
YOUSHAEI_MAX_WORDS  = 5

# ── Style: Mozi ───────────────────────────────────────────────────────────────
# Bold uppercase, white + green alternating per word
MOZI_FONT      = "Arial"
MOZI_SIZE      = 34
MOZI_COLOR_A   = "&H00FFFFFF"    # white
MOZI_COLOR_B   = "&H0000FF00"    # green
MOZI_OUTLINE   = "&H00000000"
MOZI_OUTLINE_W = 3
MOZI_SHADOW    = 2
MOZI_MARGIN_V  = 440   # inside bottom blur zone
MOZI_MAX_WORDS = 3


def _get_model():
    """Deprecated - now using Groq API instead of local model."""
    raise RuntimeError("Use _transcribe_with_groq instead")


def _find_ffmpeg() -> str:
    f = shutil.which("ffmpeg")
    if f: return f
    for p in [r"C:\ffmpeg\bin\ffmpeg.exe", r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"]:
        if os.path.exists(p): return p
    base = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages")
    if os.path.isdir(base):
        for entry in os.listdir(base):
            if "FFmpeg" in entry or "ffmpeg" in entry:
                for sub in os.listdir(os.path.join(base, entry)):
                    c = os.path.join(base, entry, sub, "bin", "ffmpeg.exe")
                    if os.path.exists(c): return c
    return "ffmpeg"


def _extract_audio(video_path: str, audio_path: str, fmt: str = "wav") -> bool:
    """Extract audio from video. fmt: 'wav' for local, 'mp3' for Groq API."""
    if fmt == "mp3":
        cmd = [_find_ffmpeg(), "-y", "-i", video_path, "-vn",
               "-ar", "16000", "-ac", "1", "-b:a", "64k", audio_path]
    else:
        cmd = [_find_ffmpeg(), "-y", "-i", video_path, "-vn",
               "-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le", audio_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f"[subtitler] Audio extraction failed:\n{result.stderr[-500:]}")
        return False
    return True


def _transcribe_with_groq(audio_path: str, with_timestamps: bool = False):
    """
    Transcribe audio using Groq Whisper API.
    Returns (text, segments) where segments have {text, start, end} if with_timestamps=True.
    """
    client = _get_groq_client()
    with open(audio_path, "rb") as f:
        response = client.audio.transcriptions.create(
            file=(os.path.basename(audio_path), f),
            model="whisper-large-v3-turbo",
            response_format="verbose_json" if with_timestamps else "text",
            timestamp_granularities=["segment"] if with_timestamps else [],
        )

    if not with_timestamps:
        return str(response).strip(), []

    text = response.text.strip() if hasattr(response, "text") else ""
    segments = []
    if hasattr(response, "segments") and response.segments:
        for seg in response.segments:
            if isinstance(seg, dict):
                segments.append({"text": seg.get("text","").strip(), "start": seg.get("start",0), "end": seg.get("end",0)})
            else:
                segments.append({"text": seg.text.strip(), "start": seg.start, "end": seg.end})
    return text, segments


def _ass_time(s: float) -> str:
    h = int(s // 3600); m = int((s % 3600) // 60)
    sec = int(s % 60);  cs = int(round((s % 1) * 100))
    return f"{h}:{m:02d}:{sec:02d}.{cs:02d}"


# ── Word collector ────────────────────────────────────────────────────────────

def _collect_words(segments) -> list[dict]:
    """Extract per-word timestamps from Whisper segments."""
    words = []
    for seg in segments:
        if not hasattr(seg, "words") or not seg.words:
            words.append({"word": seg.text.strip(), "start": seg.start, "end": seg.end})
        else:
            for w in seg.words:
                t = w.word.strip()
                if t:
                    words.append({"word": t, "start": w.start, "end": w.end})
    return words


def _group_words(words: list[dict], max_words: int) -> list[list[dict]]:
    return [words[i:i + max_words] for i in range(0, len(words), max_words)]


# ── ASS generators ────────────────────────────────────────────────────────────

def _ass_header(style_line: str, play_res_x: int = 1080, play_res_y: int = 1920) -> str:
    return textwrap.dedent(f"""\
        [Script Info]
        ScriptType: v4.00+
        PlayResX: {play_res_x}
        PlayResY: {play_res_y}
        WrapStyle: 0

        [V4+ Styles]
        Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
        {style_line}

        [Events]
        Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    """)


def _generate_beasty(segments, ass_path: str) -> None:
    """Bold italic white, 1-2 words per line, heavy shadow. Word-by-word display."""
    words = _collect_words(segments)
    if not words: return
    groups = _group_words(words, BEASTY_MAX_WORDS)

    style = (
        f"Style: Beasty,{BEASTY_FONT},{BEASTY_SIZE},"
        f"{BEASTY_COLOR},&H000000FF,{BEASTY_OUTLINE},{BEASTY_SHADOW_C},"
        f"1,1,0,0,100,100,0,0,1,{BEASTY_OUTLINE_W},{BEASTY_SHADOW_D},"
        f"2,20,20,{BEASTY_MARGIN_V},1"
    )
    header = _ass_header(style)
    lines = []
    for g in groups:
        text = " ".join(w["word"].upper() for w in g)
        lines.append(
            f"Dialogue: 0,{_ass_time(g[0]['start'])},{_ass_time(g[-1]['end'])},"
            f"Beasty,,0,0,0,,{text}"
        )
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(lines) + "\n")
    print(f"[subtitler] Beasty ASS: {len(lines)} lines")


def _generate_youshaei(segments, ass_path: str) -> None:
    """Karaoke: active word = green, others = white semi-transparent."""
    words = _collect_words(segments)
    if not words: return
    groups = _group_words(words, YOUSHAEI_MAX_WORDS)

    style = (
        f"Style: Youshaei,{YOUSHAEI_FONT},{YOUSHAEI_SIZE},"
        f"{YOUSHAEI_ACTIVE},&H000000FF,{YOUSHAEI_OUTLINE},&H00000000,"
        f"1,0,0,0,100,100,0,0,1,{YOUSHAEI_OUTLINE_W},{YOUSHAEI_SHADOW},"
        f"2,20,20,{YOUSHAEI_MARGIN_V},1"
    )
    header = _ass_header(style)
    lines = []
    for g in groups:
        parts = []
        for w in g:
            dur_cs = max(1, int(round((w["end"] - w["start"]) * 100)))
            parts.append(f"{{\\kf{dur_cs}}}{w['word']}")
        text = f"{{\\c{YOUSHAEI_INACTIVE}}}" + " ".join(parts)
        lines.append(
            f"Dialogue: 0,{_ass_time(g[0]['start'])},{_ass_time(g[-1]['end'])},"
            f"Youshaei,,0,0,0,,{text}"
        )
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(lines) + "\n")
    print(f"[subtitler] Youshaei ASS: {len(lines)} lines")


def _generate_mozi(segments, ass_path: str) -> None:
    """Bold uppercase, white + green alternating per word."""
    words = _collect_words(segments)
    if not words: return
    groups = _group_words(words, MOZI_MAX_WORDS)

    style = (
        f"Style: Mozi,{MOZI_FONT},{MOZI_SIZE},"
        f"{MOZI_COLOR_A},&H000000FF,{MOZI_OUTLINE},&H00000000,"
        f"1,0,0,0,100,100,0,0,1,{MOZI_OUTLINE_W},{MOZI_SHADOW},"
        f"2,20,20,{MOZI_MARGIN_V},1"
    )
    header = _ass_header(style)
    lines = []
    for g in groups:
        parts = []
        for i, w in enumerate(g):
            color = MOZI_COLOR_A if i % 2 == 0 else MOZI_COLOR_B
            parts.append(f"{{\\c{color}}}{w['word'].upper()}")
        lines.append(
            f"Dialogue: 0,{_ass_time(g[0]['start'])},{_ass_time(g[-1]['end'])},"
            f"Mozi,,0,0,0,," + " ".join(parts)
        )
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(lines) + "\n")
    print(f"[subtitler] Mozi ASS: {len(lines)} lines")


# ── Public API ────────────────────────────────────────────────────────────────

def transcribe_audio(video_path: str) -> str:
    """Transcribe video audio using Groq Whisper API."""
    base = os.path.splitext(video_path)[0]
    audio_path = base + "_audio_cap.mp3"
    try:
        if not _extract_audio(video_path, audio_path, fmt="mp3"): return ""
        print("[subtitler] Transcribing via Groq Whisper API...")
        text, _ = _transcribe_with_groq(audio_path, with_timestamps=False)
        print(f"[subtitler] transcribe_audio done: {len(text)} chars")
        return text
    except Exception as e:
        print(f"[subtitler] transcribe_audio error: {e}"); return ""
    finally:
        if os.path.exists(audio_path):
            try: os.remove(audio_path)
            except OSError: pass


def burn_subtitles(video_path: str, output_path: str, style: str = DEFAULT_STYLE) -> tuple[bool, str]:
    """
    Transcribe via Groq Whisper API → generate styled ASS → burn into video.
    style: 'beasty' | 'youshaei' | 'mozi'
    Returns (success, transcript_text).
    """
    ffmpeg = _find_ffmpeg()
    base   = os.path.splitext(video_path)[0]
    audio_path = base + "_audio.mp3"
    ass_path   = base + f"_{style}.ass"
    transcript = ""

    try:
        print(f"[subtitler] Extracting audio ({style} style)...")
        if not _extract_audio(video_path, audio_path, fmt="mp3"):
            return False, ""

        print("[subtitler] Transcribing via Groq Whisper API...")
        transcript, segments_raw = _transcribe_with_groq(audio_path, with_timestamps=True)
        print(f"[subtitler] Got {len(segments_raw)} segments, transcript: {len(transcript)} chars")

        if not segments_raw:
            subprocess.run([ffmpeg, "-y", "-i", video_path, "-c", "copy", output_path],
                           capture_output=True, timeout=60)
            return True, transcript

        # Convert Groq segments to word-level format for ASS generation
        # Groq returns segment-level, so we split each segment into words
        segments = []
        for seg in segments_raw:
            words = seg["text"].split()
            if not words:
                continue
            seg_duration = seg["end"] - seg["start"]
            word_duration = seg_duration / len(words)
            for i, word in enumerate(words):
                segments.append({
                    "word": word,
                    "start": seg["start"] + i * word_duration,
                    "end": seg["start"] + (i + 1) * word_duration,
                })

        # Generate ASS — wrap words into fake segment objects for generator functions
        class _FakeSeg:
            def __init__(self, words):
                self.text = " ".join(w["word"] for w in words)
                self.start = words[0]["start"]
                self.end = words[-1]["end"]
                self.words = [type("W", (), {"word": w["word"], "start": w["start"], "end": w["end"]})() for w in words]

        # Group words into segments of ~5 words each for the generators
        chunk = 5
        fake_segs = [_FakeSeg(segments[i:i+chunk]) for i in range(0, len(segments), chunk)]

        style = style.lower().strip()
        if style == "beasty":
            _generate_beasty(fake_segs, ass_path)
        elif style == "youshaei":
            _generate_youshaei(fake_segs, ass_path)
        else:
            _generate_mozi(fake_segs, ass_path)

        # Burn into video
        ass_escaped = ass_path.replace("\\", "/").replace(":", "\\:")
        print(f"[subtitler] Burning {style} subtitles → {output_path}")
        result = subprocess.run(
            [ffmpeg, "-y", "-i", video_path,
             "-vf", f"ass='{ass_escaped}'",
             "-c:v", "libx264", "-crf", "18", "-preset", "medium",
             "-c:a", "aac", "-b:a", "192k",
             "-movflags", "+faststart", output_path],
            capture_output=True, text=True, timeout=600,
        )

        if result.returncode != 0:
            print(f"[subtitler] Burn failed:\n{result.stderr[-800:]}")
            return False, transcript

        print(f"[subtitler] {style} subtitles burned OK.")
        return True, transcript

    except Exception as e:
        print(f"[subtitler] Error: {e}")
        return False, transcript
    finally:
        for tmp in [audio_path, ass_path]:
            if os.path.exists(tmp):
                try: os.remove(tmp)
                except OSError: pass
