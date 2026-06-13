| Layer | Teknologi | Fungsi |
|---|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind 4 | Tampilan pengguna, tema gelap, SPA |
| Backend | FastAPI + Uvicorn | REST API + server file statis |
| Download Video | yt-dlp (subprocess) | Download video YouTube per bagian |
| Proses Video | MoviePy + FFmpeg | Potong klip, konversi 9:16, watermark |
| Speech-to-Text | faster-whisper (model small) | Generate subtitle, transkripsi |
| AI | Groq (Llama 3.3 70B) | Deteksi highlight & caption otomatis |

---

## 📄 Halaman & Fitur

| Halaman | Path | Deskripsi |
|---|---|---|
| Landing | `/` | Hero section, dropdown fitur, CTA, background video |
| Login | `/login` | Login palsu (bebas isi apa aja), simpan di sessionStorage |
| Dashboard | `/dashboard` | Workspace utama: mode Auto & Manual |
| Generate | `/dashboard/generate` | Progress pemrosesan klip + hasil dengan caption |
| Tentang | `/tentang` | Halaman tentang, info perusahaan |

### Fitur Utama:
1. **Auto Highlight** — AI analisa transkrip → pilih momen terbaik → generate klip massal
2. **Klip Manual** — User atur waktu mulai + durasi (maks 5 klip, 10–90 detik)
3. **Subtitle AI** — 3 gaya: Beasty, Youshaei, Mozi (di-burn pakai ASS + FFmpeg)
4. **Caption AI** — Groq bikin caption sosmed buat Instagram, TikTok, YouTube Shorts
5. **Output 9:16 Portrait** — Otomatis ubah landscape → portrait dengan background blur + watermark

---

## ✅ Kelebihan

1. **Backend rapi** — Pemisahan modul yang bersih (downloader.py, clipper.py, subtitler.py, captioner.py, highlighter.py), masing-masing satu tanggung jawab.
2. **Download hemat** — Pakai `--download-sections` jadi cuma download bagian yang dibutuhkan, bukan seluruh video.
3. **Rantai fallback** — Transkrip YouTube → fallback ke Whisper; format yt-dlp utama → format fallback. Error handling solid.
4. **Deteksi FFmpeg lintas platform** — Cek PATH, paket WinGet, dan folder instalasi umum.
5. **UI/UX bagus** — Tema gelap yang dipoles, animasi smooth (fade-up, spin), preview card responsif.
6. **Batch generate** — Proses klip berurutan dengan progress tracking per klip.
7. **Fitur AI bermakna** — Deteksi highlight dan generate caption nambah nilai nyata.

---

## ⚠️ Masalah & Yang Bisa Diperbaiki

### 🔴 Prioritas Tinggi

| # | Masalah | Lokasi | Detail | Solusi |
|---|---|---|---|---|
| 1 | Gak ada auth asli | `login/page.tsx` | Terima username & password apa aja. Oke buat demo, tapi misleading kalau dipresentasikan sebagai fitur nyata. | Tambah validasi credential hardcoded atau pakai JWT sederhana kalau mau semi-nyata. |
| 2 | Gak ada validasi input di backend | `main.py` L37-42 | `url` gak divalidasi — string apa aja diterima. Gak ada cek format URL YouTube. `start_time` bisa negatif. | Tambah regex validasi YouTube URL dan validasi range di Pydantic model. |
| 3 | Blocking I/O di FastAPI async | `main.py` | Semua endpoint pakai `def` (sync), tapi MoviePy, yt-dlp, dan Whisper itu CPU-heavy. Ini blokir event loop — request bersamaan bakal ngantri. | Pakai `async def` + `run_in_threadpool` atau `BackgroundTasks`. |
| 4 | Gak ada pembersihan file | `storage/videos/`, `storage/output/` | Video dan klip numpuk terus. Udah ada 90+ file video. Gak ada TTL atau cron buat hapus. | Tambah cleanup script atau auto-delete file yang udah >24 jam. |
| 5 | Hardcode `localhost:8000` | Semua fetch di frontend | URL kayak `http://localhost:8000/generate-clip` di-hardcode. Gak portable. | Pakai environment variable `NEXT_PUBLIC_API_URL`. |

### 🟡 Prioritas Sedang

