"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Footer from "@/app/components/Footer";

export default function TentangPage() {
  const router = useRouter();

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
            padding: "7px 16px", borderRadius: "8px",
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.7)", fontSize: "14px",
            cursor: "pointer",
          }}>Beranda</button>
          <button style={{
            padding: "7px 16px", borderRadius: "8px",
            background: "rgba(255,255,255,0.08)", border: "none",
            color: "#fff", fontSize: "14px", fontWeight: 600,
            cursor: "default",
          }}>Tentang</button>
        </nav>
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

      {/* ── Main Content ── */}
      <main style={{ paddingTop: "120px", paddingBottom: "80px", maxWidth: "800px", margin: "0 auto", padding: "120px 32px 80px" }}>

        {/* Background glow */}
        <div aria-hidden style={{
          position: "fixed", top: "-100px", left: "50%", transform: "translateX(-50%)",
          width: "800px", height: "600px",
          background: "radial-gradient(ellipse at top, rgba(59,130,246,0.06) 0%, transparent 60%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>

          {/* ── Page Title ── */}
          <div className="animate-fade-up" style={{ textAlign: "center", marginBottom: "64px" }}>
            <p style={{
              fontSize: "12px", color: "rgba(255,255,255,0.3)",
              letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px",
            }}>TENTANG KAMI</p>
            <h1 style={{
              fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800,
              letterSpacing: "-1.5px", lineHeight: 1.15,
              background: "linear-gradient(135deg, #fff 40%, #60a5fa 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              margin: "0 0 20px",
            }}>
              Apa itu ProductiveClip?
            </h1>
            <p style={{
              fontSize: "17px", color: "rgba(255,255,255,0.55)",
              lineHeight: 1.8, maxWidth: "620px", margin: "0 auto",
            }}>
              ProductiveClip adalah platform berbasis web yang membantu Anda memotong video YouTube
              menjadi klip-klip pendek berkualitas tinggi — langsung dari browser, tanpa perlu
              mengunduh software tambahan apapun.
            </p>
          </div>

          {/* ── Apa yang Bisa Dilakukan ── */}
          <section className="animate-fade-up" style={{
            marginBottom: "56px", padding: "32px",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            animationDelay: "0.1s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "12px",
                background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px",
              }}>🎬</div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>
                Apa yang Bisa Dilakukan?
              </h2>
            </div>
            <div style={{ fontSize: "15px", color: "rgba(255,255,255,0.55)", lineHeight: 1.85 }}>
              <p style={{ margin: "0 0 12px" }}>
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
          <section className="animate-fade-up" style={{
            marginBottom: "56px",
            animationDelay: "0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "12px",
                background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px",
              }}>⚙️</div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>
                Cara Kerja
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
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
              ].map((item) => (
                <div key={item.step} style={{
                  display: "flex", gap: "20px", padding: "24px",
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  transition: "border-color 0.3s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${item.color}40`)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
                >
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
                    background: `${item.color}18`, border: `1px solid ${item.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "16px", fontWeight: 800, color: item.color,
                  }}>{item.step}</div>
                  <div>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.2px" }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Dibuat Oleh ── */}
          <section className="animate-fade-up" style={{
            padding: "40px 32px",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            textAlign: "center",
            animationDelay: "0.3s",
          }}>
            <p style={{
              fontSize: "12px", color: "rgba(255,255,255,0.3)",
              letterSpacing: "2px", textTransform: "uppercase", marginBottom: "20px",
            }}>DIKEMBANGKAN OLEH</p>

            <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
              {/* Glow behind logo */}
              <div style={{
                position: "absolute", width: "350px", height: "200px",
                borderRadius: "50%",
                background: "radial-gradient(ellipse at center, rgba(255,255,255,0.14) 0%, rgba(160,160,160,0.06) 40%, transparent 70%)",
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
              fontSize: "22px", fontWeight: 700, margin: "0 0 12px",
              letterSpacing: "-0.5px",
            }}>PT. Link Productive</h3>
            <p style={{
              fontSize: "15px", color: "rgba(255,255,255,0.45)",
              lineHeight: 1.8, maxWidth: "500px", margin: "0 auto",
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
    </div>
  );
}
