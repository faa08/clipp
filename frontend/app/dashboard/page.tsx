"use client";

import { useState, useEffect, useRef } from "react";
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

/* ── Generate Modal Types ── */
interface ModalClipJob { start: number; startTime: string; duration: number; }
interface ModalClipResult { clip_url: string; filename: string; message: string; transcript?: string; }
interface ModalBatch { url: string; clips: ModalClipJob[]; addSubtitle?: boolean; autoMode?: boolean; subtitleStyle?: string; layout?: string; }
type ModalPlatform = "instagram" | "tiktok" | "youtube";

/* ── Global Styles injected once ── */
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  @keyframes water-wave { 0%,100% { transform: translateX(0) scaleY(1); } 50% { transform: translateX(-14px) scaleY(1.4); } }
  @keyframes water-wave-alt { 0%,100% { transform: translateX(0) scaleY(1.2); } 50% { transform: translateX(10px) scaleY(0.7); } }
  @keyframes water-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
  @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse-glow { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes scaleIn { from { opacity:0; transform: scale(0.92); } to { opacity:1; transform: scale(1); } }

  .db-card {
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 28px;
    transition: border-color 0.25s, box-shadow 0.25s;
    position: relative;
    overflow: hidden;
  }
  .db-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%);
    pointer-events: none;
  }
  .db-card:hover {
    border-color: rgba(255,255,255,0.13);
    box-shadow: 0 8px 40px rgba(0,0,0,0.4);
  }

  .db-btn-primary {
    width: 100%;
    padding: 14px 20px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%);
    color: #000;
    font-size: 14px;
    font-weight: 700;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
    box-shadow: 0 4px 20px rgba(255,255,255,0.08), 0 1px 0 rgba(255,255,255,0.2) inset;
    letter-spacing: -0.1px;
  }
  .db-btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #f5f5f5 0%, #ddd 100%);
    box-shadow: 0 6px 28px rgba(255,255,255,0.14), 0 1px 0 rgba(255,255,255,0.3) inset;
    transform: translateY(-1px);
  }
  .db-btn-primary:active:not(:disabled) { transform: translateY(0); }
  .db-btn-primary:disabled {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.3);
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .db-btn-ghost {
    padding: 10px 18px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.75);
    font-size: 13px;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }
  .db-btn-ghost:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.22);
    color: #fff;
    transform: translateY(-1px);
  }

  .db-btn-danger-ghost {
    padding: 10px 18px;
    border-radius: 12px;
    border: 1px solid rgba(239,68,68,0.2);
    background: rgba(239,68,68,0.06);
    color: rgba(248,113,113,0.85);
    font-size: 13px;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }
  .db-btn-danger-ghost:hover {
    background: rgba(239,68,68,0.12);
    border-color: rgba(239,68,68,0.4);
    color: #f87171;
  }

  .db-input {
    width: 100%;
    padding: 12px 16px 12px 42px;
    border-radius: 14px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #fff;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
    box-sizing: border-box;
  }
  .db-input:focus {
    border-color: rgba(255,255,255,0.35);
    background: rgba(255,255,255,0.07);
    box-shadow: 0 0 0 3px rgba(255,255,255,0.04);
  }
  .db-input::placeholder { color: rgba(255,255,255,0.3); }

  .db-input-small {
    width: 100%;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #fff;
    font-size: 13px;
    font-family: 'Inter', monospace;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }
  .db-input-small:focus {
    border-color: rgba(255,255,255,0.3);
    box-shadow: 0 0 0 3px rgba(255,255,255,0.04);
  }

  .db-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 700;
    font-family: monospace;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.75);
  }

  .db-section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    font-family: 'Inter', sans-serif;
    margin: 0 0 10px;
  }

  .db-highlight-card {
    padding: 14px;
    border-radius: 14px;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    transition: all 0.2s;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
  }
  .db-highlight-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
  .db-highlight-card.selected { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.18); }

  .db-toggle-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    border-radius: 14px;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
  }
  .db-toggle-row:hover { background: rgba(255,255,255,0.055); border-color: rgba(255,255,255,0.13); }
  .db-toggle-row.active { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.18); }

  .db-style-btn {
    flex: 1;
    padding: 10px 6px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    font-family: 'Inter', sans-serif;
  }
  .db-style-btn:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.18); }
  .db-style-btn.active { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); box-shadow: 0 2px 12px rgba(255,255,255,0.05); }

  .db-clip-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    transition: all 0.2s;
  }
  .db-clip-row.selected { background: rgba(255,255,255,0.045); border-color: rgba(255,255,255,0.1); }
  .db-clip-row.invalid { border-color: rgba(239,68,68,0.45); }

  .db-checkbox {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    cursor: pointer;
  }

  .db-nav-btn {
    padding: 7px 16px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    border: none;
    background: transparent;
    color: rgba(255,255,255,0.5);
    font-family: 'Inter', sans-serif;
    position: relative;
    letter-spacing: -0.1px;
  }
  .db-nav-btn:hover { color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.06); }
  .db-nav-btn.active { color: #fff; font-weight: 700; background: rgba(255,255,255,0.08); }

  .db-empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    color: rgba(255,255,255,0.25);
    padding: 48px 20px;
    text-align: center;
  }

  .db-fade-up { animation: fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }

  .db-spinner {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2.5px solid rgba(255,255,255,0.15);
    border-top-color: currentColor;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
`;

function GenerateModal({ batch, onClose, isMobile }: { batch: ModalBatch; onClose: () => void; isMobile: boolean }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [currentStep, setCurrentStep] = useState(1);
  const [results, setResults] = useState<ModalClipResult[]>([]);
  const [clipJobs, setClipJobs] = useState<ModalClipJob[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [totalClips, setTotalClips] = useState(1);
  const [loadingText, setLoadingText] = useState("Menghubungkan ke API...");
  const [withSubtitle, setWithSubtitle] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [clipCaptions, setClipCaptions] = useState<Array<Record<ModalPlatform, string>>>([]);
  const [clipCaptionStatus, setClipCaptionStatus] = useState<Array<"idle" | "loading" | "done" | "error">>([]);
  const [activePlatforms, setActivePlatforms] = useState<ModalPlatform[]>([]);
  const [copiedKeys, setCopiedKeys] = useState<Record<string, boolean>>({});
  const [progressPct, setProgressPct] = useState(0);
  const activeRef = useRef(true);

  async function generateOne(videoUrl: string, clip: ModalClipJob, addSubtitle: boolean, subtitleStyle: string, layoutVal: string): Promise<ModalClipResult> {
    if (!activeRef.current) throw new Error("Dibatalkan");
    setCurrentStep(1);
    setLoadingText("Mengunduh bagian video dari YouTube (yt-dlp)...");
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (!activeRef.current) throw new Error("Dibatalkan");
    setCurrentStep(2);
    setLoadingText("Mengekstrak klip video (MoviePy)...");
    const res = await fetch("http://localhost:8000/generate-clip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: videoUrl, start_time: clip.start, duration: clip.duration, add_subtitle: addSubtitle, subtitle_style: subtitleStyle, layout: layoutVal }),
    });
    if (addSubtitle && activeRef.current) { setCurrentStep(3); setLoadingText("Transkripsi audio dengan Whisper AI..."); }
    if (!res.ok) { const err = await res.json().catch(() => ({ detail: "Gagal memproses video" })); throw new Error(err.detail ?? "Gagal memproses video"); }
    return res.json();
  }

  useEffect(() => {
    activeRef.current = true;
    async function runGeneration() {
      const jobs = batch.clips.map(clip => ({ videoUrl: batch.url, clip }));
      if (jobs.length === 0) { setErrorMsg("Data klip tidak ditemukan"); setStatus("error"); return; }
      setClipJobs(jobs.map(j => j.clip));
      setTotalClips(jobs.length);
      const addSubtitle = batch.addSubtitle ?? false;
      setWithSubtitle(addSubtitle);
      setIsAutoMode(batch.autoMode ?? false);
      const subtitleStyle = batch.subtitleStyle ?? "mozi";
      const layoutVal = batch.layout ?? "blur";
      const completed: ModalClipResult[] = [];
      const errors: string[] = [];
      try {
        for (let i = 0; i < jobs.length; i++) {
          if (!activeRef.current) return;
          setCurrentClipIndex(i + 1);
          setCurrentStep(1);
          setLoadingText(jobs.length > 1 ? `Memproses klip ${i + 1} dari ${jobs.length}...` : "Mengunduh bagian video dari YouTube (yt-dlp)...");
          try {
            const data = await generateOne(jobs[i].videoUrl, jobs[i].clip, addSubtitle, subtitleStyle, layoutVal);
            if (!activeRef.current) return;
            setCurrentStep(addSubtitle ? 4 : 3);
            setLoadingText(jobs.length > 1 ? `Klip ${i + 1} selesai!` : "Klip selesai dibuat!");
            completed.push(data);
            setResults([...completed]);
          } catch (e: unknown) { errors.push(`Klip ${i + 1}: ${e instanceof Error ? e.message : "Terjadi kesalahan"}`); }
        }
        if (!activeRef.current) return;
        sessionStorage.removeItem("autoclip_batch");
        if (completed.length === 0) { setErrorMsg(errors.join("\n")); setStatus("error"); return; }
        if (errors.length > 0) setErrorMsg(`${completed.length} klip berhasil, ${errors.length} gagal:\n${errors.join("\n")}`);
        setStatus("success");
        const initialStatuses = completed.map(r => r.transcript ? "loading" as const : "idle" as const);
        const initialCaptions = completed.map(() => ({ instagram: "", tiktok: "", youtube: "" }));
        const initialPlatforms: ModalPlatform[] = completed.map(() => "instagram");
        setClipCaptions(initialCaptions);
        setClipCaptionStatus(initialStatuses);
        setActivePlatforms(initialPlatforms);
        completed.forEach(async (clipResult, idx) => {
          if (!clipResult.transcript || !activeRef.current) return;
          try {
            const capRes = await fetch("http://localhost:8000/generate-caption", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: clipResult.transcript }) });
            if (!activeRef.current) return;
            if (capRes.ok) {
              const capData = await capRes.json();
              setClipCaptions(prev => { const next = [...prev]; next[idx] = { instagram: capData.instagram, tiktok: capData.tiktok, youtube: capData.youtube }; return next; });
              setClipCaptionStatus(prev => { const next = [...prev]; next[idx] = "done"; return next; });
            } else { setClipCaptionStatus(prev => { const next = [...prev]; next[idx] = "error"; return next; }); }
          } catch { if (!activeRef.current) return; setClipCaptionStatus(prev => { const next = [...prev]; next[idx] = "error"; return next; }); }
        });
      } catch (e: unknown) { if (!activeRef.current) return; setErrorMsg(e instanceof Error ? e.message : "Terjadi kesalahan"); setStatus("error"); }
    }
    runGeneration();
    return () => { activeRef.current = false; };
  }, []);

  useEffect(() => {
    if (status !== "loading") { setProgressPct(0); return; }
    setProgressPct(0);
    const targets = [8, 20, 35, 55, 72, 85, 92, 97];
    const intervals = [1200, 2500, 4000, 8000, 15000, 25000, 40000];
    const timers = intervals.map((ms, i) => setTimeout(() => { if (i + 1 < targets.length) setProgressPct(targets[i + 1]); }, ms));
    return () => timers.forEach(clearTimeout);
  }, [status]);

  async function copyCaption(clipIdx: number, platform: ModalPlatform) {
    const text = clipCaptions[clipIdx]?.[platform];
    if (!text) return;
    const key = `${clipIdx}-${platform}`;
    try { await navigator.clipboard.writeText(text); setCopiedKeys(prev => ({ ...prev, [key]: true })); setTimeout(() => setCopiedKeys(prev => { const n = { ...prev }; delete n[key]; return n; }), 2000); } catch { /* fallback */ }
  }
  function setClipPlatform(clipIdx: number, platform: ModalPlatform) { setActivePlatforms(prev => { const n = [...prev]; n[clipIdx] = platform; return n; }); }
  async function downloadClip(clipResult: ModalClipResult) {
    setDownloadingId(clipResult.filename);
    try { const res = await fetch(clipResult.clip_url); if (!res.ok) throw new Error("Gagal mengunduh file"); const blob = await res.blob(); const objectUrl = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = objectUrl; a.download = clipResult.filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(objectUrl); } catch (e: unknown) { console.error(e); } finally { setDownloadingId(null); }
  }

  function handleCancel() {
    activeRef.current = false;
    onClose();
  }

  const steps = withSubtitle
    ? [{ id: 1, label: "Unduh" }, { id: 2, label: "Ekstrak" }, { id: 3, label: "Subtitle" }, { id: 4, label: "Selesai" }]
    : [{ id: 1, label: "Unduh" }, { id: 2, label: "Ekstrak" }, { id: 3, label: "Selesai" }];
  const loadingTitle = isAutoMode
    ? totalClips > 1 ? `Auto Generate (${currentClipIndex}/${totalClips})` : "Auto Generate Klip"
    : totalClips > 1 ? `Sedang Membuat Klip (${currentClipIndex}/${totalClips})` : "Sedang Membuat Klip";

  return (
    <>
      {/* Backdrop */}
      <div onClick={status !== "loading" ? onClose : undefined} style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        cursor: status !== "loading" ? "pointer" : "default",
      }} />

      {/* Modal content */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        zIndex: 1000, width: "min(640px, 95vw)", maxHeight: "90vh", overflowY: "auto",
        background: "linear-gradient(160deg, #111 0%, #0d0d0d 100%)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "24px", padding: isMobile ? "22px 18px" : "32px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04) inset",
        animation: "scaleIn 0.2s cubic-bezier(0.22,1,0.36,1)",
      }}>
        <style>{GLOBAL_STYLES}</style>

        {/* Close button */}
        {status !== "loading" && (
          <button onClick={onClose} style={{
            position: "absolute", top: "16px", right: "16px",
            width: "32px", height: "32px", borderRadius: "50%",
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          >×</button>
        )}

        {/* ── LOADING ── */}
        {status === "loading" && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
              <div>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "2px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontFamily: "monospace" }}>Processing Pipeline</p>
                <p style={{ margin: "6px 0 0", fontSize: "22px", fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", fontFamily: "'Inter', sans-serif" }}>{loadingTitle}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "6px 12px", borderRadius: "20px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#fbbf24", boxShadow: "0 0 8px #fbbf24", animation: "pulse-glow 1.5s ease-in-out infinite" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", color: "#fbbf24", fontFamily: "monospace" }}>LIVE</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "20px", marginBottom: "28px", alignItems: "center", flexDirection: isMobile ? "column" : "row" }}>
              {/* Water fill progress */}
              <div style={{
                position: "relative", width: "140px", height: "140px", borderRadius: "20px",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                overflow: "hidden", flexShrink: 0,
              }}>
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  height: `${progressPct}%`,
                  background: "linear-gradient(to top, rgba(59,130,246,0.55), rgba(96,165,250,0.2))",
                  transition: "height 1.2s cubic-bezier(0.4,0,0.2,1)",
                  animation: "water-bob 2s ease-in-out infinite",
                }}>
                  <div style={{ position: "absolute", top: "-8px", left: "-30px", right: "-30px", height: "20px", borderRadius: "45%", background: "rgba(59,130,246,0.6)", animation: "water-wave 2.2s ease-in-out infinite" }} />
                  <div style={{ position: "absolute", top: "-5px", left: "-20px", right: "-20px", height: "16px", borderRadius: "48%", background: "rgba(96,165,250,0.4)", animation: "water-wave-alt 2.8s ease-in-out infinite" }} />
                </div>
                <div style={{
                  position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", zIndex: 10,
                  fontFamily: "monospace", fontSize: "32px", fontWeight: 900, letterSpacing: "-1px",
                  color: "#fff",
                }}>
                  <span>{progressPct}%</span>
                  <div style={{ width: "64px", height: "3px", marginTop: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: "2px", width: `${progressPct}%`, background: "rgba(255,255,255,0.7)", transition: "width 1s ease" }} />
                  </div>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <p className="db-section-label">Sub-Task Aktif</p>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px", padding: "12px 14px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="db-spinner" />
                  <span style={{ fontSize: "13px", color: "#fff", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>{loadingText}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div style={{ padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ margin: "0 0 3px", fontSize: "9px", fontWeight: 700, letterSpacing: "1px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontFamily: "monospace" }}>Hardware</p>
                    <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>LOCAL-CPU</p>
                  </div>
                  <div style={{ padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ margin: "0 0 3px", fontSize: "9px", fontWeight: 700, letterSpacing: "1px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontFamily: "monospace" }}>ETA</p>
                    <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>STREAM DEP.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pipeline milestones */}
            <p className="db-section-label">Pipeline Milestones</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: isMobile ? "wrap" : "nowrap", marginBottom: "24px" }}>
              {steps.map((step) => {
                const isActive = currentStep === step.id;
                const isPassed = currentStep > step.id;
                const subTexts: Record<string, string> = { "Unduh": "Fetch source video.", "Ekstrak": "Extract clip segment.", "Subtitle": "Burn subtitles.", "Selesai": "Finalize & export." };
                return (
                  <div key={step.id} style={{
                    flex: 1, padding: "12px", borderRadius: "12px",
                    background: isActive ? "rgba(255,255,255,0.08)" : isPassed ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                    border: isActive ? "1px solid rgba(255,255,255,0.22)" : isPassed ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.05)",
                    transition: "all 0.4s",
                  }}>
                    <p style={{ margin: "0 0 4px", fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>{String(step.id).padStart(2, "0")}</p>
                    <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 800, color: isActive ? "#fff" : isPassed ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", letterSpacing: "0.5px", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>{isPassed ? "✓ " : ""}{step.label}</p>
                    <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>{subTexts[step.label] ?? "Processing..."}</p>
                  </div>
                );
              })}
            </div>

            {/* Cancel button */}
            <button onClick={handleCancel} className="db-btn-danger-ghost" style={{ width: "100%", justifyContent: "center", padding: "12px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Batalkan Proses
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {status === "success" && results.length > 0 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "28px" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "radial-gradient(circle, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.05) 100%)",
                border: "1px solid rgba(34,197,94,0.35)", display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "#22c55e", fontSize: "26px", marginBottom: "16px",
                boxShadow: "0 0 24px rgba(34,197,94,0.15)",
              }}>✓</div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.4px", fontFamily: "'Inter', sans-serif" }}>
                {results.length > 1 ? `${results.length} Klip Berhasil Dibuat!` : "Klip Berhasil Dibuat!"}
              </h2>
              {errorMsg && <p style={{ fontSize: "12px", color: "#fbbf24", marginTop: "8px", whiteSpace: "pre-line" }}>{errorMsg}</p>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "20px" }}>
              {results.map((clipResult, idx) => {
                const capStatus = clipCaptionStatus[idx] ?? "idle";
                const capData = clipCaptions[idx] ?? { instagram: "", tiktok: "", youtube: "" };
                const platform = activePlatforms[idx] ?? "instagram";
                const hasCap = capStatus !== "idle";
                const copyKey = `${idx}-${platform}`;
                const isCopied = !!copiedKeys[copyKey];
                return (
                  <div key={clipResult.filename} style={{ display: "grid", gridTemplateColumns: hasCap ? (isMobile ? "1fr" : "1fr 1fr") : "minmax(0,480px)", justifyContent: hasCap ? "stretch" : "center", gap: "16px", alignItems: "start" }}>
                    {/* Video card */}
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "16px" }}>
                      {results.length > 1 && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>Klip {idx + 1}</span>
                          <span className="db-tag">{clipJobs[idx]?.startTime ?? "00:00:00"} · {clipJobs[idx]?.duration ?? 0}s</span>
                        </div>
                      )}
                      <div style={{ borderRadius: "10px", overflow: "hidden", background: "#000", marginBottom: "12px" }}>
                        <video controls preload="metadata" playsInline src={clipResult.clip_url} style={{ width: "100%", maxHeight: "220px", objectFit: "contain", display: "block" }} />
                      </div>
                      <button onClick={() => downloadClip(clipResult)} disabled={downloadingId === clipResult.filename} className="db-btn-primary" style={{ borderRadius: "12px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        {downloadingId === clipResult.filename ? "Mengunduh..." : "Download Klip"}
                      </button>
                    </div>

                    {hasCap && (
                      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff", fontFamily: "'Inter', sans-serif" }}>Caption {results.length > 1 ? `Klip ${idx + 1}` : ""}</span>
                          {capStatus === "loading" && <div className="db-spinner" style={{ width: "13px", height: "13px" }} />}
                        </div>
                        {capStatus === "loading" && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "0 0 12px" }}>Groq AI sedang menulis caption...</p>}
                        {capStatus === "error" && <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>Gagal generate caption.</p>}
                        {capStatus === "done" && (
                          <>
                            <div style={{ display: "flex", gap: "5px", marginBottom: "12px", flexWrap: "wrap" }}>
                              {(["instagram", "tiktok", "youtube"] as ModalPlatform[]).map(p => {
                                const labels: Record<ModalPlatform, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YT Shorts" };
                                const isActive = platform === p;
                                return (
                                  <button key={p} onClick={() => setClipPlatform(idx, p)} style={{
                                    padding: "5px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                                    background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                                    border: isActive ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
                                    color: isActive ? "#fff" : "rgba(255,255,255,0.45)", transition: "all 0.15s",
                                    fontFamily: "'Inter', sans-serif",
                                  }}>{labels[p]}</button>
                                );
                              })}
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "12px", marginBottom: "12px" }}>
                              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "160px", overflowY: "auto" }}>{capData[platform]}</p>
                            </div>
                            <button onClick={() => copyCaption(idx, platform)} style={{
                              width: "100%", padding: "9px", borderRadius: "10px",
                              border: isCopied ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.12)",
                              background: isCopied ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.05)",
                              color: isCopied ? "#22c55e" : "rgba(255,255,255,0.8)", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.2s",
                              fontFamily: "'Inter', sans-serif",
                            }}>
                              {isCopied
                                ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>Tersalin!</>
                                : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copy Caption</>
                              }
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={onClose} className="db-btn-primary" style={{ borderRadius: "14px", padding: "15px", fontSize: "15px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7-7 7 7" /></svg>
              Generate Video Baru
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "radial-gradient(circle, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.05) 100%)",
              border: "1px solid rgba(239,68,68,0.35)", display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#f87171", fontSize: "24px", marginBottom: "16px",
              boxShadow: "0 0 24px rgba(239,68,68,0.12)",
            }}>!</div>
            <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#fca5a5", marginBottom: "12px", fontFamily: "'Inter', sans-serif" }}>Gagal Membuat Klip</h2>
            <div style={{ color: "rgba(252,165,165,0.85)", fontSize: "13px", textAlign: "left", marginBottom: "28px", wordBreak: "break-word", padding: "14px", borderRadius: "12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <span style={{ fontWeight: 700 }}>Detail Error: </span>{errorMsg}
            </div>
            <button onClick={onClose} className="db-btn-primary" style={{ borderRadius: "14px", padding: "14px", fontSize: "14px" }}>
              Coba Lagi
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [username, setUsername] = useState("User");
  const [mode, setMode] = useState<"auto" | "manual">("auto");

  // ── Shared ──
  const [url, setUrl] = useState("");
  const [addSubtitle, setAddSubtitle] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState<"beasty" | "youshaei" | "mozi">("mozi");
  const [layout, setLayout] = useState<"blur" | "split">("blur");

  // ── Auto mode ──
  const [autoStatus, setAutoStatus] = useState<"idle" | "analyzing" | "ready" | "error">("idle");
  const [autoError, setAutoError] = useState("");
  const [highlights, setHighlights] = useState<HighlightClip[]>([]);
  const [selectedHighlights, setSelectedHighlights] = useState<Set<number>>(new Set());
  const [transcriptSource, setTranscriptSource] = useState<"youtube" | "whisper">("youtube");

  // ── UI state ──
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showProModal, setShowProModal] = useState(false);

  // ── Manual mode ──
  const [clips, setClips] = useState<ClipEntry[]>([{ id: 1, startTime: "00:00:00", duration: 30, selected: true }]);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDurationLoading, setVideoDurationLoading] = useState(false);
  const [clipLimitWarning, setClipLimitWarning] = useState("");
  const [videoLimitWarning, setVideoLimitWarning] = useState("");

  // ── Generate Modal ──
  const [showGenerateModal, setShowGenerateModal] = useState<ModalBatch | null>(null);

  // ── Mobile detection ──
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
      layout,
      autoMode: true,
    };
    sessionStorage.setItem("autoclip_batch", JSON.stringify(batch));
    setShowGenerateModal(batch);
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
      layout,
    };
    sessionStorage.setItem("autoclip_batch", JSON.stringify(batch));
    setShowGenerateModal(batch);
    setUrl(""); setAddSubtitle(false);
    setClips([{ id: 1, startTime: "00:00:00", duration: 30, selected: true }]);
  }

  async function handleLogout() {
    sessionStorage.removeItem("autoclip_user");
    router.push("/");
  }

  const videoId = getYouTubeId(url);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#080808", fontFamily: "'Inter', sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>

      {/* ── Topbar ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "60px", display: "flex", alignItems: "center",
        padding: isMobile ? "0 16px" : "0 28px", gap: "0",
        background: "rgba(8,8,8,0.9)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", cursor: "pointer", marginRight: isMobile ? "12px" : "28px", flexShrink: 0 }} onClick={() => router.push("/")}>
          <Image src="/logo.png" alt="Productive Clip" width={isMobile ? 105 : 125} height={isMobile ? 33 : 38} priority style={{ objectFit: "contain" }} />
        </div>

        {/* Divider */}
        <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)", marginRight: isMobile ? "10px" : "16px", flexShrink: 0 }} />

        {/* Nav tabs */}
        <nav style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1 }}>
          {(["auto", "manual"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`db-nav-btn${mode === m ? " active" : ""}`}>
              {m === "auto" ? (
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                  Auto
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  Manual
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Right: avatar + dropdown */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            onClick={() => setShowAvatarMenu(v => !v)}
            style={{
              width: "34px", height: "34px", borderRadius: "50%",
              background: showAvatarMenu ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: 800, color: "#fff",
              border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer",
              transition: "all 0.15s", userSelect: "none",
              boxShadow: showAvatarMenu ? "0 0 0 3px rgba(255,255,255,0.08)" : "none",
            }}
            title={username}
          >
            {username.charAt(0).toUpperCase()}
          </div>

          {/* Dropdown menu */}
          {showAvatarMenu && (
            <>
              <div onClick={() => setShowAvatarMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0,
                zIndex: 200, minWidth: "196px",
                background: "linear-gradient(160deg, #161616 0%, #111 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px", padding: "6px",
                boxShadow: "0 20px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset",
                animation: "scaleIn 0.15s cubic-bezier(0.22,1,0.36,1)",
              }}>
                {/* User info */}
                <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: "5px" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#fff" }}>{username}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>Free Plan</p>
                </div>

                {/* Go to Pro */}
                <button
                  onClick={() => { setShowAvatarMenu(false); setShowProModal(true); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "10px",
                    padding: "9px 12px", borderRadius: "10px", border: "none",
                    background: "transparent", cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(251,191,36,0.1)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#fbbf24" }}>Upgrade to Pro</span>
                </button>

                {/* Logout */}
                <button
                  onClick={() => { setShowAvatarMenu(false); handleLogout(); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "10px",
                    padding: "9px 12px", borderRadius: "10px", border: "none",
                    background: "transparent", cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>Logout</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, paddingTop: "76px", paddingBottom: "56px", paddingLeft: isMobile ? "16px" : "32px", paddingRight: isMobile ? "16px" : "32px", position: "relative" }}>
        {/* Ambient glow */}
        <div aria-hidden style={{
          position: "fixed", top: "-180px", left: "50%", transform: "translateX(-50%)",
          width: "600px", height: "600px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.025) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ maxWidth: "1140px", margin: "0 auto", position: "relative", zIndex: 1 }}>

          {/* Page header */}
          <div className="db-fade-up" style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h1 style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.6px" }}>
                  {mode === "auto" ? "Auto Highlight" : "Manual Clip"}
                </h1>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", marginTop: "4px", margin: "4px 0 0" }}>
                  Halo, <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{username}</span>
                  {mode === "auto" ? " — AI otomatis temukan momen terbaik videomu." : " — Atur klip secara manual sesuai keinginanmu."}
                </p>
              </div>
              {mode === "auto" && autoStatus === "ready" && (
                <div className="db-tag">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="#22c55e"><circle cx="12" cy="12" r="10" /></svg>
                  {highlights.length} highlight ditemukan
                </div>
              )}
            </div>
          </div>

          {/* ════════════ AUTO MODE ════════════ */}
          {mode === "auto" && (
            <div className="db-fade-up" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "16px" : "24px", alignItems: "start" }}>

              {/* Left: URL + Analyze */}
              <div className="db-card">
                <div style={{ marginBottom: "22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                    </div>
                    <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.3px" }}>Auto Highlight</h2>
                  </div>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: 0, paddingLeft: "42px" }}>
                    AI akan mencari momen terbaik di video secara otomatis.
                  </p>
                </div>

                {/* URL input */}
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "8px" }}>YouTube URL</label>
                <div style={{ position: "relative", marginBottom: "14px" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                  </span>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={e => { setUrl(e.target.value); setAutoStatus("idle"); setHighlights([]); }}
                    className="db-input"
                  />
                </div>

                {/* Analyze button */}
                <button
                  onClick={handleAutoAnalyze}
                  disabled={!isValidUrl || autoStatus === "analyzing"}
                  className="db-btn-primary"
                  style={{ marginBottom: "14px", borderRadius: "14px" }}
                >
                  {autoStatus === "analyzing" ? (
                    <>
                      <div className="db-spinner" />
                      Menganalisa... (30–60 detik)
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      Analisa &amp; Temukan Momen Terbaik
                    </>
                  )}
                </button>

                {/* Error */}
                {autoStatus === "error" && (
                  <div style={{ padding: "12px 14px", borderRadius: "12px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: "13px", marginBottom: "12px" }}>
                    {autoError}
                  </div>
                )}

                {/* Preview */}
                {videoId ? (
                  <div style={{ marginTop: "14px" }}>
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <iframe
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title="YouTube preview"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{
                    borderRadius: "14px", border: "1px dashed rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.015)",
                    aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: "12px", color: "rgba(255,255,255,0.2)",
                  }}>
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="m10 8 5 3-5 3V8z" /><path d="M8 21h8M12 17v4" />
                    </svg>
                    <span style={{ fontSize: "12px" }}>Preview akan muncul di sini</span>
                  </div>
                )}
              </div>

              {/* Right: Highlight results + generate */}
              <div className="db-card" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    </div>
                    <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.3px" }}>Momen Terpilih</h2>
                  </div>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: 0, paddingLeft: "42px" }}>
                    {autoStatus === "ready"
                      ? <>{selectedHighlights.size} dari {highlights.length} momen dipilih{transcriptSource === "whisper" && <span style={{ color: "rgba(255,255,255,0.3)" }}> · Whisper AI</span>}</>
                      : "Hasil analisa AI akan muncul di sini."
                    }
                  </p>
                </div>

                {/* Idle */}
                {autoStatus === "idle" && (
                  <div className="db-empty-state">
                    <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>Belum ada hasil</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>Paste URL dan klik "Analisa" untuk memulai</p>
                    </div>
                  </div>
                )}

                {/* Analyzing */}
                {autoStatus === "analyzing" && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "18px", padding: "48px 0" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "50%", border: "3px solid rgba(255,255,255,0.08)", borderTopColor: "#fff", animation: "spin 0.75s linear infinite" }} />
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: "15px", color: "#fff", fontWeight: 700 }}>Menganalisa video...</p>
                      <p style={{ margin: "6px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>AI membaca transcript &amp; mencari highlight</p>
                    </div>
                  </div>
                )}

                {/* Results */}
                {autoStatus === "ready" && highlights.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px", flex: 1, overflowY: "auto", maxHeight: "380px", paddingRight: "2px" }}>
                    {highlights.map((h, i) => {
                      const isSelected = selectedHighlights.has(i);
                      return (
                        <div key={i} onClick={() => toggleHighlight(i)} className={`db-highlight-card${isSelected ? " selected" : ""}`}>
                          {/* Checkbox */}
                          <div className="db-checkbox" style={{
                            border: isSelected ? "2px solid #fff" : "2px solid rgba(255,255,255,0.25)",
                            background: isSelected ? "#fff" : "transparent",
                            marginTop: "2px",
                          }}>
                            {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 4 4 6.5 8.5 1.5" /></svg>}
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                              <span className="db-tag">{h.start_label}</span>
                              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{h.duration}s</span>
                            </div>
                            <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: isSelected ? "#fff" : "rgba(255,255,255,0.65)", letterSpacing: "-0.1px" }}>{h.title}</p>
                            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{h.reason}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Subtitle toggle */}
                {autoStatus === "ready" && (
                  <div onClick={() => setAddSubtitle(v => !v)} className={`db-toggle-row${addSubtitle ? " active" : ""}`} style={{ marginBottom: "10px" }}>
                    {/* Toggle pill */}
                    <div style={{
                      width: "38px", height: "22px", borderRadius: "11px", position: "relative", flexShrink: 0,
                      background: addSubtitle ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.12)",
                      transition: "background 0.2s",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}>
                      <div style={{
                        width: "16px", height: "16px", borderRadius: "50%", position: "absolute", top: "2px",
                        left: addSubtitle ? "19px" : "2px", background: addSubtitle ? "#000" : "#fff",
                        transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                      }} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#fff" }}>
                        Subtitle Otomatis
                        <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.4)", marginLeft: "6px", fontSize: "12px" }}>· Whisper AI</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Style picker for auto mode */}
                {autoStatus === "ready" && addSubtitle && (
                  <div style={{ marginBottom: "10px", padding: "12px", borderRadius: "14px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="db-section-label" style={{ marginBottom: "10px" }}>Style Subtitle</p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {(["beasty", "youshaei", "mozi"] as const).map(s => {
                        const labels: Record<string, string> = { beasty: "Beasty", youshaei: "Youshaei", mozi: "Mozi" };
                        const isActive = subtitleStyle === s;
                        return (
                          <button key={s} onClick={() => setSubtitleStyle(s)} className={`db-style-btn${isActive ? " active" : ""}`}>
                            <div style={{ background: "#1a1a1a", borderRadius: "8px", padding: "7px 8px", width: "100%", textAlign: "center", minHeight: "34px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {s === "beasty" && <span style={{ fontSize: "11px", fontWeight: 900, fontStyle: "italic", color: "#fff", textShadow: "1px 1px 3px #000, 2px 2px 4px #000" }}>TO GET</span>}
                              {s === "youshaei" && <span style={{ fontSize: "10px", fontWeight: 700 }}><span style={{ color: "#00ff00" }}>TO </span><span style={{ color: "rgba(255,255,255,0.5)" }}>GET STARTED</span></span>}
                              {s === "mozi" && <span style={{ fontSize: "10px", fontWeight: 900 }}><span style={{ color: "#fff" }}>TO </span><span style={{ color: "#00ff00" }}>GET </span><span style={{ color: "#fff" }}>STARTED</span></span>}
                            </div>
                            <span style={{ fontSize: "10px", color: isActive ? "#fff" : "rgba(255,255,255,0.45)", fontWeight: 700 }}>{labels[s]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Generate button */}
                <button
                  onClick={handleAutoGenerate}
                  disabled={autoStatus !== "ready" || selectedHighlights.size === 0}
                  className="db-btn-primary"
                  style={{ borderRadius: "14px", padding: "14px" }}
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
            <div className="db-fade-up" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "16px" : "24px", alignItems: "start" }}>

              {/* Left: URL + Preview */}
              <div className="db-card">
                <div style={{ marginBottom: "22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="m10 8 5 3-5 3V8z" /></svg>
                    </div>
                    <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.3px" }}>Video Sumber</h2>
                  </div>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: 0, paddingLeft: "42px" }}>Paste URL YouTube untuk memulai.</p>
                </div>

                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: "8px" }}>YouTube URL</label>
                <div style={{ position: "relative", marginBottom: "20px" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                  </span>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    className="db-input"
                  />
                </div>

                {/* Preview */}
                {videoId ? (
                  <div>
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <iframe
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Preview Video</span>
                      <span className="db-tag">
                        {videoDurationLoading ? "Mengambil durasi..." : videoDuration !== null ? `Total: ${secondsToTime(videoDuration)}` : "Durasi N/A"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    borderRadius: "14px", border: "1px dashed rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.015)",
                    aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: "12px", color: "rgba(255,255,255,0.2)",
                  }}>
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="m10 8 5 3-5 3V8z" /><path d="M8 21h8M12 17v4" />
                    </svg>
                    <span style={{ fontSize: "12px" }}>Preview akan muncul di sini</span>
                  </div>
                )}
              </div>

              {/* Right: Clips form */}
              <div className="db-card" style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </div>
                    <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.3px" }}>Pengaturan Klip</h2>
                  </div>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: 0, paddingLeft: "42px" }}>Tambah hingga {MAX_CLIPS} klip dengan waktu berbeda.</p>
                </div>

                {/* Clip list header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <p className="db-section-label" style={{ margin: 0 }}>Daftar Klip ({clips.length}/{MAX_CLIPS})</p>
                  {canAddMoreClips(clips) && (
                    <button onClick={addClip} className="db-btn-ghost" style={{ padding: "6px 14px", fontSize: "12px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Tambah Klip
                    </button>
                  )}
                </div>

                {/* Clips */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                  {clips.map((clip, idx) => {
                    const isDurationInvalid = clip.selected && (clip.duration < 10 || clip.duration > 90);
                    return (
                      <div key={clip.id} className={`db-clip-row${clip.selected ? " selected" : ""}${isDurationInvalid ? " invalid" : ""}`} style={{ opacity: clip.selected ? 1 : 0.6 }}>
                        <div style={{ display: "grid", gridTemplateColumns: clips.length > 1 ? "auto auto 1fr 1fr auto" : "auto auto 1fr 1fr", gap: "10px", alignItems: "center" }}>
                          {/* Checkbox */}
                          <div
                            className="db-checkbox"
                            style={{
                              border: clip.selected ? "2px solid #fff" : "2px solid rgba(255,255,255,0.2)",
                              background: clip.selected ? "#fff" : "transparent",
                              cursor: "pointer",
                            }}
                            onClick={() => updateClip(clip.id, "selected", !clip.selected)}
                          >
                            {clip.selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 4 4 6.5 8.5 1.5" /></svg>}
                          </div>

                          {/* Number badge */}
                          <div style={{
                            width: "28px", height: "28px", borderRadius: "8px",
                            background: clip.selected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "12px", fontWeight: 800, color: clip.selected ? "#fff" : "rgba(255,255,255,0.35)", flexShrink: 0,
                          }}>{idx + 1}</div>

                          {/* Start time */}
                          <div>
                            <label style={{ display: "block", fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700 }}>Start</label>
                            <input
                              type="text"
                              placeholder="00:00:00"
                              value={clip.startTime}
                              disabled={!clip.selected}
                              onChange={e => updateClip(clip.id, "startTime", e.target.value.replace(/[^0-9:]/g, ""))}
                              onBlur={() => formatTimeOnBlur(clip.id, clip.startTime)}
                              className="db-input-small"
                              style={{
                                border: `1px solid ${isValidTime(clip.startTime) ? "rgba(255,255,255,0.1)" : "rgba(239,68,68,0.5)"}`,
                                color: clip.selected ? "#fff" : "rgba(255,255,255,0.35)",
                                cursor: !clip.selected ? "not-allowed" : "text",
                                fontFamily: "monospace",
                              }}
                            />
                          </div>

                          {/* Duration */}
                          <div>
                            <label style={{ display: "block", fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700 }}>Durasi (dtk)</label>
                            <input
                              type="number"
                              min={10}
                              max={90}
                              value={clip.duration}
                              disabled={!clip.selected}
                              onChange={e => updateClip(clip.id, "duration", Number(e.target.value))}
                              onBlur={e => { const v = Math.max(10, Math.min(90, Number(e.target.value) || 10)); updateClip(clip.id, "duration", v); }}
                              className="db-input-small"
                              style={{
                                border: `1px solid ${isDurationInvalid ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                                color: clip.selected ? "#fff" : "rgba(255,255,255,0.35)",
                                cursor: !clip.selected ? "not-allowed" : "default",
                              }}
                            />
                          </div>

                          {/* Remove btn */}
                          {clips.length > 1 && (
                            <button
                              onClick={() => removeClip(clip.id)}
                              style={{
                                width: "28px", height: "28px", borderRadius: "8px",
                                background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", color: "#f87171", alignSelf: "end", marginBottom: "2px", transition: "all 0.2s",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.14)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.07)"; }}
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
                <div onClick={() => setAddSubtitle(v => !v)} className={`db-toggle-row${addSubtitle ? " active" : ""}`} style={{ marginBottom: addSubtitle ? "10px" : "14px" }}>
                  <div style={{
                    width: "38px", height: "22px", borderRadius: "11px", position: "relative", flexShrink: 0,
                    background: addSubtitle ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.12)",
                    transition: "background 0.2s", border: "1px solid rgba(255,255,255,0.2)",
                  }}>
                    <div style={{
                      width: "16px", height: "16px", borderRadius: "50%", position: "absolute", top: "2px",
                      left: addSubtitle ? "19px" : "2px", background: addSubtitle ? "#000" : "#fff",
                      transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                    }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#fff" }}>Subtitle Otomatis</p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
                      Transkripsi audio dengan AI (Whisper) · proses lebih lama
                    </p>
                  </div>
                </div>

                {/* Style picker */}
                {addSubtitle && (
                  <div style={{ marginBottom: "14px", padding: "12px", borderRadius: "14px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="db-section-label" style={{ marginBottom: "10px" }}>Style Subtitle</p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {(["beasty", "youshaei", "mozi"] as const).map(s => {
                        const labels: Record<string, string> = { beasty: "Beasty", youshaei: "Youshaei", mozi: "Mozi" };
                        const isActive = subtitleStyle === s;
                        return (
                          <button key={s} onClick={() => setSubtitleStyle(s)} className={`db-style-btn${isActive ? " active" : ""}`}>
                            <div style={{ background: "#1a1a1a", borderRadius: "8px", padding: "7px 8px", width: "100%", textAlign: "center", minHeight: "34px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {s === "beasty" && <span style={{ fontSize: "11px", fontWeight: 900, fontStyle: "italic", color: "#fff", textShadow: "1px 1px 3px #000, 2px 2px 4px #000" }}>TO GET</span>}
                              {s === "youshaei" && <span style={{ fontSize: "10px", fontWeight: 700, color: "#fff" }}><span style={{ color: "#00ff00" }}>TO </span><span style={{ color: "rgba(255,255,255,0.5)" }}>GET STARTED</span></span>}
                              {s === "mozi" && <span style={{ fontSize: "10px", fontWeight: 900 }}><span style={{ color: "#fff" }}>TO </span><span style={{ color: "#00ff00" }}>GET </span><span style={{ color: "#fff" }}>STARTED</span></span>}
                            </div>
                            <span style={{ fontSize: "10px", color: isActive ? "#fff" : "rgba(255,255,255,0.45)", fontWeight: 700 }}>{labels[s]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {(clipLimitWarning || videoLimitWarning || hasClipBeyondVideo) && (
                  <div style={{ marginBottom: "14px", padding: "12px 14px", borderRadius: "12px", background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.22)", color: "#fbbf24", fontSize: "12px", lineHeight: 1.6 }}>
                    {clipLimitWarning && <p style={{ margin: 0 }}>{clipLimitWarning}</p>}
                    {videoLimitWarning && <p style={{ margin: clipLimitWarning ? "4px 0 0" : 0 }}>{videoLimitWarning}</p>}
                    {hasClipBeyondVideo && videoDuration !== null && (
                      <p style={{ margin: "4px 0 0" }}>Ada klip yang melebihi durasi video ({secondsToTime(videoDuration)}).</p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleManualGenerate}
                  disabled={!manualValid}
                  className="db-btn-primary"
                  style={{ borderRadius: "14px", padding: "14px", marginTop: "auto" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  Generate {selectedClips.length} Klip
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Pro Pricing Modal ── */}
      {showProModal && (
        <>
          <div
            onClick={() => setShowProModal(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 999,
              background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            }}
          />

          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            zIndex: 1000, width: "min(880px, 96vw)", maxHeight: "92vh", overflowY: "auto",
            background: "linear-gradient(160deg, #111 0%, #0d0d0d 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "24px", padding: isMobile ? "26px 18px" : "44px 40px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.9)",
            animation: "scaleIn 0.2s cubic-bezier(0.22,1,0.36,1)",
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowProModal(false)}
              style={{
                position: "absolute", top: "18px", right: "18px",
                width: "34px", height: "34px", borderRadius: "50%",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "16px",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >×</button>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: "40px" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "5px 16px", borderRadius: "20px",
                background: "#f59e0b", marginBottom: "18px",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#000", letterSpacing: "1px", textTransform: "uppercase" }}>Premium Access</span>
              </div>
              <h2 style={{ fontSize: isMobile ? "28px" : "38px", fontWeight: 900, color: "#fff", margin: "0 0 10px", letterSpacing: "-1px" }}>Upgrade to Pro</h2>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
                Buka potensi penuh clipper Anda dengan fitur AI tercanggih di industri.
              </p>
            </div>

            {/* Pricing cards */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "16px" }}>

              {/* Free */}
              <div style={{
                borderRadius: "18px", padding: "26px",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", flexDirection: "column",
              }}>
                <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.2px" }}>Free</p>
                <div style={{ marginBottom: "14px" }}>
                  <span style={{ fontSize: "34px", fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>Rp0</span>
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginLeft: "5px" }}>/bulan</span>
                </div>
                <p style={{ margin: "0 0 22px", fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                  Untuk pemula yang baru memulai perjalanan clipping.
                </p>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                  {[
                    { text: "AI Clipping Dasar", included: true },
                    { text: "Export 720p", included: true },
                    { text: "Cloud Storage (2GB)", included: false },
                  ].map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {f.included
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      }
                      <span style={{ fontSize: "13px", color: f.included ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)", textDecoration: f.included ? "none" : "line-through" }}>{f.text}</span>
                    </div>
                  ))}
                </div>
                <button
                  style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                >Pilih Paket</button>
              </div>

              {/* Clipper Pro (highlighted) */}
              <div style={{
                borderRadius: "18px", padding: "26px",
                background: "linear-gradient(160deg, rgba(251,191,36,0.08) 0%, rgba(251,191,36,0.03) 100%)",
                border: "2px solid #f59e0b",
                display: "flex", flexDirection: "column", position: "relative",
                boxShadow: "0 0 40px rgba(245,158,11,0.12)",
              }}>
                <div style={{
                  position: "absolute", top: "-13px", left: "50%", transform: "translateX(-50%)",
                  padding: "4px 16px", borderRadius: "20px", background: "#f59e0b",
                  fontSize: "10px", fontWeight: 900, color: "#000", letterSpacing: "0.8px",
                  textTransform: "uppercase", whiteSpace: "nowrap",
                }}>Best for Productive Clip</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#fff", letterSpacing: "-0.2px" }}>Clipper Pro</p>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                </div>
                <div style={{ marginBottom: "14px" }}>
                  <span style={{ fontSize: "34px", fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>Rp149k</span>
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginLeft: "5px" }}>/3 bulan</span>
                </div>
                <p style={{ margin: "0 0 22px", fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                  Maksimalkan konten Anda dengan fitur pro tak terbatas.
                </p>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                  {["AI Auto-Clipping Pro", "Export 4K Ultra HD", "Cloud Storage (100GB)", "Priority Rendering", "Multi-platform distribution"].map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "none", background: "#f59e0b", color: "#000", fontSize: "13px", fontWeight: 900, cursor: "pointer", transition: "background 0.2s", fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fbbf24")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#f59e0b")}
                >Pilih Paket</button>
              </div>

              {/* Agency */}
              <div style={{
                borderRadius: "18px", padding: "26px",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", flexDirection: "column",
              }}>
                <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.2px" }}>Agency</p>
                <div style={{ marginBottom: "14px" }}>
                  <span style={{ fontSize: "34px", fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>Rp499k</span>
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginLeft: "5px" }}>/3 bulan</span>
                </div>
                <p style={{ margin: "0 0 22px", fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                  Solusi skala besar untuk tim dan agensi konten.
                </p>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                  {["Semua Fitur Pro", "Team Collaboration (10 Device)", "Unlimited Cloud Storage", "Dedicated Account Manager"].map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: "13px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                >Pilih Paket</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Generate Modal Popup ── */}
      {showGenerateModal && (
        <GenerateModal batch={showGenerateModal} onClose={() => setShowGenerateModal(null)} isMobile={isMobile} />
      )}
    </div>
  );
}