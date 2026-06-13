"use client";

import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

type Status = "idle" | "loading" | "success" | "error";

interface ClipResult {
  clip_url: string;
  filename: string;
  message: string;
  transcript?: string;
}

interface ClipJob {
  start: number;
  startTime: string;
  duration: number;
}

function timeToSeconds(t: string): number {
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(t) || 0;
}

function secondsToTime(total: number): string {
  if (!Number.isFinite(total)) return "00:00:00";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function normalizeClip(raw: Record<string, unknown>): ClipJob {
  const startTime = typeof raw.startTime === "string" ? raw.startTime : "";
  const start =
    typeof raw.start === "number" ? raw.start
      : typeof raw.start_time === "number" ? raw.start_time
        : startTime ? timeToSeconds(startTime)
          : 0;
  const duration = typeof raw.duration === "number" ? raw.duration : 30;
  return { start, startTime: startTime || secondsToTime(start), duration };
}

interface BatchJob {
  url: string;
  clips: ClipJob[];
  addSubtitle?: boolean;
  autoMode?: boolean;
  subtitleStyle?: string;
}

type Platform = "instagram" | "tiktok" | "youtube";

function GenerateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const url = searchParams.get("url") || "";
  const start = searchParams.get("start") || "0";
  const duration = searchParams.get("duration") || "30";

  const [status, setStatus] = useState<Status>("loading");
  const [currentStep, setCurrentStep] = useState(1);
  const [results, setResults] = useState<ClipResult[]>([]);
  const [clipJobs, setClipJobs] = useState<ClipJob[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [totalClips, setTotalClips] = useState(1);
  const [loadingText, setLoadingText] = useState("Menghubungkan ke API...");
  const [withSubtitle, setWithSubtitle] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);

  // Per-clip caption state
  const [clipCaptions, setClipCaptions] = useState<Array<Record<Platform, string>>>([]);
  const [clipCaptionStatus, setClipCaptionStatus] = useState<Array<"idle" | "loading" | "done" | "error">>([]);
  const [activePlatforms, setActivePlatforms] = useState<Platform[]>([]);
  const [copiedKeys, setCopiedKeys] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let active = true;

    function parseBatch(): BatchJob | null {
      const raw = sessionStorage.getItem("autoclip_batch");
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as BatchJob;
        if (!parsed.url || !Array.isArray(parsed.clips) || parsed.clips.length === 0) return null;
        return parsed;
      } catch { return null; }
    }

    async function generateOne(videoUrl: string, clip: ClipJob, addSubtitle: boolean, subtitleStyle: string): Promise<ClipResult> {
      if (!active) throw new Error("Dibatalkan");
      setCurrentStep(1);
      setLoadingText("Mengunduh bagian video dari YouTube (yt-dlp)...");
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (!active) throw new Error("Dibatalkan");
      setCurrentStep(2);
      setLoadingText("Mengekstrak klip video (MoviePy)...");

      const res = await fetch("http://localhost:8000/generate-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl, start_time: clip.start, duration: clip.duration, add_subtitle: addSubtitle, subtitle_style: subtitleStyle }),
      });

      if (addSubtitle && active) {
        setCurrentStep(3);
        setLoadingText("Transkripsi audio dengan Whisper AI...");
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Gagal memproses video" }));
        throw new Error(err.detail ?? "Gagal memproses video");
      }
      return res.json();
    }

    async function runGeneration() {
      const batch = parseBatch();
      const jobs: { videoUrl: string; clip: ClipJob }[] = batch
        ? batch.clips.map((clip) => ({ videoUrl: batch.url, clip: normalizeClip(clip as unknown as Record<string, unknown>) }))
        : url ? [{ videoUrl: url, clip: normalizeClip({ start: parseInt(start, 10) || 0, duration: parseInt(duration, 10) || 30 }) }]
        : [];

      if (jobs.length === 0) { setErrorMsg("Data klip tidak ditemukan"); setStatus("error"); return; }

      setClipJobs(jobs.map((job) => job.clip));
      setTotalClips(jobs.length);
      const addSubtitle = batch?.addSubtitle ?? false;
      setWithSubtitle(addSubtitle);
      setIsAutoMode(batch?.autoMode ?? false);
      const subtitleStyle = batch?.subtitleStyle ?? "mozi";
      const completed: ClipResult[] = [];
      const errors: string[] = [];

      try {
        for (let i = 0; i < jobs.length; i++) {
          if (!active) return;
          setCurrentClipIndex(i + 1);
          setCurrentStep(1);
          setLoadingText(jobs.length > 1 ? `Memproses klip ${i + 1} dari ${jobs.length}...` : "Mengunduh bagian video dari YouTube (yt-dlp)...");
          try {
            const data = await generateOne(jobs[i].videoUrl, jobs[i].clip, addSubtitle, subtitleStyle);
            if (!active) return;
            setCurrentStep(addSubtitle ? 4 : 3);
            setLoadingText(jobs.length > 1 ? `Klip ${i + 1} selesai!` : "Klip selesai dibuat!");
            completed.push(data);
            setResults([...completed]);
          } catch (e: unknown) {
            errors.push(`Klip ${i + 1}: ${e instanceof Error ? e.message : "Terjadi kesalahan"}`);
          }
        }

        if (!active) return;
        sessionStorage.removeItem("autoclip_batch");
        if (completed.length === 0) { setErrorMsg(errors.join("\n")); setStatus("error"); return; }
        if (errors.length > 0) setErrorMsg(`${completed.length} klip berhasil, ${errors.length} gagal:\n${errors.join("\n")}`);
        setStatus("success");

        // Generate caption per clip that has a transcript
        const initialStatuses = completed.map(r =>
          r.transcript ? "loading" as const : "idle" as const
        );
        const initialCaptions = completed.map(() => ({ instagram: "", tiktok: "", youtube: "" }));
        const initialPlatforms: Platform[] = completed.map(() => "instagram");
        setClipCaptions(initialCaptions);
        setClipCaptionStatus(initialStatuses);
        setActivePlatforms(initialPlatforms);

        // Fire caption requests in parallel for each clip with a transcript
        completed.forEach(async (clipResult, idx) => {
          if (!clipResult.transcript || !active) return;
          try {
            const capRes = await fetch("http://localhost:8000/generate-caption", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transcript: clipResult.transcript }),
            });
            if (!active) return;
            if (capRes.ok) {
              const capData = await capRes.json();
              setClipCaptions(prev => {
                const next = [...prev];
                next[idx] = { instagram: capData.instagram, tiktok: capData.tiktok, youtube: capData.youtube };
                return next;
              });
              setClipCaptionStatus(prev => { const next = [...prev]; next[idx] = "done"; return next; });
            } else {
              setClipCaptionStatus(prev => { const next = [...prev]; next[idx] = "error"; return next; });
            }
          } catch {
            if (!active) return;
            setClipCaptionStatus(prev => { const next = [...prev]; next[idx] = "error"; return next; });
          }
        });
      } catch (e: unknown) {
        if (!active) return;
        setErrorMsg(e instanceof Error ? e.message : "Terjadi kesalahan");
        setStatus("error");
      }
    }

    runGeneration();
    return () => { active = false; };
  }, [url, start, duration]);

  async function copyCaption(clipIdx: number, platform: Platform) {
    const text = clipCaptions[clipIdx]?.[platform];
    if (!text) return;
    const key = `${clipIdx}-${platform}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeys(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopiedKeys(prev => { const n = { ...prev }; delete n[key]; return n; }), 2000);
    } catch { /* fallback */ }
  }

  function setClipPlatform(clipIdx: number, platform: Platform) {
    setActivePlatforms(prev => { const n = [...prev]; n[clipIdx] = platform; return n; });
  }

  async function downloadClip(clipResult: ClipResult) {
    setDownloadingId(clipResult.filename);
    try {
      const res = await fetch(clipResult.clip_url);
      if (!res.ok) throw new Error("Gagal mengunduh file");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl; a.download = clipResult.filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: unknown) { console.error(e); }
    finally { setDownloadingId(null); }
  }

  function handleBack() { router.push("/dashboard"); }

  const steps = withSubtitle
    ? [{ id: 1, label: "Unduh" }, { id: 2, label: "Ekstrak" }, { id: 3, label: "Subtitle" }, { id: 4, label: "Selesai" }]
    : [{ id: 1, label: "Unduh" }, { id: 2, label: "Ekstrak" }, { id: 3, label: "Selesai" }];

  // For auto mode, show a cleaner header
  const loadingTitle = isAutoMode
    ? totalClips > 1 ? `Auto Generate (${currentClipIndex}/${totalClips})` : "Auto Generate Klip"
    : totalClips > 1 ? `Sedang Membuat Klip (${currentClipIndex}/${totalClips})` : "Sedang Membuat Klip";
  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 1, paddingTop: "40px" }}>

      {/* ── LOADING ── */}
      {status === "loading" && (
        <div className="animate-fade-up" style={{ maxWidth: "520px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
            {loadingTitle}
          </h2>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", margin: "0 0 24px 0", fontWeight: 500 }}>{loadingText}</p>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "32px", flexWrap: "wrap" }}>
            {steps.map((step) => {
              const isActive = currentStep === step.id;
              const isPassed = currentStep > step.id;
              return (
                <div key={step.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "12px", fontWeight: 700,
                    border: `1px solid ${isActive ? "rgba(255,255,255,0.8)" : isPassed ? "#fff" : "rgba(255,255,255,0.15)"}`,
                    background: isActive ? "rgba(255,255,255,0.12)" : isPassed ? "rgba(255,255,255,0.8)" : "transparent",
                    color: isActive || isPassed ? "#fff" : "rgba(255,255,255,0.4)",
                    transition: "all 0.4s",
                  }}>{isPassed ? "✓" : step.id}</div>
                  <span style={{ fontSize: "13px", color: isActive ? "#fff" : isPassed ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)", fontWeight: isActive ? 600 : 400 }}>
                    {step.label}
                  </span>
                  {step.id < steps[steps.length - 1].id && <div style={{ width: "20px", height: "1px", background: "rgba(255,255,255,0.15)" }} />}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "center", margin: "32px 0 16px" }}>
            <div className="animate-spin" style={{
              width: "48px", height: "48px", borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#fff",
            }} />
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Jangan tutup tab ini. Video Anda sedang diproses secara lokal.</p>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {status === "success" && results.length > 0 && (
        <div className="animate-fade-up">
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#22c55e", fontSize: "24px", marginBottom: "12px",
            }}>✓</div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0 }}>
              {results.length > 1 ? `${results.length} Klip Berhasil Dibuat!` : "Klip Berhasil Dibuat!"}
            </h2>
            {errorMsg && <p style={{ fontSize: "12px", color: "#fbbf24", marginTop: "8px", whiteSpace: "pre-line" }}>{errorMsg}</p>}
          </div>

          {/* One row per clip: video left, caption right */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "20px" }}>
            {results.map((clipResult, idx) => {
              const capStatus = clipCaptionStatus[idx] ?? "idle";
              const capData   = clipCaptions[idx] ?? { instagram: "", tiktok: "", youtube: "" };
              const platform  = activePlatforms[idx] ?? "instagram";
              const hasCap    = capStatus !== "idle";
              const copyKey   = `${idx}-${platform}`;
              const isCopied  = !!copiedKeys[copyKey];

              return (
                <div key={clipResult.filename} style={{
                  display: "grid",
                  gridTemplateColumns: hasCap ? "1fr 1fr" : "minmax(0,560px)",
                  justifyContent: hasCap ? "stretch" : "center",
                  gap: "16px", alignItems: "start",
                }}>
                  {/* ── Video card ── */}
                  <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" }}>
                    {results.length > 1 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Klip {idx + 1}</span>
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
                          {clipJobs[idx]?.startTime ?? secondsToTime(clipJobs[idx]?.start ?? 0)} · {clipJobs[idx]?.duration ?? 0}s
                        </span>
                      </div>
                    )}
                    <div style={{ borderRadius: "8px", overflow: "hidden", background: "#000", marginBottom: "10px" }}>
                      <video controls preload="metadata" playsInline src={clipResult.clip_url}
                        style={{ width: "100%", maxHeight: "240px", objectFit: "contain", display: "block" }} />
                    </div>
                    <button onClick={() => downloadClip(clipResult)} disabled={downloadingId === clipResult.filename}
                      style={{
                        width: "100%", padding: "9px", borderRadius: "50px", border: "none", background: "#fff",
                        color: "#000", fontSize: "13px", fontWeight: 600,
                        cursor: downloadingId === clipResult.filename ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        transition: "background 0.2s", opacity: downloadingId === clipResult.filename ? 0.5 : 1,
                      }}
                      onMouseEnter={e => { if (downloadingId !== clipResult.filename) e.currentTarget.style.background = "#e5e5e5"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      {downloadingId === clipResult.filename ? "Mengunduh..." : `Download`}
                    </button>
                  </div>

                  {/* ── Caption card ── */}
                  {hasCap && (
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>
                          Caption {results.length > 1 ? `Klip ${idx + 1}` : ""}
                        </span>
                        {capStatus === "loading" && (
                          <div className="animate-spin" style={{ width: "12px", height: "12px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#fff", flexShrink: 0 }} />
                        )}
                      </div>

                      {capStatus === "loading" && (
                        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", margin: "0 0 12px" }}>Groq AI sedang menulis...</p>
                      )}
                      {capStatus === "error" && (
                        <p style={{ fontSize: "12px", color: "#f87171", margin: "0 0 12px" }}>Gagal generate caption.</p>
                      )}

                      {capStatus === "done" && (
                        <>
                          {/* Platform tabs */}
                          <div style={{ display: "flex", gap: "4px", marginBottom: "10px", flexWrap: "wrap" }}>
                            {(["instagram", "tiktok", "youtube"] as Platform[]).map(p => {
                              const labels: Record<Platform, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YT Shorts" };
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

                          {/* Caption text */}
                          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "12px", marginBottom: "10px" }}>
                            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.8)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "180px", overflowY: "auto" }}>
                              {capData[platform]}
                            </p>
                          </div>

                          {/* Copy button */}
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

          <button onClick={handleBack} style={{
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
        <div className="animate-fade-up" style={{ maxWidth: "520px", margin: "0 auto", textAlign: "center" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%",
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "#f87171", fontSize: "24px", marginBottom: "12px",
          }}>!</div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fca5a5", marginBottom: "12px" }}>Gagal Membuat Klip</h2>
          <div style={{ color: "#fca5a5", fontSize: "13px", textAlign: "left", marginBottom: "24px", wordBreak: "break-word" }}>
            <span style={{ fontWeight: 600 }}>Detail Error: </span>{errorMsg}
          </div>
          <button onClick={handleBack} style={{
            width: "100%", padding: "13px", borderRadius: "50px",
            background: "#fff",
            color: "#000", border: "none", fontSize: "15px", fontWeight: 700,
            cursor: "pointer", transition: "background 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e5e5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >Generate Video Baru</button>
        </div>
      )}
    </div>
  );
}

export default function GeneratePage() {
  const router = useRouter();
  const [username, setUsername] = useState("User");

  useEffect(() => {
    const stored = sessionStorage.getItem("autoclip_user");
    if (stored) setUsername(stored);
  }, []);

  function handleLogout() {
    sessionStorage.removeItem("autoclip_user");
    router.push("/");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#000" }}>
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "64px", display: "grid", gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center", padding: "0 40px",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Image src="/logo.png" alt="Auto Clip Logo" width={150} height={48} priority
            style={{ objectFit: "contain", cursor: "pointer" }}
            onClick={() => router.push("/dashboard")}
          />
        </div>
        <nav style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={() => router.push("/dashboard")} style={{
            padding: "7px 16px", borderRadius: "8px", fontSize: "14px",
            fontWeight: 600, color: "rgba(255,255,255,0.7)",
            background: "transparent", border: "none", cursor: "pointer",
            transition: "color 0.2s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >Dashboard</button>
        </nav>
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
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#fff")}
          >Keluar</button>
        </div>
      </header>

      <div style={{
        flex: 1, paddingTop: "80px", paddingBottom: "48px",
        paddingLeft: "32px", paddingRight: "32px", position: "relative",
      }}>
        <div aria-hidden style={{
          position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)",
          width: "700px", height: "700px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />
        <Suspense fallback={
          <div style={{ maxWidth: "600px", margin: "0 auto", textAlign: "center", color: "#fff", paddingTop: "80px" }}>
            Loading generator...
          </div>
        }>
          <GenerateContent />
        </Suspense>
      </div>
    </div>
  );
}
