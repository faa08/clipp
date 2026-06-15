"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Footer from "@/app/components/Footer";

/* ── Reveal hook ── */
function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.style.opacity = "1";
            el.style.transform = "translateY(0) scale(1)";
          }, delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);
  return ref;
}

const revealBase: React.CSSProperties = {
  opacity: 0,
  transform: "translateY(40px) scale(0.98)",
  transition: "opacity 0.75s cubic-bezier(0.22,1,0.36,1), transform 0.75s cubic-bezier(0.22,1,0.36,1)",
};

/* ── Floating orb animation component ── */
function FloatingOrb({ style }: { style: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        borderRadius: "50%",
        filter: "blur(80px)",
        pointerEvents: "none",
        animation: "float 8s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

const FEATURES = [
  {
    id: "auto-clip",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    color: "#f59e0b",
    label: "Auto Highlight",
    title: "AI temukan momen terbaik",
    desc: "Paste URL YouTube, dan AI kami otomatis membaca transcript untuk mencari bagian paling menarik — tanpa kamu harus scrub manual.",
    tags: ["Whisper AI", "Auto-detect", "Multi-language"],
    visual: "auto",
  },
  {
    id: "manual-clip",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    color: "#3b82f6",
    label: "Manual Clip",
    title: "Kontrol penuh di tanganmu",
    desc: "Pilih waktu mulai dan durasi sendiri. Tambah hingga 5 klip sekaligus dari satu video, semuanya diproses dalam satu batch.",
    tags: ["Up to 5 clips", "Batch process", "Custom timing"],
    visual: "manual",
  },
  {
    id: "subtitle",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <line x1="6" y1="14" x2="10" y2="14" />
        <line x1="12" y1="14" x2="18" y2="14" />
        <line x1="6" y1="18" x2="14" y2="18" />
      </svg>
    ),
    color: "#8b5cf6",
    label: "AI Subtitle",
    title: "Subtitle otomatis 3 style",
    desc: "Bakar subtitle langsung ke video dengan 3 style unik: Beasty (bold italic), Youshaei (karaoke hijau), atau Mozi (warna-warni).",
    tags: ["Beasty", "Youshaei", "Mozi"],
    visual: "subtitle",
  },
  {
    id: "layout",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="12" y1="3" x2="12" y2="21" />
      </svg>
    ),
    color: "#22c55e",
    label: "Portrait Layout",
    title: "Siap upload ke Reels & TikTok",
    desc: "Output otomatis dalam format portrait 9:16 dengan dua pilihan layout: blur background yang cinematic, atau split frame yang dinamis.",
    tags: ["9:16 Portrait", "Blur BG", "Split Frame"],
    visual: "layout",
  },
];

