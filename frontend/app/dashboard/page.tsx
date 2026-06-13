"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

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

interface ClipEntry { id: number; startTime: string; duration: number; selected: boolean; }
interface HighlightClip { start_time: number; start_label: string; duration: number; title: string; reason: string; }

function getClipEnd(clip: ClipEntry): number { return timeToSeconds(clip.startTime) + clip.duration; }
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

export default function DashboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState("User");
  const [mode, setMode] = useState<"auto" | "manual">("auto");

  // ── Shared ──
  const [url, setUrl] = useState("");
  const [addSubtitle, setAddSubtitle] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState<"beasty" | "youshaei" | "mozi">("mozi");

  // ── Auto mode ──
  const [autoStatus, setAutoStatus] = useState<"idle" | "analyzing" | "ready" | "error">("idle");
  const [autoError, setAutoError] = useState("");
  const [highlights, setHighlights] = useState<HighlightClip[]>([]);
  const [selectedHighlights, setSelectedHighlights] = useState<Set<number>>(new Set());
  const [transcriptSource, setTranscriptSource] = useState<"youtube" | "whisper">("youtube");

  // ── Manual mode ──
  const [clips, setClips] = useState<ClipEntry[]>([{ id: 1, startTime: "00:00:00", duration: 30, selected: true }]);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDurationLoading, setVideoDurationLoading] = useState(false);
  const [clipLimitWarning, setClipLimitWarning] = useState("");
  const [videoLimitWarning, setVideoLimitWarning] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("autoclip_user");
    if (stored) setUsername(stored);
  }, []);

  const isValidUrl = url.trim().startsWith("http");

  // ── Auto mode logic ──
  async function handleAutoAnalyze() {
    if (!isValidUrl) return;
    setAutoStatus("analyzing");
    setHighlights([]);
    setAutoError("");
    try {
      const res = await fetch(`http://localhost:8000/auto-highlight?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (data.error) { setAutoError(data.error); setAutoStatus("error"); return; }
      const clips: HighlightClip[] = data.clips ?? [];
      setHighlights(clips);
      setTranscriptSource(data.transcript_source ?? "youtube");
      setSelectedHighlights(new Set(clips.map((_: HighlightClip, i: number) => i)));
      setAutoStatus("ready");
    } catch {
      setAutoError("Gagal menghubungi server. Pastikan backend berjalan.");
      setAutoStatus("error");
    }
  }

  function toggleHighlight(idx: number) {
    setSelectedHighlights(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function handleAutoGenerate() {
    if (!isValidUrl || selectedHighlights.size === 0) return;
    const selected = highlights.filter((_, i) => selectedHighlights.has(i));
    const batch = {
      url: url.trim(),
      clips: selected.map((h) => ({ start: h.start_time, startTime: h.start_label, duration: h.duration })),
      addSubtitle,
      subtitleStyle,
      autoMode: true,
    };
    sessionStorage.setItem("autoclip_batch", JSON.stringify(batch));
    router.push("/dashboard/generate");
    setUrl(""); setAutoStatus("idle"); setHighlights([]); setAddSubtitle(false);
  }

  // ── Manual mode logic ──
  function getLastClipEnd(currentClips: ClipEntry[]): number {
    if (currentClips.length === 0) return 0;
    return getClipEnd(currentClips[currentClips.length - 1]);
  }
  function updateWarnings(currentClips: ClipEntry[]) {
    setClipLimitWarning(currentClips.length >= MAX_CLIPS ? `Maksimal ${MAX_CLIPS} klip per generate.` : "");
    if (videoDuration !== null) {
      setVideoLimitWarning(getLastClipEnd(currentClips) >= videoDuration
        ? `Timeline sudah mencapai batas (${secondsToTime(videoDuration)}).` : "");
    } else { setVideoLimitWarning(""); }
  }
  function applyClips(nextClips: ClipEntry[]) { setClips(nextClips); updateWarnings(nextClips); }

  useEffect(() => {
    if (!isValidUrl || mode !== "manual") { setVideoDuration(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setVideoDurationLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/video-info?url=${encodeURIComponent(url.trim())}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setVideoDuration(typeof data.duration === "number" ? data.duration : null);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        setVideoDuration(null);
      } finally { if (!controller.signal.aborted) setVideoDurationLoading(false); }
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url, isValidUrl, mode]);

  useEffect(() => { updateWarnings(clips); }, [videoDuration, clips]);

  function canAddMoreClips(c: ClipEntry[]): boolean {
    if (c.length >= MAX_CLIPS) return false;
    return videoDuration === null || getLastClipEnd(c) < videoDuration;
  }
  function addClip() {
    if (clips.length >= MAX_CLIPS) { setClipLimitWarning(`Maksimal ${MAX_CLIPS} klip per generate.`); return; }
    const last = clips[clips.length - 1];
    const nextStart = getClipEnd(last);
    if (videoDuration !== null && nextStart >= videoDuration) {
      setVideoLimitWarning(`Timeline sudah penuh (${secondsToTime(videoDuration)}).`); return;
    }
    const remaining = videoDuration !== null ? videoDuration - nextStart : 30;
    const nextDur = videoDuration !== null ? Math.min(90, Math.max(10, remaining)) : 30;
    applyClips([...clips, { id: Math.max(...clips.map(c => c.id)) + 1, startTime: secondsToTime(nextStart), duration: nextDur, selected: true }]);
  }
  function removeClip(id: number) {
    if (clips.length <= 1) return;
    applyClips(recalculateStarts(clips.filter(c => c.id !== id), 1));
  }
  function updateClip(id: number, field: "startTime" | "duration" | "selected", value: string | number | boolean) {
    if (field === "selected") { applyClips(clips.map(c => c.id === id ? { ...c, selected: value as boolean } : c)); return; }
    const idx = clips.findIndex(c => c.id === id);
    if (idx === -1) return;
    const updated = clips.map(c => c.id === id ? { ...c, [field]: value } : c);
    applyClips(field === "duration" ? recalculateStarts(updated, idx + 1) : updated);
  }
  function formatTimeOnBlur(id: number, raw: string) {
    const parts = raw.split(":");
    let fmt = raw;
    if (parts.length === 1) fmt = `00:00:${parts[0].padStart(2, "0")}`;
    else if (parts.length === 2) fmt = `00:${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    else fmt = `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`;
    const idx = clips.findIndex(c => c.id === id);
    if (idx === -1) return;
    applyClips(recalculateStarts(clips.map(c => c.id === id ? { ...c, startTime: fmt } : c), idx + 1));
  }

  const selectedClips = clips.filter(c => c.selected);
  const hasClipBeyondVideo = videoDuration !== null && selectedClips.some(c => getClipEnd(c) > videoDuration);
  const manualValid = isValidUrl && selectedClips.length > 0
    && selectedClips.every(c => isValidTime(c.startTime) && c.duration >= 10 && c.duration <= 90)
    && !hasClipBeyondVideo;

  function handleManualGenerate() {
    if (!manualValid) return;
    const batch = {
      url: url.trim(),
      clips: selectedClips.map(clip => ({ start: timeToSeconds(clip.startTime), startTime: clip.startTime, duration: clip.duration })),
      addSubtitle,
      subtitleStyle,
    };
    sessionStorage.setItem("autoclip_batch", JSON.stringify(batch));
    router.push("/dashboard/generate");
    setUrl(""); setAddSubtitle(false);
    setClips([{ id: 1, startTime: "00:00:00", duration: 30, selected: true }]);
  }

  function handleLogout() { sessionStorage.removeItem("autoclip_user"); router.push("/"); }

  const videoId = getYouTubeId(url);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#000" }}>
      {/* ── Topbar ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "64px", display: "grid", gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center", padding: "0 40px",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }} onClick={() => router.push("/")}>
          <Image src="/logo.png" alt="Productive Clip" width={150} height={48} priority style={{ objectFit: "contain" }} />
        </div>

        {/* Nav center */}
        <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {/* Auto / Manual mode tabs */}
          {(["auto", "manual"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "7px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
              background: mode === m ? "rgba(255,255,255,0.06)" : "transparent",
              color: mode === m ? "#fff" : "rgba(255,255,255,0.7)",
              border: "none",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => { if (mode !== m) e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            >{m === "auto" ? "Auto" : "Manual"}</button>
          ))}
        </nav>

        {/* Right: user + logout */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "16px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "12px", fontWeight: 700, color: "#fff", border: "1px solid rgba(255,255,255,0.15)",
          }}>{username.charAt(0).toUpperCase()}</div>
          <button onClick={handleLogout} style={{
            background: "transparent", border: "none", color: "#fff",
            fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "color 0.2s",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "#fff")}
          >Keluar</button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, paddingTop: "80px", paddingBottom: "48px", paddingLeft: "32px", paddingRight: "32px", position: "relative" }}>
        <div aria-hidden style={{
          position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)",
          width: "700px", height: "700px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div className="animate-fade-up" style={{ marginBottom: "28px", textAlign: "center" }}>
            <h1 style={{ fontSize: "32px", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.4px" }}>Dashboard</h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", marginTop: "5px" }}>
              Halo, <span style={{ color: "#fff", fontWeight: 600 }}>{username}</span>! Selamat datang di ProductiveClip.
            </p>
          </div>

          {/* ════════════ AUTO MODE ════════════ */}
          {mode === "auto" && (
            <div className="animate-fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>

              {/* Left: URL + Analyze */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>Auto Highlight</h2>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: "5px 0 0" }}>
                    AI akan mencari momen terbaik di video secara otomatis.
                  </p>
                </div>

                {/* URL input */}
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)", marginBottom: "8px" }}>YouTube URL</label>
                <div style={{ position: "relative", marginBottom: "16px" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                  </span>
                  <input type="url" placeholder="https://www.youtube.com/watch?v=..."
                    value={url} onChange={e => { setUrl(e.target.value); setAutoStatus("idle"); setHighlights([]); }}
                    style={{
                      width: "100%", padding: "11px 16px 11px 38px", borderRadius: "12px",
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                      color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                  />
                </div>

                {/* Analyze button */}
                <button onClick={handleAutoAnalyze} disabled={!isValidUrl || autoStatus === "analyzing"} style={{
                  width: "100%", padding: "12px", borderRadius: "50px", marginBottom: "16px",
                  background: !isValidUrl || autoStatus === "analyzing" ? "rgba(255,255,255,0.08)" : "#fff",
                  color: !isValidUrl || autoStatus === "analyzing" ? "rgba(255,255,255,0.5)" : "#000",
                  border: "none", fontSize: "14px", fontWeight: 700,
                  cursor: !isValidUrl || autoStatus === "analyzing" ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  transition: "all 0.2s",
                }}
                  onMouseEnter={e => { if (isValidUrl && autoStatus !== "analyzing") e.currentTarget.style.background = "#e5e5e5"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = !isValidUrl || autoStatus === "analyzing" ? "rgba(255,255,255,0.08)" : "#fff"; }}
                >
                  {autoStatus === "analyzing" ? (
                    <>
                      <div className="animate-spin" style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "currentColor", flexShrink: 0 }} />
                      Menganalisa video... (bisa 30–60 detik)
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      Analisa & Temukan Momen Terbaik
                    </>                  )}
                </button>

                {/* Error */}
                {autoStatus === "error" && (
                  <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: "12px" }}>
                    {autoError}
                  </div>
                )}

                {/* Preview */}
                {videoId && (
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <iframe style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        src={`https://www.youtube.com/embed/${videoId}`} title="YouTube preview" frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                  </div>
                )}

                {!videoId && !url && (
                  <div style={{
                    borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)",
                    aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: "10px", color: "rgba(255,255,255,0.4)",
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="m10 8 5 3-5 3V8z" /><path d="M8 21h8M12 17v4" />
                    </svg>
                    <span style={{ fontSize: "12px" }}>Preview akan muncul di sini</span>
                  </div>
                )}
              </div>

              {/* Right: Highlight results + generate */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>Momen Terpilih</h2>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: "5px 0 0" }}>
                    {autoStatus === "ready" ? `${selectedHighlights.size} dari ${highlights.length} momen dipilih · Centang momen yang ingin di-generate.` : "Hasil analisa AI akan muncul di sini."}
                  {autoStatus === "ready" && transcriptSource === "whisper" && (
                    <span style={{ marginLeft: "6px", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>· via Whisper AI</span>
                  )}
                  </p>
                </div>

                {/* Idle placeholder */}
                {autoStatus === "idle" && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255,255,255,0.3)", padding: "40px 0", textAlign: "center" }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <p style={{ margin: 0, fontSize: "13px" }}>Paste URL dan klik "Analisa"<br />untuk menemukan momen terbaik</p>
                  </div>
                )}

                {/* Analyzing */}
                {autoStatus === "analyzing" && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "40px 0" }}>
                    <div className="animate-spin" style={{ width: "36px", height: "36px", borderRadius: "50%", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#fff" }} />
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: "14px", color: "#fff", fontWeight: 600 }}>Menganalisa video...</p>
                      <p style={{ margin: "6px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>AI membaca transcript & mencari highlight</p>
                    </div>
                  </div>
                )}
                {/* Results */}
                {autoStatus === "ready" && highlights.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px", flex: 1 }}>
                    {highlights.map((h, i) => {
                      const isSelected = selectedHighlights.has(i);
                      return (
                        <div key={i} onClick={() => toggleHighlight(i)} style={{
                          padding: "12px", borderRadius: "12px", cursor: "pointer",
                          background: isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                          border: isSelected ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
                          display: "flex", alignItems: "flex-start", gap: "12px",
                          transition: "all 0.2s",
                        }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)"; }}
                        >
                          {/* Checkbox */}
                          <div style={{
                            width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0, marginTop: "1px",
                            border: isSelected ? "2px solid #fff" : "2px solid rgba(255,255,255,0.3)",
                            background: isSelected ? "#fff" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                          }}>
                            {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 4 4 6.5 8.5 1.5" /></svg>}
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                              <span style={{
                                padding: "2px 7px", borderRadius: "6px", fontFamily: "monospace",
                                fontSize: "11px", fontWeight: 700, color: "#fff",
                                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
                                flexShrink: 0,
                              }}>{h.start_label}</span>
                              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{h.duration}s</span>
                            </div>
                            <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: isSelected ? "#fff" : "rgba(255,255,255,0.7)" }}>{h.title}</p>
                            <p style={{ margin: "3px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>{h.reason}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Subtitle toggle */}
                {autoStatus === "ready" && (
                  <div onClick={() => setAddSubtitle(v => !v)} style={{
                    display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px",
                    background: addSubtitle ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                    border: addSubtitle ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer", marginBottom: "12px", userSelect: "none", transition: "all 0.2s",
                  }}>
                    <div style={{
                      width: "36px", height: "20px", borderRadius: "10px", position: "relative", flexShrink: 0,
                      background: addSubtitle ? "#fff" : "rgba(255,255,255,0.15)",
                      transition: "background 0.2s", border: addSubtitle ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.2)",
                    }}>
                      <div style={{
                        width: "14px", height: "14px", borderRadius: "50%", position: "absolute", top: "2px",
                        left: addSubtitle ? "18px" : "2px", background: addSubtitle ? "#000" : "#fff",
                        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }} />
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "#fff" }}>
                      Tambah Subtitle Otomatis
                      <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.5)", marginLeft: "6px" }}>· Whisper AI</span>
                    </p>
                  </div>
                )}

                {/* Style picker for auto mode */}
                {autoStatus === "ready" && addSubtitle && (
                  <div style={{ marginBottom: "12px", padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "11px", color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Style Subtitle</p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {(["beasty", "youshaei", "mozi"] as const).map(s => {
                        const labels: Record<string, string> = { beasty: "Beasty", youshaei: "Youshaei", mozi: "Mozi" };
                        const isActive = subtitleStyle === s;
                        return (
                          <button key={s} onClick={() => setSubtitleStyle(s)} style={{
                            flex: 1, padding: "10px 6px", borderRadius: "10px", cursor: "pointer",
                            background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
                            border: isActive ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                          }}>
                            <div style={{ background: "#1a1a1a", borderRadius: "6px", padding: "6px 8px", width: "100%", textAlign: "center", minHeight: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {s === "beasty" && <span style={{ fontSize: "11px", fontWeight: 900, fontStyle: "italic", color: "#fff", textShadow: "1px 1px 3px #000, 2px 2px 4px #000" }}>TO GET</span>}
                              {s === "youshaei" && <span style={{ fontSize: "10px", fontWeight: 700 }}><span style={{ color: "#00ff00" }}>TO </span><span style={{ color: "rgba(255,255,255,0.5)" }}>GET STARTED</span></span>}
                              {s === "mozi" && <span style={{ fontSize: "10px", fontWeight: 900 }}><span style={{ color: "#fff" }}>TO </span><span style={{ color: "#00ff00" }}>GET </span><span style={{ color: "#fff" }}>STARTED</span></span>}
                            </div>
                            <span style={{ fontSize: "10px", color: isActive ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: 600 }}>{labels[s]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Generate button */}
                <button onClick={handleAutoGenerate}
                  disabled={autoStatus !== "ready" || selectedHighlights.size === 0}
                  style={{
                    width: "100%", padding: "13px", borderRadius: "50px",
                    background: autoStatus === "ready" && selectedHighlights.size > 0 ? "#fff" : "rgba(255,255,255,0.08)",
                    color: autoStatus === "ready" && selectedHighlights.size > 0 ? "#000" : "rgba(255,255,255,0.4)",
                    border: "none", fontSize: "15px", fontWeight: 700,
                    cursor: autoStatus === "ready" && selectedHighlights.size > 0 ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { if (autoStatus === "ready" && selectedHighlights.size > 0) e.currentTarget.style.background = "#e5e5e5"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = autoStatus === "ready" && selectedHighlights.size > 0 ? "#fff" : "rgba(255,255,255,0.08)"; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  {autoStatus === "ready" && selectedHighlights.size > 0
                    ? `Generate ${selectedHighlights.size} Klip Otomatis`
                    : "Generate Klip"}
                </button>
              </div>
            </div>
          )}

          {/* ════════════ MANUAL MODE ════════════ */}
          {mode === "manual" && (
            <div className="animate-fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>

              {/* Left: URL + Preview */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>Video Sumber</h2>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: "5px 0 0" }}>Paste URL YouTube untuk memulai.</p>
                </div>

                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)", marginBottom: "8px" }}>YouTube URL</label>
                <div style={{ position: "relative", marginBottom: "20px" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                  </span>
                  <input type="url" placeholder="https://www.youtube.com/watch?v=..."
                    value={url} onChange={e => setUrl(e.target.value)}
                    style={{
                      width: "100%", padding: "11px 16px 11px 38px", borderRadius: "12px",
                      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                      color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                  />
                </div>

                {/* Preview */}
                {videoId ? (
                  <div>
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <iframe style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        src={`https://www.youtube.com/embed/${videoId}`} title="YouTube video player" frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Preview Video</span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff", background: "rgba(255,255,255,0.08)", padding: "3px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)" }}>
                        {videoDurationLoading ? "Mengambil durasi..." : videoDuration !== null ? `Total: ${secondsToTime(videoDuration)}` : "Durasi tidak diketahui"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)",
                    aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: "10px", color: "rgba(255,255,255,0.4)",
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="m10 8 5 3-5 3V8z" /><path d="M8 21h8M12 17v4" />
                    </svg>
                    <span style={{ fontSize: "12px" }}>Preview akan muncul di sini</span>
                  </div>
                )}
              </div>

              {/* Right: Clips form */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0 }}>Pengaturan Klip</h2>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: "5px 0 0" }}>Tambah hingga {MAX_CLIPS} klip dengan waktu berbeda.</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>Daftar Klip ({clips.length}/{MAX_CLIPS})</label>
                  {canAddMoreClips(clips) && (
                    <button onClick={addClip} style={{
                      padding: "5px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff",
                      display: "flex", alignItems: "center", gap: "5px", transition: "all 0.2s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Tambah Klip
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                  {clips.map((clip, idx) => {
                    const isDurationInvalid = clip.selected && (clip.duration < 10 || clip.duration > 90);
                    return (
                      <div key={clip.id} style={{
                        display: "flex", flexDirection: "column", gap: "8px", padding: "12px", borderRadius: "12px",
                        background: clip.selected ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                        border: clip.selected ? (isDurationInvalid ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.08)") : "1px solid rgba(255,255,255,0.04)",
                        opacity: clip.selected ? 1 : 0.65, transition: "all 0.2s",
                      }}>
                        <div style={{ display: "grid", gridTemplateColumns: clips.length > 1 ? "auto auto 1fr 1fr auto" : "auto auto 1fr 1fr", gap: "10px", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }} onClick={() => updateClip(clip.id, "selected", !clip.selected)}>
                            <div style={{
                              width: "18px", height: "18px", borderRadius: "4px",
                              border: clip.selected ? "2px solid #fff" : "2px solid rgba(255,255,255,0.3)",
                              background: clip.selected ? "#fff" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                            }}>
                              {clip.selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 4 4 6.5 8.5 1.5" /></svg>}
                            </div>
                          </div>
                          <div style={{
                            width: "28px", height: "28px", borderRadius: "8px",
                            background: clip.selected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                            border: clip.selected ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.08)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: 700, color: clip.selected ? "#fff" : "rgba(255,255,255,0.4)", flexShrink: 0,
                          }}>{idx + 1}</div>
                          <div>
                            <label style={{ display: "block", fontSize: "10px", color: "rgba(255,255,255,0.5)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Start</label>
                            <input type="text" placeholder="00:00:00" value={clip.startTime} disabled={!clip.selected}
                              onChange={e => updateClip(clip.id, "startTime", e.target.value.replace(/[^0-9:]/g, ""))}
                              onBlur={() => formatTimeOnBlur(clip.id, clip.startTime)}
                              style={{
                                width: "100%", padding: "7px 10px", borderRadius: "8px",
                                background: "rgba(255,255,255,0.05)", border: `1px solid ${isValidTime(clip.startTime) ? "rgba(255,255,255,0.1)" : "#ef444460"}`,
                                color: clip.selected ? "#fff" : "rgba(255,255,255,0.4)", fontSize: "13px", fontFamily: "monospace",
                                outline: "none", boxSizing: "border-box", cursor: !clip.selected ? "not-allowed" : "text",
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "10px", color: "rgba(255,255,255,0.5)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Durasi (dtk)</label>
                            <input type="number" min={10} max={90} value={clip.duration} disabled={!clip.selected}
                              onChange={e => updateClip(clip.id, "duration", Number(e.target.value))}
                              onBlur={e => { const v = Math.max(10, Math.min(90, Number(e.target.value) || 10)); updateClip(clip.id, "duration", v); }}
                              style={{
                                width: "100%", padding: "7px 10px", borderRadius: "8px",
                                background: "rgba(255,255,255,0.05)", border: `1px solid ${isDurationInvalid ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)"}`,
                                color: clip.selected ? "#fff" : "rgba(255,255,255,0.4)", fontSize: "13px",
                                outline: "none", boxSizing: "border-box", cursor: !clip.selected ? "not-allowed" : "default",
                              }}
                            />
                          </div>
                          {clips.length > 1 && (
                            <button onClick={() => removeClip(clip.id)} style={{
                              width: "28px", height: "28px", borderRadius: "8px",
                              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", color: "#f87171", alignSelf: "end", marginBottom: "2px", transition: "all 0.2s",
                            }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {isDurationInvalid && (
                          <div style={{ fontSize: "11px", color: "#f87171", display: "flex", alignItems: "center", gap: "5px", paddingLeft: "42px" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>{clip.duration < 10 ? "Min 10 detik!" : "Maks 90 detik!"}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Subtitle toggle */}
                <div onClick={() => setAddSubtitle(v => !v)} style={{
                  display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px",
                  background: addSubtitle ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  border: addSubtitle ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer", marginBottom: addSubtitle ? "8px" : "12px", userSelect: "none", transition: "all 0.2s",
                }}>
                  <div style={{
                    width: "36px", height: "20px", borderRadius: "10px", position: "relative", flexShrink: 0,
                    background: addSubtitle ? "#fff" : "rgba(255,255,255,0.15)", transition: "background 0.2s",
                    border: addSubtitle ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.2)",
                  }}>
                    <div style={{
                      width: "14px", height: "14px", borderRadius: "50%", position: "absolute", top: "2px",
                      left: addSubtitle ? "18px" : "2px", background: addSubtitle ? "#000" : "#fff",
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#fff" }}>Tambah Subtitle Otomatis</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
                      Transkripsi audio dengan AI (Whisper) · proses lebih lama
                    </p>
                  </div>
                </div>

                {/* Style picker — shown only when subtitle is ON */}
                {addSubtitle && (
                  <div style={{ marginBottom: "12px", padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "11px", color: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Style Subtitle</p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {(["beasty", "youshaei", "mozi"] as const).map(s => {
                        const labels: Record<string, string> = { beasty: "Beasty", youshaei: "Youshaei", mozi: "Mozi" };
                        const previews: Record<string, { text: string; color: string }> = {
                          beasty:   { text: "TO GET",         color: "#fff" },
                          youshaei: { text: "TO GET STARTED", color: "#00ff00" },
                          mozi:     { text: "TO GET STARTED", color: "#00ff00" },
                        };
                        const isActive = subtitleStyle === s;
                        return (
                          <button key={s} onClick={() => setSubtitleStyle(s)} style={{
                            flex: 1, padding: "10px 6px", borderRadius: "10px", cursor: "pointer",
                            background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.03)",
                            border: isActive ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
                            transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                          }}>
                            {/* Mini preview */}
                            <div style={{ background: "#1a1a1a", borderRadius: "6px", padding: "6px 8px", width: "100%", textAlign: "center", minHeight: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {s === "beasty" && <span style={{ fontSize: "11px", fontWeight: 900, fontStyle: "italic", color: "#fff", textShadow: "1px 1px 3px #000, 2px 2px 4px #000", letterSpacing: "0.5px" }}>TO GET</span>}
                              {s === "youshaei" && <span style={{ fontSize: "10px", fontWeight: 700, color: "#fff" }}><span style={{ color: "#00ff00" }}>TO </span><span style={{ color: "rgba(255,255,255,0.5)" }}>GET STARTED</span></span>}
                              {s === "mozi" && <span style={{ fontSize: "10px", fontWeight: 900 }}><span style={{ color: "#fff" }}>TO </span><span style={{ color: "#00ff00" }}>GET </span><span style={{ color: "#fff" }}>STARTED</span></span>}
                            </div>
                            <span style={{ fontSize: "10px", color: isActive ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: 600 }}>{labels[s]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(clipLimitWarning || videoLimitWarning || hasClipBeyondVideo) && (
                  <div style={{ marginBottom: "12px", padding: "10px 14px", borderRadius: "10px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24", fontSize: "12px", lineHeight: 1.6 }}>
                    {clipLimitWarning && <p style={{ margin: 0 }}>{clipLimitWarning}</p>}
                    {videoLimitWarning && <p style={{ margin: clipLimitWarning ? "4px 0 0" : 0 }}>{videoLimitWarning}</p>}
                    {hasClipBeyondVideo && videoDuration !== null && (
                      <p style={{ margin: "4px 0 0" }}>Ada klip yang melebihi durasi video ({secondsToTime(videoDuration)}).</p>
                    )}
                  </div>
                )}

                <button onClick={handleManualGenerate} disabled={!manualValid} style={{
                  width: "100%", padding: "13px", borderRadius: "50px",
                  background: manualValid ? "#fff" : "rgba(255,255,255,0.08)",
                  color: manualValid ? "#000" : "rgba(255,255,255,0.4)", border: "none",
                  fontSize: "15px", fontWeight: 700, cursor: manualValid ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  transition: "all 0.2s", marginTop: "auto",
                }}
                  onMouseEnter={e => { if (manualValid) e.currentTarget.style.background = "#e5e5e5"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = manualValid ? "#fff" : "rgba(255,255,255,0.08)"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  Generate {selectedClips.length} Klip
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}