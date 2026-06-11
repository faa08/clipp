"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

const NAV_LINKS = [
  { label: "Fitur", href: "#" },
  { label: "Tentang", href: "/tentang" },
];
export default function HomePage() {
  const router = useRouter();
  const [inputUrl, setInputUrl] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  function handleGetClips() {
    if (inputUrl.trim()) {
      router.push("/login");
    } else {
      router.push("/login");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      color: "#fff",
      fontFamily: "var(--font-sans), -apple-system, sans-serif",
      overflowX: "hidden",
    }}>

      {/* ══════════════ TOPBAR ══════════════ */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "64px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
          <Image src="/logo.png" alt="Productive Clip" width={150} height={48} priority
            style={{ objectFit: "contain" }} />
        </div>

        {/* Nav Links */}
        <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          
          {/* Fitur Dropdown Wrapper */}
          <div 
            onMouseEnter={() => setShowDropdown(true)}
            onMouseLeave={() => setShowDropdown(false)}
            style={{ position: "relative" }}
          >
            <button style={{
              padding: "7px 16px", borderRadius: "8px",
              background: showDropdown ? "rgba(255,255,255,0.06)" : "transparent",
              border: "none",
              color: showDropdown ? "#fff" : "rgba(255,255,255,0.7)", 
              fontSize: "14px",
              cursor: "pointer", transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: "6px",
            }}
            >
              Fitur 
              <svg 
                width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" 
                style={{ 
                  transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)", 
                  transition: "transform 0.2s ease",
                  opacity: 0.8
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 12px)",
                left: "50%",
                transform: "translateX(-50%)",
                width: "420px",
                background: "#18181f",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "16px",
                padding: "20px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                zIndex: 1000,
              }}>
                {[
                  {
                    title: "Generate Video Clip",
                    desc: "Ubah video YouTube panjang jadi klip pendek otomatis.",
                    icon: "🎬",
                  },
                  {
                    title: "Generate Ide Caption",
                    desc: "Dapatkan saran caption keren berbasis AI instan.",
                    icon: "✍️",
                  },
                  {
                    title: "AI Subtitle Generator",
                    desc: "Tambahkan subtitle otomatis dengan akurasi tinggi.",
                    icon: "🗣️",
                  }
                ].map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => router.push("/login")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      padding: "12px",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "background 0.2s, transform 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{
                      width: "44px", height: "44px", borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "20px",
                      flexShrink: 0,
                    }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.2px" }}>
                        {item.title}
                      </h4>
                      <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)", margin: "4px 0 0", lineHeight: 1.4 }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tentang button */}
          <button onClick={() => router.push("/tentang")} style={{
            padding: "7px 16px", borderRadius: "8px",
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.7)", fontSize: "14px",
            cursor: "pointer", transition: "color 0.2s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >
            Tentang
          </button>
        </nav>

        {/* Right: My Dashboard */}
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            padding: "9px 22px", borderRadius: "8px",
            background: "transparent", border: "none",
            color: "#fff", fontSize: "14px", fontWeight: 600,
            cursor: "pointer", transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#fff")}
        >My Dashboard</button>
      </header>

      {/* ══════════════ HERO ══════════════ */}
      <section style={{
        paddingTop: "160px",
        paddingBottom: "0px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* ── Local Video Background ── */}
        <div style={{
          position: "absolute", inset: 0,
          zIndex: 0, overflow: "hidden",
          pointerEvents: "none",
        }}>
          <video
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: "absolute",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              minWidth: "100%",
              minHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "cover",
            }}
          >
            <source src="/bg-video.mp4" type="video/mp4" />
          </video>
          {/* Dark gradient overlay so text is readable */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.95) 100%)",
          }} />
        </div>

        {/* Subtle top radial glow */}
        <div aria-hidden style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: "900px", height: "500px",
          background: "radial-gradient(ellipse at top, rgba(255,255,255,0.04) 0%, transparent 65%)",
          pointerEvents: "none",
          zIndex: 1,
        }} />

        {/* Badge */}
        <div className="animate-fade-up" style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          marginBottom: "28px", fontSize: "13px", fontWeight: 600,
          letterSpacing: "0.5px", position: "relative", zIndex: 2,
        }}>
          <span style={{ color: "#f97316" }}>#1</span>
          <span style={{ color: "rgba(255,255,255,0.75)" }}>VIDEO CLIPPING TOOL LOKAL</span>
        </div>

        {/* Headline */}
        <h1 className="animate-fade-up" style={{
          fontSize: "clamp(40px, 6.5vw, 76px)",
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: "-2.5px",
          margin: "0 auto 20px",
          maxWidth: "900px",
          color: "#fff",
          animationDelay: "0.05s",
          position: "relative", zIndex: 2,
          textShadow: "0 2px 20px rgba(0,0,0,0.5)",
        }}>
          1 video panjang,<br />klip siap pakai. Instan.
        </h1>

        {/* Sub */}
        <p className="animate-fade-up" style={{
          fontSize: "17px", color: "rgba(255,255,255,0.75)",
          maxWidth: "540px", margin: "0 auto 44px",
          lineHeight: 1.7, animationDelay: "0.1s",
          position: "relative", zIndex: 2,
          textShadow: "0 1px 10px rgba(0,0,0,0.5)",
        }}>
          Productive Clip mengubah video YouTube panjang menjadi klip pendek
          berkualitas tinggi — langsung di perangkat Anda, tanpa akun cloud.
        </p>

        {/* ── Input + Button Row ── */}
        <div className="animate-fade-up" style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "0", maxWidth: "620px", margin: "0 auto 20px",
          animationDelay: "0.15s",
          position: "relative", zIndex: 2,
        }}>
          {/* Input pill */}
          <div style={{
            flex: 1,
            display: "flex", alignItems: "center", gap: "10px",
            padding: "14px 20px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "50px 0 0 50px",
            backdropFilter: "blur(16px)",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <input
              type="url"
              placeholder="Drop a video link"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGetClips()}
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: "#fff", fontSize: "15px",
              }}
            />
          </div>

          {/* Get clips button */}
          <button
            onClick={handleGetClips}
            style={{
              padding: "14px 28px",
              borderRadius: "0 50px 50px 0",
              background: "#fff", color: "#000",
              fontSize: "15px", fontWeight: 700,
              border: "none", cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e5e5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >Get free clips</button>

          {/* Or */}
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", margin: "0 16px" }}>or</span>

          {/* Upload files */}
          <button
            onClick={() => router.push("/login")}
            style={{
              padding: "13px 22px", borderRadius: "50px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff", fontSize: "14px", fontWeight: 600,
              cursor: "pointer", transition: "border-color 0.2s, background 0.2s",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.6)";
              e.currentTarget.style.background = "rgba(255,255,255,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
          >Upload files</button>
        </div>

        {/* Small hint */}
        <p className="animate-fade-up" style={{
          fontSize: "12px", color: "rgba(255,255,255,0.45)",
          marginBottom: "64px", animationDelay: "0.2s",
          position: "relative", zIndex: 2,
        }}>
          Supports YouTube · No account needed · 100% local
        </p>

        {/* ── Preview Cards Row ── */}
        <div className="animate-fade-up" style={{
          display: "flex", gap: "16px",
          justifyContent: "center", alignItems: "flex-end",
          padding: "0 32px",
          animationDelay: "0.25s",
          overflow: "hidden",
          position: "relative", zIndex: 2,
        }}>
          {/* Left card (smaller, offset) */}
          <div style={{
            width: "280px", flexShrink: 0,
            borderRadius: "16px 16px 0 0",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            transform: "translateY(20px)",
            opacity: 0.6,
          }}>
            <PreviewCard
              title="Tutorial React Hooks"
              duration="0:30"
              tag="Tech"
              color="#3b82f6"
            />
          </div>

          {/* Center card (main, taller) */}
          <div style={{
            width: "340px", flexShrink: 0,
            borderRadius: "16px 16px 0 0",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.05)",
            boxShadow: "0 0 60px rgba(255,255,255,0.05)",
          }}>
            <PreviewCard
              title="10 Tips Produktivitas 2024"
              duration="0:45"
              tag="Trending"
              color="#a855f7"
              isMain
            />
          </div>

          {/* Right card (smaller, offset) */}
          <div style={{
            width: "280px", flexShrink: 0,
            borderRadius: "16px 16px 0 0",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            transform: "translateY(20px)",
            opacity: 0.6,
          }}>
            <PreviewCard
              title="Belajar Next.js dalam 1 Jam"
              duration="1:00"
              tag="Dev"
              color="#22c55e"
            />
          </div>
        </div>
      </section>

      {/* ══════════════ CREATED BY SECTION ══════════════ */}
      <section style={{
        background: "#0a0a0a",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "80px 40px",
        marginTop: "0",
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "32px" }}>
          <p style={{ textAlign: "center", fontSize: "16px", color: "rgba(255,255,255,0.5)", letterSpacing: "1px", marginBottom: "0" }}>
            created by...
          </p>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Outer white glow */}
            <div style={{
              position: "absolute", width: "600px", height: "350px",
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.16) 0%, rgba(180,180,180,0.08) 35%, transparent 70%)",
              filter: "blur(40px)",
              pointerEvents: "none",
              animation: "pulseGlow 4s ease-in-out infinite",
            }} />
            {/* Inner gray accent */}
            <div style={{
              position: "absolute", width: "350px", height: "200px",
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(240,240,240,0.14) 0%, rgba(160,160,160,0.06) 40%, transparent 70%)",
              filter: "blur(25px)",
              pointerEvents: "none",
              animation: "pulseGlow 4s ease-in-out infinite 1s",
            }} />
            {/* Left side glow */}
            <div style={{
              position: "absolute", left: "-180px", top: "10px",
              width: "300px", height: "220px",
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.18) 0%, rgba(150,150,150,0.07) 50%, transparent 75%)",
              filter: "blur(35px)",
              pointerEvents: "none",
              animation: "pulseGlow 5s ease-in-out infinite 0.5s",
            }} />
            {/* Right side glow */}
            <div style={{
              position: "absolute", right: "-180px", top: "10px",
              width: "300px", height: "220px",
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(230,230,230,0.16) 0%, rgba(170,170,170,0.08) 50%, transparent 75%)",
              filter: "blur(35px)",
              pointerEvents: "none",
              animation: "pulseGlow 5s ease-in-out infinite 2s",
            }} />
            <Image
              src="/linkp.png"
              alt="LinkPro"
              width={500}
              height={250}
              priority
              style={{ objectFit: "contain", maxWidth: "100%", position: "relative", zIndex: 1 }}
            />
          </div>
        </div>
      </section>

      {/* ══════════════ CTA SECTION ══════════════ */}
      <section style={{ padding: "80px 40px", textAlign: "center", background: "#000" }}>
        <h2 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: "16px" }}>
          Coba sekarang. Gratis.
        </h2>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "16px", marginBottom: "36px" }}>
          Tidak perlu daftar. Tidak perlu bayar. Langsung pakai.
        </p>
        <button
          onClick={() => router.push("/login")}
          style={{
            padding: "15px 40px", borderRadius: "50px",
            background: "#fff", color: "#000",
            fontSize: "16px", fontWeight: 700, border: "none",
            cursor: "pointer", transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e5e5")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
        >Mulai Gratis →</button>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "24px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#000",
      }}>
        <Image src="/logo.png" alt="Productive Clip" width={120} height={40} style={{ objectFit: "contain", opacity: 0.6 }} />
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
          © 2026 ProductiveClip · Created by PT.Link Productive
        </span>
      </footer>
    </div>
  );
}

/* ── Preview Card Component ── */
function PreviewCard({ title, duration, tag, color, isMain }: {
  title: string; duration: string; tag: string; color: string; isMain?: boolean;
}) {
  const height = isMain ? "260px" : "200px";
  return (
    <div style={{ position: "relative", height, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      {/* Gradient bg */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(160deg, ${color}22 0%, #111 60%)`,
      }} />
      {/* Play icon */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-60%)",
        width: isMain ? "56px" : "44px", height: isMain ? "56px" : "44px",
        borderRadius: "50%", background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width={isMain ? "20" : "16"} height={isMain ? "20" : "16"} viewBox="0 0 24 24" fill="white">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      </div>
      {/* Bottom info */}
      <div style={{ position: "relative", padding: "16px", zIndex: 1 }}>
        <div style={{
          display: "inline-block", padding: "3px 10px", borderRadius: "20px",
          background: `${color}30`, border: `1px solid ${color}50`,
          color: color, fontSize: "11px", fontWeight: 600, marginBottom: "8px",
        }}>{tag}</div>
        <div style={{ fontSize: isMain ? "14px" : "12px", fontWeight: 600, color: "#fff", lineHeight: 1.4 }}>{title}</div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>{duration}</div>
      </div>
    </div>
  );
}
