"use client";

import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

type Status = "idle" | "loading" | "success" | "error";

interface ClipResult {
  clip_url: string;
  filename: string;
  message: string;
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

  return {
    start,
    startTime: startTime || secondsToTime(start),
    duration,
  };
}

interface BatchJob {
  url: string;
  clips: ClipJob[];
}

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

  useEffect(() => {
    let active = true;

    function parseBatch(): BatchJob | null {
      const raw = sessionStorage.getItem("autoclip_batch");
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as BatchJob;
        if (!parsed.url || !Array.isArray(parsed.clips) || parsed.clips.length === 0) return null;
        return parsed;
      } catch {
        return null;
      }
    }

    async function generateOne(videoUrl: string, clip: ClipJob): Promise<ClipResult> {
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
        body: JSON.stringify({
          url: videoUrl,
          start_time: clip.start,
          duration: clip.duration,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Gagal memproses video" }));
        throw new Error(err.detail ?? "Gagal memproses video");
      }

      return res.json();
    }

    async function runGeneration() {
      const batch = parseBatch();
      const jobs: { videoUrl: string; clip: ClipJob }[] = batch
        ? batch.clips.map((clip) => ({
            videoUrl: batch.url,
            clip: normalizeClip(clip as unknown as Record<string, unknown>),
          }))
        : url
          ? [{
              videoUrl: url,
              clip: normalizeClip({
                start: parseInt(start, 10) || 0,
                duration: parseInt(duration, 10) || 30,
              }),
            }]
          : [];

      if (jobs.length === 0) {
        setErrorMsg("Data klip tidak ditemukan");
        setStatus("error");
        return;
      }

      setClipJobs(jobs.map((job) => job.clip));
      setTotalClips(jobs.length);
      const completed: ClipResult[] = [];
      const errors: string[] = [];

      try {
        for (let i = 0; i < jobs.length; i++) {
          if (!active) return;
          setCurrentClipIndex(i + 1);
          setCurrentStep(1);
          setLoadingText(
            jobs.length > 1
              ? `Memproses klip ${i + 1} dari ${jobs.length}...`
              : "Mengunduh bagian video dari YouTube (yt-dlp)..."
          );

          try {
            const data = await generateOne(jobs[i].videoUrl, jobs[i].clip);
            if (!active) return;

            setCurrentStep(3);
            setLoadingText(
              jobs.length > 1
                ? `Klip ${i + 1} selesai!`
                : "Klip selesai dibuat!"
            );
            completed.push(data);
            setResults([...completed]);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Terjadi kesalahan";
            errors.push(`Klip ${i + 1}: ${msg}`);
          }
        }

        if (!active) return;
        sessionStorage.removeItem("autoclip_batch");

        if (completed.length === 0) {
          setErrorMsg(errors.join("\n"));
          setStatus("error");
          return;
        }

        if (errors.length > 0) {
          setErrorMsg(`${completed.length} klip berhasil, ${errors.length} gagal:\n${errors.join("\n")}`);
        }

        setStatus("success");
      } catch (e: unknown) {
        if (!active) return;
        setErrorMsg(e instanceof Error ? e.message : "Terjadi kesalahan");
        setStatus("error");
      }
    }

    runGeneration();

    return () => {
      active = false;
    };
  }, [url, start, duration]);

  async function downloadClip(clipResult: ClipResult) {
    setDownloadingId(clipResult.filename);
    try {
      const res = await fetch(clipResult.clip_url);
      if (!res.ok) throw new Error("Gagal mengunduh file");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = clipResult.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setDownloadingId(null);
    }
  }

  function handleBack() {
    router.push("/dashboard");
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", position: "relative", zIndex: 1 }}>
      {/* Central Card */}
      <div className="animate-fade-up" style={{
        background: "#18181f", border: "1px solid #2a2a38",
        borderRadius: "20px", padding: "32px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
        marginTop: "40px"
      }}>
        {/* Loading state */}
        {status === "loading" && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f0f0f5", marginBottom: "8px" }}>
              {totalClips > 1 ? `Sedang Membuat Klip (${currentClipIndex}/${totalClips})` : "Sedang Membuat Klip"}
            </h2>
            <p style={{ fontSize: "14px", color: "#a855f7", margin: "0 0 24px 0", fontWeight: 500 }}>
              {loadingText}
            </p>

            {/* Steps Visual Indicator */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
              {[
                { id: 1, label: "Unduh" },
                { id: 2, label: "Ekstrak" },
                { id: 3, label: "Selesai" }
              ].map((step) => {
                const isActive = currentStep === step.id;
                const isPassed = currentStep > step.id;
                return (
                  <div key={step.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: 700,
                      border: `1px solid ${isActive || isPassed ? "#a855f7" : "#2a2a38"}`,
                      background: isActive ? "rgba(168,85,247,0.2)" : isPassed ? "#a855f7" : "#111",
                      color: isActive || isPassed ? "#fff" : "#4b5563",
                      transition: "all 0.4s",
                    }}>
                      {isPassed ? "✓" : step.id}
                    </div>
                    <span style={{ fontSize: "13px", color: isActive || isPassed ? "#e2d9f3" : "#4b5563", fontWeight: isActive ? 600 : 400 }}>
                      {step.label}
                    </span>
                    {step.id < 3 && <div style={{ width: "20px", height: "1px", background: "#2a2a38" }} />}
                  </div>
                );
              })}
            </div>

            {/* Glowing circular loading spinner */}
            <div style={{ display: "flex", justifyContent: "center", margin: "32px 0 16px" }}>
              <div className="animate-spin" style={{
                width: "48px", height: "48px",
                borderRadius: "50%",
                border: "3px solid rgba(168,85,247,0.1)",
                borderTopColor: "#a855f7",
              }} />
            </div>

            <p style={{ fontSize: "12px", color: "#6b7280" }}>
              Jangan tutup tab ini. Video Anda sedang diproses secara lokal.
            </p>
          </div>
        )}

        {/* Success State */}
        {status === "success" && results.length > 0 && (
          <div className="animate-fade-up">
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "#22c55e", fontSize: "24px", marginBottom: "12px"
              }}>✓</div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f0f0f5", margin: 0 }}>
                {results.length > 1 ? `${results.length} Klip Berhasil Dibuat!` : "Klip Berhasil Dibuat!"}
              </h2>
              <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "6px" }}>
                Tonton preview di bawah, lalu download klip yang kamu mau.
              </p>
              {errorMsg && (
                <p style={{ fontSize: "12px", color: "#fbbf24", marginTop: "8px", whiteSpace: "pre-line" }}>
                  {errorMsg}
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "16px" }}>
              {results.map((clipResult, idx) => (
                <div key={clipResult.filename} style={{
                  borderRadius: "12px", border: "1px solid #2a2a38",
                  background: "#111116", padding: "12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 4px 10px", gap: "12px", flexWrap: "wrap" }}>
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "#c084fc", margin: 0 }}>
                      {results.length > 1 ? `Klip ${idx + 1}` : "Hasil Klip"}
                    </p>
                    <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0, fontFamily: "monospace" }}>
                      Start {clipJobs[idx]?.startTime ?? secondsToTime(clipJobs[idx]?.start ?? 0)} · {clipJobs[idx]?.duration ?? 0} detik
                    </p>
                  </div>
                  <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #2a2a38", background: "#000", marginBottom: "10px" }}>
                    <video controls preload="metadata" playsInline src={clipResult.clip_url}
                      style={{ width: "100%", maxHeight: "260px", objectFit: "contain", display: "block" }} />
                  </div>
                  <button
                    onClick={() => downloadClip(clipResult)}
                    disabled={downloadingId === clipResult.filename}
                    style={{
                      width: "100%", padding: "11px", borderRadius: "10px",
                      border: "1px solid rgba(168,85,247,0.35)", background: "rgba(168,85,247,0.08)",
                      color: "#c084fc", fontSize: "13px", fontWeight: 600,
                      cursor: downloadingId === clipResult.filename ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      transition: "all 0.2s", opacity: downloadingId === clipResult.filename ? 0.5 : 1,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {downloadingId === clipResult.filename ? "Mengunduh file..." : `Download ${clipResult.filename}`}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleBack}
              style={{
                width: "100%", padding: "13px", borderRadius: "12px",
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                color: "#fff", border: "none", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", transition: "opacity 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              Generate Video Baru
            </button>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="animate-fade-up" style={{ textAlign: "center" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#f87171", fontSize: "24px", marginBottom: "12px"
            }}>!</div>
            
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fca5a5", marginBottom: "12px" }}>
              Gagal Membuat Klip
            </h2>
            <div style={{
              padding: "14px 16px", borderRadius: "12px",
              background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)",
              color: "#fca5a5", fontSize: "13px", textAlign: "left", marginBottom: "24px",
              wordBreak: "break-word"
            }}>
              <span style={{ fontWeight: 600 }}>Detail Error: </span>{errorMsg}
            </div>

            {/* Back to Dashboard Button */}
            <button
              onClick={handleBack}
              style={{
                width: "100%", padding: "13px", borderRadius: "12px",
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                color: "#fff", border: "none", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", transition: "opacity 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              Generate Video Baru
            </button>
          </div>
        )}
      </div>
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
    <>
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
            onClick={() => router.push("/dashboard")}
          />
        </div>

        {/* Center: Nav — only Dashboard */}
        <nav style={{ display: "flex", justifyContent: "center" }}>
          <button 
            onClick={() => router.push("/dashboard")}
            style={{
              padding: "7px 20px", borderRadius: "8px", fontSize: "13px",
              fontWeight: 600, color: "#e2d9f3",
              background: "rgba(168,85,247,0.12)",
              border: "1px solid rgba(168,85,247,0.25)",
              cursor: "pointer",
            }}
          >Dashboard</button>
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
        minHeight: "100vh", background: "#0f0f13",
        paddingTop: "92px", paddingBottom: "48px",
        paddingLeft: "32px", paddingRight: "32px",
      }}>
        {/* Bg orbs */}
        <div aria-hidden style={{
          position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)",
          width: "700px", height: "700px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
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
    </>
  );
}