export default function FiturPage() {
  const router = useRouter();
  const [activeFeature, setActiveFeature] = useState(0);
  const [tick, setTick] = useState(0);
  const [showProModal, setShowProModal] = useState(false);

  const refHero    = useReveal(0);
  const refCards   = [useReveal(0), useReveal(100), useReveal(200), useReveal(300)];
  const refDemo    = useReveal(0);
  const refCta     = useReveal(0);

  /* Auto-cycle feature cards */
  useEffect(() => {
    const id = setInterval(() => {
      setActiveFeature(p => (p + 1) % FEATURES.length);
      setTick(p => p + 1);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      color: "#fff",
      fontFamily: "var(--font-sans), -apple-system, sans-serif",
      overflowX: "hidden",
    }}>

      {/* Global keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) }
          50% { transform: translateY(-24px) }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6 }
          50% { opacity: 1 }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg) }
          to { transform: rotate(360deg) }
        }
        @keyframes blink {
          0%, 100% { opacity: 1 }
          50% { opacity: 0 }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(12px) }
          to { opacity: 1; transform: translateX(0) }
        }
        @keyframes progress {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>

      {/* ── Topbar ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "64px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px",
        background: "rgba(8,8,8,0.9)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
          <Image src="/logo.png" alt="Productive Clip" width={150} height={48} priority style={{ objectFit: "contain" }} />
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button onClick={() => router.push("/")} style={{
            padding: "10px 16px", borderRadius: "8px", background: "transparent",
            border: "none", color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 500,
            cursor: "pointer", transition: "color 0.2s",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >Beranda</button>
          <button style={{
            padding: "10px 16px", borderRadius: "8px",
            background: "rgba(255,255,255,0.08)", border: "none",
            color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "default",
          }}>Fitur</button>
          <button onClick={() => router.push("/tentang")} style={{
            padding: "10px 16px", borderRadius: "8px", background: "transparent",
            border: "none", color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 500,
            cursor: "pointer", transition: "color 0.2s",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >Tentang</button>
          <button onClick={() => setShowProModal(true)} style={{
            padding: "10px 16px", borderRadius: "8px", background: "transparent",
            border: "none", color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 500,
            cursor: "pointer", transition: "color 0.2s",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >Pricing</button>
        </nav>
        <button onClick={() => router.push("/dashboard")} style={{
          padding: "10px 22px", borderRadius: "8px",
          background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff", fontSize: "14px", fontWeight: 600,
          cursor: "pointer", transition: "all 0.2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
        >My Dashboard</button>
      </header>

      {/* ── HERO ── */}
      <section style={{ paddingTop: "140px", paddingBottom: "80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <FloatingOrb style={{ top: "-120px", left: "10%", width: "500px", height: "500px", background: "rgba(245,158,11,0.06)", animationDuration: "10s" }} />
        <FloatingOrb style={{ top: "0px", right: "5%", width: "400px", height: "400px", background: "rgba(139,92,246,0.06)", animationDuration: "13s", animationDelay: "2s" }} />

        <div ref={refHero} style={{ ...revealBase, position: "relative", zIndex: 1 }}>
          <h1 style={{
            fontSize: "clamp(36px, 5.5vw, 64px)", fontWeight: 800,
            letterSpacing: "-2px", lineHeight: 1.1, margin: "0 0 20px",
            background: "linear-gradient(135deg, #fff 30%, rgba(255,255,255,0.5) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Satu tool.<br />Semua yang kamu butuhkan.
          </h1>
          <p style={{ fontSize: "17px", color: "rgba(255,255,255,0.45)", maxWidth: "520px", margin: "0 auto 40px", lineHeight: 1.8 }}>
            Dari auto-detect momen viral sampai subtitle AI — semuanya ada di sini,
            gratis, langsung di browser.
          </p>
          <button onClick={() => router.push("/login")} style={{
            padding: "14px 36px", borderRadius: "50px",
            background: "#fff", color: "#000", border: "none",
            fontSize: "15px", fontWeight: 700, cursor: "pointer", transition: "background 0.2s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e5e5e5")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
          >Coba Gratis →</button>
        </div>
      </section>

      {/* ── FEATURE CARDS GRID ── */}
      <section style={{ padding: "0 32px 100px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
          {FEATURES.map((f, idx) => (
            <div
              key={f.id}
              ref={refCards[idx]}
              style={{
                ...revealBase,
                borderRadius: "20px", padding: "32px",
                background: activeFeature === idx
                  ? `linear-gradient(135deg, ${f.color}12 0%, rgba(255,255,255,0.02) 100%)`
                  : "rgba(255,255,255,0.02)",
                border: "none",
                boxShadow: activeFeature === idx
                  ? `0 0 40px ${f.color}15, inset 0 1px 0 rgba(255,255,255,0.06)`
                  : "inset 0 1px 0 rgba(255,255,255,0.04)",
                transition: "box-shadow 0.5s, background 0.5s, transform 0.75s cubic-bezier(0.22,1,0.36,1), opacity 0.75s cubic-bezier(0.22,1,0.36,1)",
                cursor: "pointer",
              }}
              onClick={() => setActiveFeature(idx)}
              onMouseEnter={e => { if (activeFeature !== idx) e.currentTarget.style.boxShadow = "0 0 30px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)"; }}
              onMouseLeave={e => { if (activeFeature !== idx) e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.04)"; }}
            >
              {/* Icon */}
              <div style={{
                width: "52px", height: "52px", borderRadius: "14px", marginBottom: "20px",
                background: `${f.color}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: f.color,
                transition: "transform 0.3s",
              }}>
                {f.icon}
              </div>

              {/* Label badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "3px 10px", borderRadius: "20px", marginBottom: "12px",
                background: `${f.color}15`,
              }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: f.color, letterSpacing: "0.3px" }}>{f.label}</span>
              </div>

              <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.4px", color: "#fff" }}>
                {f.title}
              </h3>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", lineHeight: 1.75, margin: "0 0 20px" }}>
                {f.desc}
              </p>

              {/* Tags */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {f.tags.map(tag => (
                  <span key={tag} style={{
                    padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.5)",
                  }}>{tag}</span>
                ))}
              </div>

              {/* Active progress bar */}
              {activeFeature === idx && (
                <div style={{ marginTop: "20px", height: "2px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                  <div key={tick} style={{
                    height: "100%", borderRadius: "2px",
                    background: f.color,
                    animation: "progress 3s linear forwards",
                  }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE DEMO SECTION ── */}
      <section style={{ padding: "0 32px 100px", maxWidth: "1100px", margin: "0 auto" }}>
        <div ref={refDemo} style={{ ...revealBase }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "14px" }}>CARA PAKAI</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-1.5px", margin: 0 }}>Semudah copy-paste.</h2>
          </div>

          {/* Steps */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "rgba(255,255,255,0.06)", borderRadius: "20px", overflow: "hidden" }}>
            {[
              {
                n: "01",
                title: "Paste URL",
                desc: "Copy URL dari YouTube, paste ke dashboard. Sistem langsung baca metadata video.",
                color: "#f59e0b",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                ),
              },
              {
                n: "02",
                title: "Pilih Mode",
                desc: "Auto mode: biarkan AI yang pilih. Manual mode: tentukan sendiri timestamp dan durasi.",
                color: "#3b82f6",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                  </svg>
                ),
              },
              {
                n: "03",
                title: "Download",
                desc: "Klip selesai diproses dalam hitungan detik. Download langsung, siap upload ke platform.",
                color: "#22c55e",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                ),
              },
            ].map((step) => (
              <div key={step.n} style={{
                padding: "36px 32px",
                background: "#0d0d0d",
                position: "relative",
                overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: "-20px", right: "-20px",
                  fontSize: "80px", fontWeight: 900, color: `${step.color}08`,
                  lineHeight: 1, userSelect: "none", pointerEvents: "none",
                }}>{step.n}</div>
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px", marginBottom: "20px",
                  background: `${step.color}15`, border: `1px solid ${step.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: step.color,
                }}>
                  {step.icon}
                </div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 10px", letterSpacing: "-0.3px" }}>{step.title}</h3>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SUBTITLE STYLES SHOWCASE ── */}
      <section style={{ padding: "0 32px 100px", maxWidth: "1100px", margin: "0 auto" }}>
        <div ref={useReveal()} style={{ ...revealBase }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "14px" }}>SUBTITLE STYLES</p>
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 800, letterSpacing: "-1.2px", margin: 0 }}>3 style, 3 vibes berbeda.</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {[
              {
                name: "Beasty",
                color: "#fff",
                bg: "#111",
                preview: (
                  <div style={{ padding: "24px 20px", textAlign: "center" }}>
                    <span style={{
                      fontSize: "26px", fontWeight: 900, fontStyle: "italic", color: "#fff",
                      textShadow: "2px 2px 0px #000, 3px 3px 6px rgba(0,0,0,0.8)",
                      letterSpacing: "-0.5px",
                    }}>VIRAL MOMENT</span>
                  </div>
                ),
                desc: "Bold italic, heavy shadow. Cocok untuk konten energik.",
              },
              {
                name: "Youshaei",
                color: "#00ff00",
                bg: "#0a0a0a",
                preview: (
                  <div style={{ padding: "24px 20px", textAlign: "center" }}>
                    <span style={{ fontSize: "20px", fontWeight: 700 }}>
                      <span style={{ color: "#00ff00" }}>VIRAL </span>
                      <span style={{ color: "rgba(255,255,255,0.45)" }}>MOMENT RIGHT</span>
                    </span>
                  </div>
                ),
                desc: "Karaoke style. Kata aktif hijau, sisanya transparan.",
              },
              {
                name: "Mozi",
                color: "#fff",
                bg: "#0d0d0d",
                preview: (
                  <div style={{ padding: "24px 20px", textAlign: "center" }}>
                    <span style={{ fontSize: "22px", fontWeight: 900 }}>
                      <span style={{ color: "#fff" }}>VIRAL </span>
                      <span style={{ color: "#00ff00" }}>MOMENT </span>
                      <span style={{ color: "#fff" }}>NOW</span>
                    </span>
                  </div>
                ),
                desc: "Warna putih & hijau selang-seling per kata. Eye-catching.",
              },
            ].map((s) => (
              <div key={s.name} style={{
                borderRadius: "16px", overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                background: s.bg,
              }}>
                {/* Preview area */}
                <div style={{
                  background: "linear-gradient(135deg, #1a1a1a, #0a0a0a)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  minHeight: "90px", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {s.preview}
                </div>
                {/* Info */}
                <div style={{ padding: "16px 20px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#fff" }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "0 32px 120px" }}>
        <div ref={refCta} style={{
          ...revealBase,
          maxWidth: "700px", margin: "0 auto", textAlign: "center",
          padding: "64px 40px", borderRadius: "24px",
          background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(139,92,246,0.06) 100%)",
          border: "1px solid rgba(245,158,11,0.15)",
          position: "relative", overflow: "hidden",
        }}>
          <FloatingOrb style={{ top: "-60px", left: "-60px", width: "200px", height: "200px", background: "rgba(245,158,11,0.1)", animationDuration: "7s", filter: "blur(50px)" }} />
          <FloatingOrb style={{ bottom: "-60px", right: "-60px", width: "200px", height: "200px", background: "rgba(139,92,246,0.1)", animationDuration: "9s", animationDelay: "1s", filter: "blur(50px)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px" }}>MULAI SEKARANG</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-1.2px", margin: "0 0 16px" }}>
              Gratis. Selamanya.
            </h2>
            <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.45)", margin: "0 0 36px", lineHeight: 1.7 }}>
              Tidak perlu daftar, tidak perlu bayar. Langsung coba semua fitur sekarang.
            </p>
            <button onClick={() => router.push("/login")} style={{
              padding: "15px 40px", borderRadius: "50px",
              background: "#fff", color: "#000", border: "none",
              fontSize: "15px", fontWeight: 700, cursor: "pointer", transition: "background 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "#e5e5e5")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
            >Coba Semua Fitur →</button>
          </div>
        </div>
      </section>

      <Footer />

      {/* ── Pro Pricing Modal ── */}
      {showProModal && (
        <>
          <div onClick={() => setShowProModal(false)} style={{
            position: "fixed", inset: 0, zIndex: 999,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            zIndex: 1000, width: "min(860px, 95vw)", maxHeight: "90vh", overflowY: "auto",
            background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "20px", padding: "40px 36px",
          }}>
            <button onClick={() => setShowProModal(false)} style={{
              position: "absolute", top: "16px", right: "16px",
              width: "32px", height: "32px", borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "16px",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            >×</button>
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 14px", borderRadius: "20px", background: "#f59e0b", marginBottom: "16px" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#000", letterSpacing: "0.8px", textTransform: "uppercase" }}>Premium Access</span>
              </div>
              <h2 style={{ fontSize: "36px", fontWeight: 800, color: "#fff", margin: "0 0 10px", letterSpacing: "-0.5px" }}>Upgrade to Pro</h2>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>Buka potensi penuh clipper Anda dengan fitur AI tercanggih di industri.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              {/* Free */}
              <div style={{ borderRadius: "16px", padding: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column" }}>
                <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#fff" }}>Free</p>
                <div style={{ marginBottom: "12px" }}><span style={{ fontSize: "32px", fontWeight: 800, color: "#fff" }}>Rp0</span><span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>/bulan</span></div>
                <p style={{ margin: "0 0 20px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>Untuk pemula yang baru memulai perjalanan clipping.</p>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                  {[{ text: "AI Clipping Dasar", included: true }, { text: "Export 720p", included: true }, { text: "Cloud Storage (2GB)", included: false }].map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {f.included ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                      <span style={{ fontSize: "13px", color: f.included ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)", textDecoration: f.included ? "none" : "line-through" }}>{f.text}</span>
                    </div>
                  ))}
                </div>
                <button style={{ width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                >Pilih Paket</button>
              </div>
              {/* Clipper Pro */}
              <div style={{ borderRadius: "16px", padding: "24px", background: "rgba(251,191,36,0.06)", border: "2px solid #f59e0b", display: "flex", flexDirection: "column", position: "relative" }}>
                <div style={{ position: "absolute", top: "-13px", left: "50%", transform: "translateX(-50%)", padding: "4px 14px", borderRadius: "20px", background: "#f59e0b", fontSize: "10px", fontWeight: 800, color: "#000", letterSpacing: "0.5px", textTransform: "uppercase", whiteSpace: "nowrap" }}>Best for Productive Clip</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#fff" }}>Clipper Pro</p>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                </div>
                <div style={{ marginBottom: "12px" }}><span style={{ fontSize: "32px", fontWeight: 800, color: "#fff" }}>Rp149k</span><span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>/3 bulan</span></div>
                <p style={{ margin: "0 0 20px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>Maksimalkan konten Anda dengan fitur pro tak terbatas.</p>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                  {["AI Auto-Clipping Pro", "Export 4K Ultra HD", "Cloud Storage (100GB)", "Priority Rendering", "Multi-platform distribution"].map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button style={{ width: "100%", padding: "11px", borderRadius: "10px", border: "none", background: "#f59e0b", color: "#000", fontSize: "13px", fontWeight: 800, cursor: "pointer", transition: "background 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fbbf24")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#f59e0b")}
                >Pilih Paket</button>
              </div>
              {/* Agency */}
              <div style={{ borderRadius: "16px", padding: "24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column" }}>
                <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#fff" }}>Agency</p>
                <div style={{ marginBottom: "12px" }}><span style={{ fontSize: "32px", fontWeight: 800, color: "#fff" }}>Rp499k</span><span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>/3 bulan</span></div>
                <p style={{ margin: "0 0 20px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>Solusi skala besar untuk tim dan agensi konten.</p>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                  {["Semua Fitur Pro", "Team Collaboration (10 Device)", "Unlimited Cloud Storage", "Dedicated Account Manager"].map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)" }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button style={{ width: "100%", padding: "11px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                >Pilih Paket</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
