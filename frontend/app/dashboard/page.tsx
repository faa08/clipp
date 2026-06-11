"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Footer from "@/app/components/Footer";

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
function secondsToTime(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

interface ClipEntry {
  id: number;
  startTime: string;
  duration: number;
  selected: boolean;
}

function getClipEnd(clip: ClipEntry): number {
  return timeToSeconds(clip.startTime) + clip.duration;
}
function recalculateStarts(clips: ClipEntry[], fromIndex = 1): ClipEntry[] {
  if (fromIndex < 1 || clips.length <= 1) return clips;
  const updated = [...clips];
  for (let i = fromIndex; i < updated.length; i++) {
    const prevEnd = getClipEnd(updated[i - 1]);
    updated[i] = { ...updated[i], startTime: secondsToTime(prevEnd) };
  }
  return updated;
}

const MAX_CLIPS = 5;

/* ══════════════════════════════════════════
   DASHBOARD PAGE
═══════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState("User");

  const [url, setUrl] = useState("");
  const [clips, setClips] = useState<ClipEntry[]>([
    { id: 1, startTime: "00:00:00", duration: 30, selected: true },
  ]);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDurationLoading, setVideoDurationLoading] = useState(false);
  const [clipLimitWarning, setClipLimitWarning] = useState("");
  const [videoLimitWarning, setVideoLimitWarning] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("autoclip_user");
    if (stored) setUsername(stored);
  }, []);

  const isValidUrl = url.trim().startsWith("http");

  function getLastClipEnd(currentClips: ClipEntry[]): number {
    if (currentClips.length === 0) return 0;
    return getClipEnd(currentClips[currentClips.length - 1]);
  }

  function updateWarnings(currentClips: ClipEntry[]) {
    if (currentClips.length >= MAX_CLIPS) {
      setClipLimitWarning(`Maksimal ${MAX_CLIPS} klip per generate.`);
    } else {
      setClipLimitWarning("");
    }

    if (videoDuration !== null) {
      const lastEnd = getLastClipEnd(currentClips);
      if (lastEnd >= videoDuration) {
        setVideoLimitWarning(
          `Timeline video sudah mencapai batas (${secondsToTime(videoDuration)}). Tidak bisa menambah klip lagi.`
        );
      } else {
        setVideoLimitWarning("");
      }
    } else {
      setVideoLimitWarning("");
    }
  }

  function applyClips(nextClips: ClipEntry[]) {
    setClips(nextClips);
    updateWarnings(nextClips);
  }

  useEffect(() => {
    if (!isValidUrl) {
      setVideoDuration(null);
      setVideoLimitWarning("");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setVideoDurationLoading(true);
      try {
        const res = await fetch(
          `http://localhost:8000/video-info?url=${encodeURIComponent(url.trim())}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setVideoDuration(typeof data.duration === "number" ? data.duration : null);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        setVideoDuration(null);
      } finally {
        if (!controller.signal.aborted) setVideoDurationLoading(false);
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, isValidUrl]);

  useEffect(() => {
    updateWarnings(clips);
  }, [videoDuration, clips]);

  function canAddMoreClips(currentClips: ClipEntry[]): boolean {
    if (currentClips.length >= MAX_CLIPS) return false;
    if (videoDuration === null) return true;
    return getLastClipEnd(currentClips) < videoDuration;
  }

  function addClip() {
    if (clips.length >= MAX_CLIPS) {
      setClipLimitWarning(`Maksimal ${MAX_CLIPS} klip per generate.`);
      return;
    }

    const last = clips[clips.length - 1];
    const nextStartSecs = getClipEnd(last);

    if (videoDuration !== null && nextStartSecs >= videoDuration) {
      setVideoLimitWarning(
        `Timeline video sudah penuh (${secondsToTime(videoDuration)}). Tidak bisa menambah klip lagi.`
      );
      return;
    }

    const remaining = videoDuration !== null ? videoDuration - nextStartSecs : 30;
    const nextDuration = videoDuration !== null
      ? Math.min(90, Math.max(10, remaining))
      : 30;

    const nextId = clips.length > 0 ? Math.max(...clips.map((c) => c.id)) + 1 : 1;

    applyClips([
      ...clips,
      { id: nextId, startTime: secondsToTime(nextStartSecs), duration: nextDuration, selected: true },
    ]);
  }

  function removeClip(id: number) {
    if (clips.length <= 1) return;
    const filtered = clips.filter((c) => c.id !== id);
    applyClips(recalculateStarts(filtered, 1));
  }

  function updateClip(
    id: number,
    field: "startTime" | "duration" | "selected",
    value: string | number | boolean
  ) {
    if (field === "selected") {
      applyClips(clips.map((c) => (c.id === id ? { ...c, selected: value as boolean } : c)));
      return;
    }

    const idx = clips.findIndex((c) => c.id === id);
    if (idx === -1) return;

    const updated = clips.map((c) => (c.id === id ? { ...c, [field]: value } : c));

    if (field === "duration") {
      applyClips(recalculateStarts(updated, idx + 1));
      return;
    }

    applyClips(updated);
  }

  function formatTimeOnBlur(id: number, raw: string) {
    const parts = raw.split(":");
    let formatted = raw;
    if (parts.length === 1) formatted = `00:00:${parts[0].padStart(2, "0")}`;
    else if (parts.length === 2) formatted = `00:${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    else formatted = `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`;

    const idx = clips.findIndex((c) => c.id === id);
    if (idx === -1) return;

    const updated = clips.map((c) => (c.id === id ? { ...c, startTime: formatted } : c));
    applyClips(recalculateStarts(updated, idx + 1));
  }

  const selectedClips = clips.filter((c) => c.selected);
  const hasClipBeyondVideo = videoDuration !== null && selectedClips.some((c) => getClipEnd(c) > videoDuration);
  const allValid = isValidUrl
    && selectedClips.length > 0
    && selectedClips.every((c) => isValidTime(c.startTime) && c.duration >= 10 && c.duration <= 90)
    && !hasClipBeyondVideo;

  function handleGenerateAll() {
    if (!allValid) return;
    const selected = clips.filter((c) => c.selected);
    const batch = {
      url: url.trim(),
      clips: selected.map((clip) => ({
        start: timeToSeconds(clip.startTime),
        startTime: clip.startTime,
        duration: clip.duration,
      })),
    };
    sessionStorage.setItem("autoclip_batch", JSON.stringify(batch));
    router.push("/dashboard/generate");
    setUrl("");
    setClips([{ id: 1, startTime: "00:00:00", duration: 30, selected: true }]);
  }

  function handleLogout() {
    sessionStorage.removeItem("autoclip_user");
    router.push("/");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0f0f13" }}>
      {/* ── Topbar ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "72px", display: "grid", gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center", padding: "0 32px",
        background: "rgba(15,15,19,0.82)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(42,42,56,0.8)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
      }}>
        {/* Left: Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
          <Image src="/logo.png" alt="Auto Clip Logo" width={160} height={56} priority
            style={{ objectFit: "contain", cursor: "pointer" }}
            onClick={() => router.push("/")}
          />
        </div>

        {/* Center: Nav — only Dashboard */}
        <nav style={{ display: "flex", justifyContent: "center" }}>
          <button style={{
            padding: "7px 20px", borderRadius: "8px", fontSize: "13px",
            fontWeight: 600, color: "#e2d9f3",
            background: "rgba(168,85,247,0.12)",
            border: "1px solid rgba(168,85,247,0.25)",
            cursor: "default",
          }}>Dashboard</button>
        </nav>

        {/* Right: User + Logout */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" }}>
          <div style={{
            width: "34px", height: "34px", borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "13px", fontWeight: 700, color: "#fff",
            border: "2px solid rgba(168,85,247,0.3)",
          }}>
            {username.charAt(0).toUpperCase()}
          </div>

          <button
            onClick={handleLogout}
            style={{
              padding: "7px 14px", borderRadius: "8px", fontSize: "12px",
              fontWeight: 500, color: "#9ca3af", cursor: "pointer",
              background: "rgba(42,42,56,0.5)", border: "1px solid #2a2a38",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
          >Keluar</button>
        </div>
      </header>


      {/* ── Page Body ── */}
      <div style={{
        flex: 1,
        paddingTop: "92px", paddingBottom: "48px",
        paddingLeft: "32px", paddingRight: "32px",
        position: "relative",
      }}>
        {/* Bg orbs */}
        <div aria-hidden style={{
          position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)",
          width: "700px", height: "700px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>

          {/* Page Header */}
          <div className="animate-fade-up" style={{ marginBottom: "28px", textAlign: "center" }}>
            <h1 style={{
              fontSize: "32px", fontWeight: 700,
              background: "linear-gradient(135deg, #fff 30%, #c084fc 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              margin: 0, letterSpacing: "-0.4px",
            }}>Dashboard</h1>
            <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "5px" }}>
              Halo, <span style={{ color: "#c084fc", fontWeight: 600 }}>{username}</span>! Selamat datang di ProductiveClip.
            </p>
          </div>

          {/* Centralized Form */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
            <div className="animate-fade-up" style={{
              width: "100%", maxWidth: "640px",
            }}>
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "17px", fontWeight: 700, color: "#f0f0f5", margin: 0 }}>
                  Generate Klip Baru
                </h2>
                <p style={{ fontSize: "13px", color: "#6b7280", margin: "6px 0 0" }}>
                  Paste URL YouTube, lalu tambah hingga 5 klip dengan waktu berbeda.
                </p>
              </div>

              {/* URL Input */}
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#d1d5db", marginBottom: "8px" }}>
                YouTube URL
              </label>
              <div style={{ position: "relative", marginBottom: "24px" }}>
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#4b5563" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                </span>
                <input
                  id="youtube-url" type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  style={{
                    width: "100%", padding: "11px 16px 11px 38px", borderRadius: "12px",
                    background: "#0f0f13", border: "1px solid #2a2a38",
                    color: "#f0f0f5", fontSize: "14px", outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#a855f7")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a38")}
                />
              </div>

              {/* YouTube Preview Card */}
              {(() => {
                const videoId = getYouTubeId(url);
                if (!videoId) return null;
                return (
                  <div style={{
                    background: "#0f0f13",
                    border: "1px solid #2a2a38",
                    borderRadius: "12px",
                    padding: "12px",
                    marginBottom: "20px"
                  }}>
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px", border: "1px solid rgba(42,42,56,0.6)" }}>
                      <iframe
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      ></iframe>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                      <span style={{ fontSize: "12px", color: "#9ca3af" }}>Preview Video</span>
                      <span style={{
                        fontSize: "12px", fontWeight: 600, color: "#c084fc",
                        background: "rgba(168,85,247,0.1)", padding: "3px 8px", borderRadius: "6px",
                        border: "1px solid rgba(168,85,247,0.2)"
                      }}>
                        {videoDurationLoading
                          ? "Mengambil durasi..."
                          : videoDuration !== null
                            ? `Total Durasi: ${secondsToTime(videoDuration)}`
                            : "Durasi tidak diketahui"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {isValidUrl && !getYouTubeId(url) && (
                <p style={{ fontSize: "12px", color: "#6b7280", margin: "-12px 0 20px" }}>
                  {videoDurationLoading
                    ? "Mengambil durasi video..."
                    : videoDuration !== null
                      ? `Durasi video: ${secondsToTime(videoDuration)}`
                      : "Durasi video belum tersedia (klip tetap bisa dibuat)."}
                </p>
              )}

              {/* Clip Entries Label */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: "12px",
              }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "#d1d5db" }}>
                  Daftar Klip ({clips.length}/{MAX_CLIPS})
                </label>
                {canAddMoreClips(clips) && (
                  <button
                    onClick={addClip}
                    style={{
                      padding: "5px 14px", borderRadius: "8px", fontSize: "12px",
                      fontWeight: 600, cursor: "pointer",
                      background: "rgba(168,85,247,0.1)",
                      border: "1px solid rgba(168,85,247,0.25)",
                      color: "#c084fc",
                      transition: "all 0.2s",
                      display: "flex", alignItems: "center", gap: "5px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(168,85,247,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(168,85,247,0.1)";
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Tambah Klip
                  </button>
                )}
              </div>

              {/* Clip Entries */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {clips.map((clip, idx) => {
                  const isDurationInvalid = clip.selected && (clip.duration < 10 || clip.duration > 90);
                  return (
                    <div key={clip.id} style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      padding: "12px",
                      borderRadius: "12px",
                      background: clip.selected ? "#0f0f13" : "rgba(15,15,19,0.4)",
                      border: clip.selected
                        ? (isDurationInvalid ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid #2a2a38")
                        : "1px solid rgba(42,42,56,0.4)",
                      opacity: clip.selected ? 1 : 0.65,
                      transition: "all 0.2s ease",
                    }}>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: clips.length > 1 ? "auto auto 1fr 1fr auto" : "auto auto 1fr 1fr",
                        gap: "10px",
                        alignItems: "center",
                      }}>
                        {/* Custom Checkbox */}
                        <div 
                          style={{ display: "flex", alignItems: "center", cursor: "pointer", paddingRight: "2px" }} 
                          onClick={() => updateClip(clip.id, "selected", !clip.selected)}
                        >
                          <div style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "4px",
                            border: clip.selected ? "2px solid #a855f7" : "2px solid #4b5563",
                            background: clip.selected ? "#a855f7" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s ease",
                          }}>
                            {clip.selected && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="1.5 4 4 6.5 8.5 1.5" />
                              </svg>
                            )}
                          </div>
                        </div>

                        {/* Clip Number Badge */}
                        <div style={{
                          width: "28px", height: "28px", borderRadius: "8px",
                          background: clip.selected ? "rgba(168,85,247,0.15)" : "rgba(75,85,99,0.1)",
                          border: clip.selected ? "1px solid rgba(168,85,247,0.25)" : "1px solid rgba(75,85,99,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "12px", fontWeight: 700, color: clip.selected ? "#c084fc" : "#6b7280",
                          flexShrink: 0,
                        }}>
                          {idx + 1}
                        </div>

                        {/* Start Time */}
                        <div>
                          <label style={{ display: "block", fontSize: "10px", color: clip.selected ? "#6b7280" : "#4b5563", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Start
                          </label>
                          <input
                            type="text" placeholder="00:00:00"
                            value={clip.startTime}
                            disabled={!clip.selected}
                            onChange={(e) => updateClip(clip.id, "startTime", e.target.value.replace(/[^0-9:]/g, ""))}
                            onBlur={() => formatTimeOnBlur(clip.id, clip.startTime)}
                            style={{
                              width: "100%", padding: "7px 10px", borderRadius: "8px",
                              background: clip.selected ? "#18181f" : "rgba(24,24,31,0.5)",
                              border: `1px solid ${!clip.selected ? "rgba(42,42,56,0.3)" : isValidTime(clip.startTime) ? "#2a2a38" : "#ef444460"}`,
                              color: clip.selected ? "#f0f0f5" : "#6b7280", fontSize: "13px", fontFamily: "monospace",
                              outline: "none", boxSizing: "border-box",
                              cursor: !clip.selected ? "not-allowed" : "text",
                            }}
                          />
                        </div>

                        {/* Duration */}
                        <div>
                          <label style={{ display: "block", fontSize: "10px", color: clip.selected ? "#6b7280" : "#4b5563", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Durasi (detik, 10-90)
                          </label>
                          <input
                            type="number" min={10} max={90}
                            value={clip.duration}
                            disabled={!clip.selected}
                            onChange={(e) => updateClip(clip.id, "duration", Number(e.target.value))}
                            onBlur={(e) => {
                              const val = Math.max(10, Math.min(90, Number(e.target.value) || 10));
                              updateClip(clip.id, "duration", val);
                            }}
                            style={{
                              width: "100%", padding: "7px 10px", borderRadius: "8px",
                              background: clip.selected ? "#18181f" : "rgba(24,24,31,0.5)",
                              border: clip.selected
                                ? (isDurationInvalid ? "1px solid rgba(239, 68, 68, 0.6)" : "1px solid #2a2a38")
                                : "1px solid rgba(42,42,56,0.3)",
                              color: clip.selected ? "#f0f0f5" : "#6b7280", fontSize: "13px",
                              outline: "none", boxSizing: "border-box",
                              cursor: !clip.selected ? "not-allowed" : "default",
                            }}
                          />
                        </div>

                        {/* Remove Button */}
                        {clips.length > 1 && (
                          <button
                            onClick={() => removeClip(clip.id)}
                            title="Hapus klip"
                            style={{
                              width: "28px", height: "28px", borderRadius: "8px",
                              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", transition: "all 0.2s",
                              color: "#f87171", fontSize: "14px",
                              alignSelf: "end", marginBottom: "2px",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                              e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                              e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Warning message if duration is invalid */}
                      {isDurationInvalid && (
                        <div style={{
                          fontSize: "11px",
                          color: "#f87171",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          marginTop: "2px",
                          paddingLeft: "42px",
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <span>
                            {clip.duration < 10
                              ? "Peringatan: Durasi kurang dari batas minimal (10 detik)!"
                              : "Peringatan: Durasi melebihi batas maksimal (90 detik)!"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {(clipLimitWarning || videoLimitWarning || hasClipBeyondVideo) && (
                <div style={{
                  marginBottom: "16px", padding: "12px 14px", borderRadius: "10px",
                  background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)",
                  color: "#fbbf24", fontSize: "12px", lineHeight: 1.6,
                }}>
                  {clipLimitWarning && <p style={{ margin: 0 }}>{clipLimitWarning}</p>}
                  {videoLimitWarning && <p style={{ margin: clipLimitWarning ? "6px 0 0" : 0 }}>{videoLimitWarning}</p>}
                  {hasClipBeyondVideo && videoDuration !== null && (
                    <p style={{ margin: (clipLimitWarning || videoLimitWarning) ? "6px 0 0" : 0 }}>
                      Ada klip yang melebihi durasi video ({secondsToTime(videoDuration)}). Kurangi durasi atau hapus klip.
                    </p>
                  )}
                </div>
              )}

              {/* Generate Button */}
              <button
                id="generate-btn"
                onClick={handleGenerateAll}
                disabled={!allValid}
                className={allValid ? "animate-glow-pulse" : ""}
                style={{
                  width: "100%", padding: "13px", borderRadius: "12px",
                  fontWeight: 700, fontSize: "15px", color: "#fff", border: "none",
                  cursor: !allValid ? "not-allowed" : "pointer",
                  background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                  opacity: !allValid ? 0.45 : 1,
                  transition: "opacity 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Generate {selectedClips.length} Klip
              </button>
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
}
