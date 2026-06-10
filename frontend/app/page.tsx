"use client";

import { useState } from "react";

/* ── Types ── */
type Status = "idle" | "loading" | "success" | "error";

interface ClipResult {
  clip_url: string;
  filename: string;
  message: string;
}

/* ── Step indicator ── */
const STEPS = [
  { id: 1, label: "Download" },
  { id: 2, label: "Extract" },
  { id: 3, label: "Ready" },
];

function StepIndicator({ active }: { active: boolean }) {
  return (
    <ol className="flex items-center gap-3 mb-8">
      {STEPS.map((step, i) => {
        const done = active && i < 2; // pretend steps 1-2 complete fast
        return (
          <li key={step.id} className="flex items-center gap-3">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border transition-all duration-500
                ${active
                  ? "border-purple-500 bg-purple-600/20 text-purple-300"
                  : "border-[#2a2a38] bg-[#18181f] text-gray-500"}`}
            >
              {step.id}
            </span>
            <span className={`text-sm ${active ? "text-gray-300" : "text-gray-600"}`}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="w-8 h-px bg-[#2a2a38]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Spinner ── */
function Spinner() {
  return (
    <svg
      className="animate-spin-slow w-5 h-5 text-purple-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/* ── Time helpers ── */
function timeToSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(t) || 0;
}

function isValidTime(t: string): boolean {
  return /^\d{1,2}:\d{2}:\d{2}$/.test(t);
}

/* ── Main Page ── */
export default function Home() {
  const [url, setUrl] = useState("");
  const [startTimeStr, setStartTimeStr] = useState("00:00:00");
  const [duration, setDuration] = useState(30);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ClipResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloading, setDownloading] = useState(false);

  const isValidUrl = url.trim().startsWith("http");
  const isValidStartTime = isValidTime(startTimeStr);

  async function handleGenerate() {
    if (!isValidUrl) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");

    const startSecs = timeToSeconds(startTimeStr);

    try {
      const res = await fetch("http://localhost:8000/generate-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, start_time: startSecs, duration }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail ?? "Server error");
      }

      const data: ClipResult = await res.json();
      setResult(data);
      setStatus("success");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  }

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      const res = await fetch(result.clip_url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* ── Background orb ── */}
      <div
        aria-hidden
        className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full
                   bg-purple-700/10 blur-[120px] pointer-events-none"
      />

      {/* ── Header ── */}
      <header className="text-center mb-12 animate-fade-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-600/15 border border-purple-500/30 text-purple-300 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          MVP · Local only
        </div>
        <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-br from-white via-gray-200 to-gray-500 bg-clip-text text-transparent">
          Auto Clip
        </h1>
        <p className="mt-3 text-gray-400 text-lg max-w-md mx-auto">
          Paste a YouTube URL and get a polished short clip — instantly, no account needed.
        </p>
      </header>

      {/* ── Card ── */}
      <main
        className="w-full max-w-xl rounded-2xl border border-[#2a2a38] bg-[#18181f] p-8 shadow-2xl animate-fade-up"
        style={{ animationDelay: "0.1s" }}
      >
        {/* Step indicator */}
        <StepIndicator active={status === "loading"} />

        {/* URL input */}
        <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-300 mb-2">
          YouTube URL
        </label>
        <div className="relative mb-5">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
          <input
            id="youtube-url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            disabled={status === "loading"}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0f0f13] border border-[#2a2a38] text-gray-100
                       placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1
                       focus:ring-purple-500 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Options row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="start-time" className="block text-xs text-gray-500 mb-1">
              Start (hh:mm:ss)
            </label>
            <input
              id="start-time"
              type="text"
              placeholder="00:00:00"
              value={startTimeStr}
              onChange={(e) => {
                // Auto-insert colons as user types digits
                const raw = e.target.value.replace(/[^0-9:]/g, "");
                setStartTimeStr(raw);
              }}
              onBlur={(e) => {
                // On blur, try to pad to HH:MM:SS
                const parts = e.target.value.split(":");
                if (parts.length === 1) {
                  const s = parts[0].padStart(2, "0");
                  setStartTimeStr(`00:00:${s}`);
                } else if (parts.length === 2) {
                  setStartTimeStr(`00:${parts[0].padStart(2,"0")}:${parts[1].padStart(2,"0")}`);
                } else if (parts.length === 3) {
                  setStartTimeStr(`${parts[0].padStart(2,"0")}:${parts[1].padStart(2,"0")}:${parts[2].padStart(2,"0")}`);
                }
              }}
              disabled={status === "loading"}
              className={`w-full px-3 py-2 rounded-lg bg-[#0f0f13] border text-gray-200 font-mono
                         focus:outline-none focus:ring-1 transition-colors text-sm disabled:opacity-50
                         ${
                           isValidStartTime
                             ? "border-[#2a2a38] focus:border-purple-500 focus:ring-purple-500"
                             : "border-red-500/60 focus:border-red-500 focus:ring-red-500"
                         }`}
            />
          </div>
          <div>
            <label htmlFor="clip-duration" className="block text-xs text-gray-500 mb-1">
              Duration (seconds)
            </label>
            <input
              id="clip-duration"
              type="number"
              min={5}
              max={300}
              value={duration}
              onChange={(e) => setDuration(Math.max(5, Number(e.target.value)))}
              disabled={status === "loading"}
              className="w-full px-3 py-2 rounded-lg bg-[#0f0f13] border border-[#2a2a38] text-gray-200
                         focus:outline-none focus:border-purple-500 transition-colors text-sm disabled:opacity-50"
            />
          </div>
        </div>

        {/* Generate button */}
        <button
          id="generate-btn"
          onClick={handleGenerate}
          disabled={!isValidUrl || status === "loading"}
          className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-200
                     bg-gradient-to-r from-purple-600 to-violet-600
                     hover:from-purple-500 hover:to-violet-500
                     disabled:opacity-40 disabled:cursor-not-allowed
                     active:scale-[0.98] animate-glow-pulse"
        >
          {status === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner /> Generating clip…
            </span>
          ) : (
            "✂ Generate Clip"
          )}
        </button>

        {/* Error */}
        {status === "error" && (
          <div
            id="error-msg"
            className="mt-5 p-4 rounded-xl bg-red-900/20 border border-red-700/40 text-red-300 text-sm animate-fade-up"
          >
            <span className="font-semibold">Error: </span>{errorMsg}
          </div>
        )}

        {/* Loading skeleton */}
        {status === "loading" && (
          <div className="mt-6 space-y-3 animate-fade-up">
            <div className="shimmer h-4 rounded-md w-3/4" />
            <div className="shimmer h-4 rounded-md w-1/2" />
            <div className="shimmer h-40 rounded-xl w-full" />
          </div>
        )}

        {/* Success — video player + download */}
        {status === "success" && result && (
          <div id="clip-result" className="mt-6 animate-fade-up">
            <p className="text-green-400 text-sm font-medium mb-3 flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Clip ready!
            </p>

            {/* Video player */}
            <div className="rounded-xl overflow-hidden border border-[#2a2a38] bg-black mb-4">
              <video
                id="clip-player"
                controls
                autoPlay
                src={result.clip_url}
                className="w-full max-h-64 object-contain"
              />
            </div>

            {/* Download button */}
            <button
              id="download-btn"
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                         border border-purple-500/40 bg-purple-600/10 text-purple-300
                         hover:bg-purple-600/20 hover:border-purple-400 transition-all duration-200
                         font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <>
                  <Spinner />
                  Menyiapkan download…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download {result.filename}
                </>
              )}
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="mt-10 text-gray-600 text-xs text-center animate-fade-up" style={{ animationDelay: "0.2s" }}>
        Auto Clip · Local MVP · Powered by yt-dlp &amp; MoviePy
      </footer>
    </div>
  );
}