| # | Masalah | Lokasi | Detail | Solusi |
|---|---|---|---|---|
| 6 | Kode topbar duplikat | Semua halaman | `<header>` topbar di-copy-paste di setiap halaman, padahal udah ada `Topbar.tsx` di `components/` yang gak dipakai. | Pakai komponen `Topbar.tsx` yang udah ada di semua halaman. |
| 7 | Fungsi helper duplikat | `dashboard/page.tsx` & `generate/page.tsx` | `timeToSeconds()`, `secondsToTime()`, `getYouTubeId()` ditulis ulang di 2 file. | Pisah ke file utility bareng, misal `lib/utils.ts`. |
| 8 | Inline style kebanjiran | Semua file `.tsx` | Ratusan baris `style={{}}` inline. Susah di-maintain dan di-theme. | Migrasi ke CSS module atau class Tailwind secara bertahap. |
| 9 | Model Whisper di-load ulang | `highlighter.py` L137 | Bikin `WhisperModel("small")` baru setiap kali, bukannya pakai singleton yang ada di `subtitler.py`. Boros memori. | Import dan pakai singleton `_get_model()` dari `subtitler.py`. |
| 10 | Gak ada timeout/cancel | Frontend | Kalau user pindah halaman pas lagi generate, backend tetep jalan. Gak ada mekanisme cancel. | Tambah `AbortController` di fetch generate. |
| 11 | `generate-caption` jalan berurutan | `captioner.py` L81-90 | `generate_all_captions()` panggil Groq 3 kali berurutan (IG, TikTok, YouTube). Bisa lebih cepat. | Paralel pakai `asyncio.gather` atau `concurrent.futures`. |

### 🟢 Prioritas Rendah / Polesan

| # | Masalah | Lokasi | Detail | Solusi |
|---|---|---|---|---|
| 12 | README duplikat | `README.md` L49-68 | Perintah setup backend muncul 2 kali. | Hapus blok duplikat. |
| 13 | Bahasa campur | Seluruh codebase | Teks UI bahasa Indonesia, komentar kode campur Inggris-Indonesia. | Pilih satu bahasa buat komentar kode (disarankan Inggris). |
| 14 | Gak ada progress download | `generate/page.tsx` | Tombol download gak nunjukin progress buat file besar. | Pakai `ReadableStream` + progress bar. |
| 15 | Preview card statis | `page.tsx` L360-422 | Card preview di hero cuma hiasan. | Bisa dibikin interaktif atau tampilkan data klip terakhir. |
| 16 | Gak ada error boundary | Frontend | Kalau halaman crash, gak ada React error boundary yang nangkep. | Tambah `<ErrorBoundary>` component di layout. |

---

## 📊 Skor Keseluruhan

| Kategori | Nilai | Catatan |
|---|---|---|
| Fungsionalitas | ⭐⭐⭐⭐☆ | Semua fitur inti jalan: download, klip, subtitle, caption, highlight |
| Kualitas Kode | ⭐⭐⭐☆☆ | Backend rapi, tapi frontend banyak duplikasi dan inline style berlebihan |
| Performa | ⭐⭐⭐☆☆ | Section-download cerdas, tapi endpoint sync blokir event loop |
| UX/UI | ⭐⭐⭐⭐☆ | Tema gelap yang dipoles, animasi bagus, alur intuitif |
| Keamanan | ⭐⭐☆☆☆ | Gak ada auth asli, gak ada sanitasi input, CORS cuma buka ke localhost |
| Maintainability | ⭐⭐⭐☆☆ | Pemisahan backend bagus, tapi frontend butuh ekstraksi komponen & utility bareng |

---

## 🎯 Rekomendasi Perbaikan Prioritas

Urutan yang disarankan buat diperbaiki:

1. **Pisah utility function** yang duplikat ke file bareng (`lib/utils.ts`)
2. **Pakai env variable** buat API URL (`NEXT_PUBLIC_API_URL`)
3. **Bikin endpoint backend async-friendly** (pakai `async def` + `run_in_threadpool`)
4. **Pakai komponen `Topbar.tsx`** yang udah ada bukannya copy-paste
5. **Tambah validasi input** di Pydantic model backend
6. **Tambah mekanisme cleanup** buat file storage yang udah lama