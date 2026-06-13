import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY tidak ditemukan di environment / .env")
        _client = Groq(api_key=api_key)
    return _client


PLATFORM_PROMPTS = {
    "instagram": (
        "Kamu adalah copywriter media sosial profesional. "
        "Buat caption Instagram yang engaging dari transkrip video berikut. "
        "Format: hook kuat di baris pertama, isi 2-3 kalimat, call-to-action, lalu 15-20 hashtag relevan. "
        "Gunakan bahasa yang sama dengan transkrip (auto-detect). "
        "Pisahkan hashtag dengan baris kosong dari teks utama."
    ),
    "tiktok": (
        "Kamu adalah copywriter TikTok profesional. "
        "Buat caption TikTok pendek dan punchy dari transkrip video berikut. "
        "Format: 1-2 kalimat singkat yang bikin orang penasaran, lalu 5-8 hashtag trending. "
        "Gunakan bahasa yang sama dengan transkrip (auto-detect). "
        "Gaya bahasa santai, relatable, boleh pakai emoji secukupnya."
    ),
    "youtube": (
        "Kamu adalah copywriter YouTube Shorts profesional. "
        "Buat judul dan deskripsi YouTube Shorts dari transkrip video berikut. "
        "Format:\n"
        "JUDUL: [judul menarik max 60 karakter]\n\n"
        "DESKRIPSI: [2-3 kalimat deskripsi, sertakan keyword penting], "
        "lalu 3-5 hashtag relevan di akhir. "
        "Gunakan bahasa yang sama dengan transkrip (auto-detect)."
    ),
}


def generate_caption(transcript: str, platform: str) -> str:
    """
    Generate a social media caption for the given platform using Groq.

    Args:
        transcript: The video transcript text from Whisper.
        platform: One of 'instagram', 'tiktok', 'youtube'.

    Returns:
        Generated caption string.
    """
    platform = platform.lower().strip()
    if platform not in PLATFORM_PROMPTS:
        raise ValueError(f"Platform tidak valid: {platform}. Pilih: instagram, tiktok, youtube")

    if not transcript or not transcript.strip():
        raise ValueError("Transkrip kosong, tidak bisa generate caption")

    system_prompt = PLATFORM_PROMPTS[platform]

    client = _get_client()
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Transkrip video:\n\n{transcript.strip()}"},
        ],
        temperature=0.8,
        max_tokens=600,
    )

    return response.choices[0].message.content.strip()


def generate_all_captions(transcript: str) -> dict[str, str]:
    """Generate captions for all three platforms at once."""
    results = {}
    for platform in PLATFORM_PROMPTS:
        try:
            results[platform] = generate_caption(transcript, platform)
        except Exception as e:
            print(f"[captioner] Failed for {platform}: {e}")
            results[platform] = ""
    return results
