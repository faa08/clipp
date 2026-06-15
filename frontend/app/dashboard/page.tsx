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
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        cursor: status !== "loading" ? "pointer" : "default",
      }} />

      {/* Modal content */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        zIndex: 1000, width: "min(620px, 94vw)", maxHeight: "88vh", overflowY: "auto",
        background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "20px", padding: isMobile ? "20px 16px" : "28px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
      }}>
        {/* Inject keyframes locally to bypass Tailwind v4 CSS processing */}
        <style>{`
          @keyframes water-wave { 0%,100% { transform: translateX(0) scaleY(1); } 50% { transform: translateX(-14px) scaleY(1.4); } }
          @keyframes water-wave-alt { 0%,100% { transform: translateX(0) scaleY(1.2); } 50% { transform: translateX(10px) scaleY(0.7); } }
          @keyframes water-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        `}</style>

        {/* Close button */}
        {status !== "loading" && (
          <button onClick={onClose} style={{
            position: "absolute", top: "14px", right: "14px",
            width: "30px", height: "30px", borderRadius: "50%",
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "15px",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          >×</button>
        )}

        {/* ── LOADING ── */}
        {status === "loading" && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
              <div>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "2px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontFamily: "monospace" }}>Processing Pipeline</p>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>
                  {totalClips > 1 ? `Processing clip ${currentClipIndex} of ${totalClips}` : "AI Core Engine is actively crafting your clip"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", borderRadius: "20px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fbbf24", boxShadow: "0 0 6px #fbbf24", animation: "pulse-dot 2s ease-in-out infinite" }} />
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", color: "#fbbf24", fontFamily: "monospace" }}>LIVE ENGINE</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "24px", marginBottom: "28px", alignItems: isMobile ? "center" : "center", flexDirection: isMobile ? "column" : "row" }}>
              <div style={{
                position: "relative", width: "152px", height: "152px", borderRadius: "22px",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                overflow: "hidden", flexShrink: 0,
              }}>
                {/* Water fill */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  height: `${progressPct}%`,
                  background: "linear-gradient(to top, rgba(59,130,246,0.55), rgba(96,165,250,0.2))",
                  transition: "height 1.2s cubic-bezier(0.4,0,0.2,1)",
                  animation: "water-bob 2s ease-in-out infinite",
                }}>
                  {/* Wave 1 - main surface ripple */}
                  <div style={{
                    position: "absolute", top: "-8px", left: "-30px", right: "-30px",
                    height: "20px", borderRadius: "45%",
                    background: "rgba(59,130,246,0.6)",
                    animation: "water-wave 2.2s ease-in-out infinite",
                  }} />
                  {/* Wave 2 - secondary ripple */}
                  <div style={{
                    position: "absolute", top: "-5px", left: "-20px", right: "-20px",
                    height: "16px", borderRadius: "48%",
                    background: "rgba(96,165,250,0.4)",
                    animation: "water-wave-alt 2.8s ease-in-out infinite",
                  }} />
                </div>
                {/* Percentage text */}
                <div style={{
                  position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", zIndex: 10,
                  fontFamily: "monospace", fontSize: "34px", fontWeight: 900, letterSpacing: "-1px",
                  color: progressPct > 50 ? "#fff" : "rgba(255,255,255,0.9)",
                  transition: "color 0.4s ease",
                }}>
                  <span>{progressPct}%</span>
                  <div style={{
                    width: "72px", height: "3px", marginTop: "5px",
                    background: "rgba(255,255,255,0.12)", borderRadius: "2px", overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: "2px",
                      width: `${progressPct}%`,
                      background: progressPct > 50 ? "rgba(255,255,255,0.7)" : "#fff",
                      transition: "width 1s ease",
                    }} />
                  </div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 10px", fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", fontFamily: "monospace" }}>Current Sub-Task</p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <div className="animate-spin" style={{ width: "14px", height: "14px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#fff", flexShrink: 0 }} />
                  <span style={{ fontSize: "14px", color: "#fff", fontWeight: 500 }}>{loadingText}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px" }}>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: "9px", fontWeight: 700, letterSpacing: "1px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontFamily: "monospace" }}>Hardware Cluster</p>
                    <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>LOCAL-CPU-NODE</p>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: "9px", fontWeight: 700, letterSpacing: "1px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontFamily: "monospace" }}>Estimated Time</p>
                    <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>STREAM DEPENDENT</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p style={{ margin: "0 0 12px", fontSize: "10px", fontWeight: 700, letterSpacing: "2px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", fontFamily: "monospace" }}>Pipeline Milestones</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                {steps.map((step) => {
                  const isActive = currentStep === step.id;
                  const isPassed = currentStep > step.id;
                  const subTexts: Record<string, string> = { "Unduh": "Fetch source by the Video source.", "Ekstrak": "Extract clip from source video.", "Subtitle": "Transcribe and burn subtitles.", "Selesai": "Finalize and export clip." };
                  return (
                    <div key={step.id} style={{ flex: 1, padding: "10px 10px", borderRadius: "10px", background: isActive ? "rgba(255,255,255,0.08)" : isPassed ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)", border: isActive ? "1px solid rgba(255,255,255,0.25)" : isPassed ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.05)", transition: "all 0.4s" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{String(step.id).padStart(2, "0")}</p>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 800, color: isActive ? "#fff" : isPassed ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)", letterSpacing: "0.5px", textTransform: "uppercase" }}>{isPassed ? "✓ " : ""}{step.label}</p>
                      <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>{subTexts[step.label] ?? "Processing..."}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cancel button */}
            <button onClick={handleCancel} style={{
              width: "100%", padding: "11px", borderRadius: "50px", marginTop: "20px",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; e.currentTarget.style.color = "#f87171"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Cancel
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {status === "success" && results.length > 0 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#22c55e", fontSize: "24px", marginBottom: "12px" }}>✓</div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0 }}>{results.length > 1 ? `${results.length} Klip Berhasil Dibuat!` : "Klip Berhasil Dibuat!"}</h2>
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
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" }}>
                      {results.length > 1 && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Klip {idx + 1}</span>
                          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{clipJobs[idx]?.startTime ?? "00:00:00"} · {clipJobs[idx]?.duration ?? 0}s</span>
                        </div>
                      )}
                      <div style={{ borderRadius: "8px", overflow: "hidden", background: "#000", marginBottom: "10px" }}>
                        <video controls preload="metadata" playsInline src={clipResult.clip_url} style={{ width: "100%", maxHeight: "220px", objectFit: "contain", display: "block" }} />
                      </div>
                      <button onClick={() => downloadClip(clipResult)} disabled={downloadingId === clipResult.filename} style={{
                        width: "100%", padding: "9px", borderRadius: "50px", border: "none", background: "#fff", color: "#000", fontSize: "13px", fontWeight: 600,
                        cursor: downloadingId === clipResult.filename ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        transition: "background 0.2s", opacity: downloadingId === clipResult.filename ? 0.5 : 1,
                      }}
                        onMouseEnter={e => { if (downloadingId !== clipResult.filename) e.currentTarget.style.background = "#e5e5e5"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        {downloadingId === clipResult.filename ? "Mengunduh..." : "Download"}
                      </button>
                    </div>

                    {hasCap && (
                      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>Caption {results.length > 1 ? `Klip ${idx + 1}` : ""}</span>
                          {capStatus === "loading" && <div className="animate-spin" style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#fff", flexShrink: 0 }} />}
                        </div>
                        {capStatus === "loading" && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "0 0 12px" }}>Groq AI sedang menulis...</p>}
                        {capStatus === "error" && <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>Gagal generate caption.</p>}
                        {capStatus === "done" && (
                          <>
                            <div style={{ display: "flex", gap: "4px", marginBottom: "10px", flexWrap: "wrap" }}>
                              {(["instagram", "tiktok", "youtube"] as ModalPlatform[]).map(p => {
                                const labels: Record<ModalPlatform, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YT Shorts" };
                                return (
                                  <button key={p} onClick={() => setClipPlatform(idx, p)} style={{
                                    padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                                    background: platform === p ? "rgba(255,255,255,0.15)" : "transparent",
                                    border: platform === p ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.1)",
                                    color: platform === p ? "#fff" : "rgba(255,255,255,0.5)", transition: "all 0.15s",
                                  }}>{labels[p]}</button>
                                );
                              })}
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "12px", marginBottom: "10px" }}>
                              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.8)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "160px", overflowY: "auto" }}>{capData[platform]}</p>
                            </div>
                            <button onClick={() => copyCaption(idx, platform)} style={{
                              width: "100%", padding: "8px", borderRadius: "8px",
                              border: isCopied ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.15)",
                              background: isCopied ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.06)",
                              color: isCopied ? "#22c55e" : "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.2s",
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

            <button onClick={onClose} style={{
              width: "100%", padding: "13px", borderRadius: "50px",
              background: "#fff", color: "#000", border: "none", fontSize: "15px", fontWeight: 700,
              cursor: "pointer", transition: "background 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "#e5e5e5")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            >Generate Video Baru</button>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === "error" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontSize: "24px", marginBottom: "12px" }}>!</div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fca5a5", marginBottom: "12px" }}>Gagal Membuat Klip</h2>
            <div style={{ color: "#fca5a5", fontSize: "13px", textAlign: "left", marginBottom: "24px", wordBreak: "break-word" }}>
              <span style={{ fontWeight: 600 }}>Detail Error: </span>{errorMsg}
            </div>
            <button onClick={onClose} style={{
              width: "100%", padding: "13px", borderRadius: "50px",
              background: "#fff", color: "#000", border: "none", fontSize: "15px", fontWeight: 700,
              cursor: "pointer", transition: "background 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "#e5e5e5")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            >Generate Video Baru</button>
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#000" }}>
      {/* ── Topbar ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "64px", display: "flex", alignItems: "center",
        padding: isMobile ? "0 16px" : "0 24px", gap: "0",
        background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", cursor: "pointer", marginRight: isMobile ? "16px" : "32px", flexShrink: 0 }} onClick={() => router.push("/")}>
          <Image src="/logo.png" alt="Productive Clip" width={isMobile ? 110 : 130} height={isMobile ? 34 : 40} priority style={{ objectFit: "contain" }} />
        </div>

        {/* Nav links */}
        <nav style={{ display: "flex", alignItems: "center", gap: "2px", flex: 1 }}>
          {(["auto", "manual"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "6px 14px", borderRadius: "6px", fontSize: "14px", fontWeight: mode === m ? 600 : 400,
              cursor: "pointer", transition: "all 0.15s", border: "none",
              background: "transparent",
              color: mode === m ? "#fff" : "rgba(255,255,255,0.55)",
              position: "relative",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => { if (mode !== m) e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
            >
              {m === "auto" ? "Auto" : "Manual"}
              {/* Active underline */}
              {mode === m && (
                <span style={{
                  position: "absolute", bottom: "-1px", left: "14px", right: "14px",
                  height: "2px", background: "#fff", borderRadius: "1px",
                }} />
              )}
            </button>
          ))}
        </nav>

        {/* Right: avatar + dropdown */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {/* Avatar */}
          <div
            onClick={() => setShowAvatarMenu(v => !v)}
            style={{
              width: "32px", height: "32px", borderRadius: "50%",
              background: showAvatarMenu ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: 700, color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
              transition: "background 0.15s", userSelect: "none",
            }}
            title={username}
          >
            {username.charAt(0).toUpperCase()}
          </div>

          {/* Dropdown menu */}
          {showAvatarMenu && (
            <>
              {/* Backdrop */}
              <div
                onClick={() => setShowAvatarMenu(false)}
                style={{ position: "fixed", inset: 0, zIndex: 199 }}
              />
              {/* Menu box */}
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0,
                zIndex: 200, minWidth: "180px",
                background: "#111", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "12px", padding: "6px",
                boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
              }}>
                {/* User info */}
                <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "4px" }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#fff" }}>{username}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Free Plan</p>
                </div>

                {/* Go to Pro */}
                <button
                  onClick={() => { setShowAvatarMenu(false); setShowProModal(true); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "10px",
                    padding: "9px 12px", borderRadius: "8px", border: "none",
                    background: "transparent", cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(251,191,36,0.12)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#fbbf24" }}>Upgrade to Pro</span>
                </button>

                {/* Logout */}
                <button
                  onClick={() => { setShowAvatarMenu(false); handleLogout(); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "10px",
                    padding: "9px 12px", borderRadius: "8px", border: "none",
                    background: "transparent", cursor: "pointer", textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>Logout</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, paddingTop: "72px", paddingBottom: "48px", paddingLeft: isMobile ? "16px" : "32px", paddingRight: isMobile ? "16px" : "32px", position: "relative" }}>
        <div aria-hidden style={{
          position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)",
          width: "700px", height: "700px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div className="animate-fade-up" style={{ marginBottom: "28px", textAlign: "center" }}>
            <h1 style={{ fontSize: isMobile ? "24px" : "32px", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.4px" }}>Dashboard</h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", marginTop: "5px" }}>
              Halo, <span style={{ color: "#fff", fontWeight: 600 }}>{username}</span>! Selamat datang di ProductiveClip.
            </p>
          </div>

          {/* ════════════ AUTO MODE ════════════ */}
          {mode === "auto" && (
            <div className="animate-fade-up" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "16px" : "24px", alignItems: "start" }}>

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
            <div className="animate-fade-up" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "16px" : "24px", alignItems: "start" }}>

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
                        <div style={{ display: "grid", gridTemplateColumns: clips.length > 1 ? "auto auto 1fr 1fr auto" : "auto auto 1fr 1fr", gap: "10px", alignItems: "center", overflowX: isMobile ? "auto" : "visible" }}>
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
                      <p style={{ margin: "4px 0 0" }}>Ada klip yang melebihi durasi video lalalal ({secondsToTime(videoDuration)}).</p>
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

    {/* ── Pro Pricing Modal ── */}
    {showProModal && (
      <>
        {/* Backdrop */}
        <div
          onClick={() => setShowProModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 999,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          }}
        />

        {/* Modal */}
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 1000, width: "min(860px, 95vw)", maxHeight: "90vh", overflowY: "auto",
          background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px", padding: isMobile ? "24px 16px" : "40px 36px",
        }}>
          {/* Close button */}
          <button
            onClick={() => setShowProModal(false)}
            style={{
              position: "absolute", top: "16px", right: "16px",
              width: "32px", height: "32px", borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          >
            ×
          </button>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "5px 14px", borderRadius: "20px",
              background: "#f59e0b", marginBottom: "16px",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#000", letterSpacing: "0.8px", textTransform: "uppercase" }}>Premium Access</span>
            </div>
            <h2 style={{ fontSize: "36px", fontWeight: 800, color: "#fff", margin: "0 0 10px", letterSpacing: "-0.5px" }}>Upgrade to Pro</h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
              Buka potensi penuh clipper Anda dengan fitur AI tercanggih di industri.
            </p>
          </div>

          {/* Pricing cards */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "16px" }}>

            {/* Free */}
            <div style={{
              borderRadius: "16px", padding: "24px",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", flexDirection: "column",
            }}>
              <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#fff" }}>Free</p>
              <div style={{ marginBottom: "12px" }}>
                <span style={{ fontSize: "32px", fontWeight: 800, color: "#fff" }}>Rp0</span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>/bulan</span>
              </div>
              <p style={{ margin: "0 0 20px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                Untuk pemula yang baru memulai perjalanan clipping.
              </p>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {[
                  { text: "AI Clipping Dasar", included: true },
                  { text: "Export 720p", included: true },
                  { text: "Cloud Storage (2GB)", included: false },
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {f.included
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    }
                    <span style={{ fontSize: "13px", color: f.included ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)", textDecoration: f.included ? "none" : "line-through" }}>{f.text}</span>
                  </div>
                ))}
              </div>
              <button style={{
                width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              >
                Pilih Paket
              </button>
            </div>

            {/* Clipper Pro (highlighted) */}
            <div style={{
              borderRadius: "16px", padding: "24px",
              background: "rgba(251,191,36,0.06)", border: "2px solid #f59e0b",
              display: "flex", flexDirection: "column", position: "relative",
            }}>
              {/* Best badge */}
              <div style={{
                position: "absolute", top: "-13px", left: "50%", transform: "translateX(-50%)",
                padding: "4px 14px", borderRadius: "20px", background: "#f59e0b",
                fontSize: "10px", fontWeight: 800, color: "#000", letterSpacing: "0.5px",
                textTransform: "uppercase", whiteSpace: "nowrap",
              }}>
                Best for Productive Clip
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#fff" }}>Clipper Pro</p>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <span style={{ fontSize: "32px", fontWeight: 800, color: "#fff" }}>Rp149k</span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>/3 bulan</span>
              </div>
              <p style={{ margin: "0 0 20px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                Maksimalkan konten Anda dengan fitur pro tak terbatas.
              </p>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {[
                  "AI Auto-Clipping Pro",
                  "Export 4K Ultra HD",
                  "Cloud Storage (100GB)",
                  "Priority Rendering",
                  "Multi-platform distribution",
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <button style={{
                width: "100%", padding: "11px", borderRadius: "10px", border: "none",
                background: "#f59e0b", color: "#000", fontSize: "13px", fontWeight: 800,
                cursor: "pointer", transition: "background 0.2s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fbbf24")}
                onMouseLeave={e => (e.currentTarget.style.background = "#f59e0b")}
              >
                Pilih Paket
              </button>
            </div>

            {/* Agency */}
            <div style={{
              borderRadius: "16px", padding: "24px",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", flexDirection: "column",
            }}>
              <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#fff" }}>Agency</p>
              <div style={{ marginBottom: "12px" }}>
                <span style={{ fontSize: "32px", fontWeight: 800, color: "#fff" }}>Rp499k</span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>/3 bulan</span>
              </div>
              <p style={{ margin: "0 0 20px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                Solusi skala besar untuk tim dan agensi konten.
              </p>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {[
                  "Semua Fitur Pro",
                  "Team Collaboration (10 Device)",
                  "Unlimited Cloud Storage",
                  "Dedicated Account Manager",
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <button style={{
                width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              >
                Pilih Paket
              </button>
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