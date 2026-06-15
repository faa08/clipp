"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Footer from "@/app/components/Footer";

/* ── Animation hook ── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function TentangPage() {
  const router = useRouter();
  const [showProModal, setShowProModal] = useState(false);

  const refTitle    = useReveal();
  const refBisa     = useReveal();
  const refSteps    = useReveal();
  const refStep     = [useReveal(), useReveal(), useReveal(), useReveal()];
  const refDibuat   = useReveal();

  const revealStyle: React.CSSProperties = {
    opacity: 0,
    transform: "translateY(36px)",
    transition: "opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1)",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "var(--font-sans), -apple-system, sans-serif",
    }}>

      {/* ── Topbar ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "64px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
          <Image src="/logo.png" alt="Productive Clip" width={150} height={48} priority
            style={{ objectFit: "contain" }} />
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button onClick={() => router.push("/")} style={{
            padding: "10px 16px", borderRadius: "8px",
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 500,
            cursor: "pointer", transition: "color 0.2s ease-out",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >Beranda</button>
          <button onClick={() => router.push("/fitur")} style={{
            padding: "10px 16px", borderRadius: "8px",
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 500,
            cursor: "pointer", transition: "color 0.2s ease-out",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >Fitur</button>
          <button style={{
            padding: "10px 16px", borderRadius: "8px",
            background: "rgba(255,255,255,0.08)", border: "none",
            color: "#fff", fontSize: "14px", fontWeight: 600,
            cursor: "default", transition: "all 0.2s ease-out",
          }}>Tentang</button>
          <button onClick={() => setShowProModal(true)} style={{
            padding: "10px 16px", borderRadius: "8px",
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 500,
            cursor: "pointer", transition: "color 0.2s ease-out",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >Pricing</button>
        </nav>
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            padding: "10px 22px", borderRadius: "8px",
            background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff", fontSize: "14px", fontWeight: 600,
            cursor: "pointer", transition: "all 0.2s ease-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
          }}
        >My Dashboard</button>
      </header>

      {/* ── Main Content ── */}
      <main style={{ paddingTop: "120px", paddingBottom: "100px", maxWidth: "760px", margin: "0 auto", padding: "120px 32px 100px" }}>

        {/* Background glow */}
        <div aria-hidden style={{
          position: "fixed", top: "-100px", left: "50%", transform: "translateX(-50%)",
          width: "800px", height: "600px",
          background: "radial-gradient(ellipse at top, rgba(59,130,246,0.05) 0%, transparent 60%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>

          {/* ── Page Title ── */}
          <div ref={refTitle} style={{ ...revealStyle, textAlign: "center", marginBottom: "80px" }}>
            <p style={{
              fontSize: "11px", color: "rgba(255,255,255,0.28)",
              letterSpacing: "3px", textTransform: "uppercase", marginBottom: "16px",
            }}>TENTANG KAMI</p>
            <h1 style={{
              fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 800,
              letterSpacing: "-1.5px", lineHeight: 1.1,
              background: "linear-gradient(135deg, #fff 40%, #60a5fa 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              margin: "0 0 24px",
            }}>
              Apa itu ProductiveClip?
            </h1>
            <p style={{
              fontSize: "17px", color: "rgba(255,255,255,0.5)",
              lineHeight: 1.85, maxWidth: "600px", margin: "0 auto",
            }}>
              ProductiveClip adalah platform berbasis web yang membantu Anda memotong video YouTube
              menjadi klip-klip pendek berkualitas tinggi — langsung dari browser, tanpa perlu
              mengunduh software tambahan apapun.
            </p>
          </div>

          {/* ── Apa yang Bisa Dilakukan ── */}
          <section ref={refBisa} style={{ ...revealStyle, marginBottom: "72px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.4px", margin: "0 0 24px", textAlign: "center" }}>
              Apa yang Bisa Dilakukan?
            </h2>
            <div style={{ fontSize: "15px", color: "rgba(255,255,255,0.5)", lineHeight: 1.9 }}>
              <p style={{ margin: "0 0 16px" }}>
                Dengan ProductiveClip, Anda cukup memasukkan link video YouTube, menentukan
                waktu mulai dan durasi yang diinginkan, lalu sistem kami akan secara otomatis
                mengunduh dan memotong bagian video tersebut untuk Anda.
              </p>
              <p style={{ margin: 0 }}>
                Hasilnya berupa file video dengan format H.264 + AAC yang langsung bisa
                diputar di semua browser modern — tanpa perlu konversi tambahan. Cocok untuk
                keperluan presentasi, konten media sosial, atau bahan belajar.
              </p>
            </div>
          </section>

          {/* ── Cara Kerja ── */}
          <section style={{ marginBottom: "80px" }}>
            <div ref={refSteps} style={{ ...revealStyle, marginBottom: "36px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.4px", margin: 0, textAlign: "center" }}>
                Cara Kerja
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {([
                {
                  step: "1",
                  title: "Masukkan Link YouTube",
                  desc: "Salin URL video YouTube yang ingin Anda potong, lalu paste ke kolom yang tersedia di halaman Dashboard.",
                  color: "#3b82f6",
                },
                {
                  step: "2",
                  title: "Tentukan Waktu & Durasi",
                  desc: "Atur waktu mulai (format hh:mm:ss) dan durasi klip dalam detik. Misalnya, mulai dari 00:05:30 dengan durasi 45 detik.",
                  color: "#8b5cf6",
                },
                {
                  step: "3",
                  title: "Proses Otomatis",
                  desc: "Sistem kami menggunakan teknologi yt-dlp untuk mengunduh hanya bagian video yang Anda minta, lalu MoviePy memotongnya menjadi klip siap pakai.",
                  color: "#06b6d4",
                },
                {
                  step: "4",
                  title: "Unduh Klip Anda",
                  desc: "Setelah proses selesai, klip video langsung bisa diunduh atau diputar di browser. Tidak ada data yang dikirim ke pihak ketiga.",
                  color: "#22c55e",
                },
              ] as const).map((item, idx) => (
                <div
                  key={item.step}
                  ref={refStep[idx]}
                  style={{
                    ...revealStyle,
                    transitionDelay: `${idx * 0.1}s`,
                    display: "flex",
                    gap: "24px",
                    paddingBottom: idx < 3 ? "40px" : "0",
                    position: "relative",
                  }}
                >
                  {/* Vertical line connector */}
                  {idx < 3 && (
                    <div style={{
                      position: "absolute",
                      left: "21px",
                      top: "48px",
                      bottom: "0",
                      width: "1px",
                      background: "linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)",
                    }} />
                  )}

                  {/* Step circle */}
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
                    background: `${item.color}15`,
                    border: `1px solid ${item.color}35`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "15px", fontWeight: 800, color: item.color,
                    position: "relative", zIndex: 1,
                  }}>{item.step}</div>

                  {/* Content */}
                  <div style={{ paddingTop: "10px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.2px" }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", lineHeight: 1.75, margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Divider ── */}
          <div style={{ width: "100%", height: "1px", background: "rgba(255,255,255,0.06)", marginBottom: "80px" }} />

          {/* ── Dibuat Oleh ── */}
          <section ref={refDibuat} style={{ ...revealStyle, textAlign: "center" }}>
            <p style={{
              fontSize: "11px", color: "rgba(255,255,255,0.28)",
              letterSpacing: "3px", textTransform: "uppercase", marginBottom: "40px",
            }}>DIKEMBANGKAN OLEH</p>

            <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "32px" }}>
              <div style={{
                position: "absolute", width: "350px", height: "200px",
                borderRadius: "50%",
                background: "radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, rgba(160,160,160,0.05) 40%, transparent 70%)",
                filter: "blur(30px)",
                pointerEvents: "none",
                animation: "pulseGlow 4s ease-in-out infinite",
              }} />
              <Image
                src="/linkp.png"
                alt="PT.Link Productive"
                width={300}
                height={150}
                priority
                style={{ objectFit: "contain", position: "relative", zIndex: 1 }}
              />
            </div>

            <h3 style={{
              fontSize: "24px", fontWeight: 700, margin: "0 0 16px",
              letterSpacing: "-0.5px",
            }}>PT. Link Productive</h3>
            <p style={{
              fontSize: "15px", color: "rgba(255,255,255,0.45)",
              lineHeight: 1.85, maxWidth: "480px", margin: "0 auto",
            }}>
              ProductiveClip merupakan salah satu produk digital yang dikembangkan oleh
              PT. Link Productive — perusahaan teknologi yang berfokus pada solusi
              digital kreatif dan produktivitas untuk membantu pengguna bekerja lebih
              efisien dengan alat yang sederhana namun andal.
            </p>
          </section>

        </div>
      </main>

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
