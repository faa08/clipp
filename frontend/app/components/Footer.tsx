"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

const SOCIAL_LINKS = [
  {
    name: "Instagram",
    url: "https://www.instagram.com/cuancreator.academy?igsh=MTMxaDk4a2g3MzVvNA==",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    )
  },
  {
    name: "YouTube",
    url: "https://youtube.com/@link.productive?si=IuOpj5GvvWH3Cle4",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
      </svg>
    )
  },
  {
    name: "TikTok",
    url: "https://www.tiktok.com/@linkproductive",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
      </svg>
    )
  },
  {
    name: "Web",
    url: "https://www.linkproductive.com/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
      </svg>
    )
  }
];

export default function Footer() {
  const router = useRouter();

  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        background: "#09090b",
        padding: "40px 32px 32px 32px",
        color: "#fff",
        fontFamily: "var(--font-sans), -apple-system, sans-serif",
        position: "relative",
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
        }}
      >
        {/* Top Section */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "24px",
          }}
        >
          {/* Logo, Description & Socials */}
          <div style={{ minWidth: "240px", maxWidth: "320px" }}>
            <div
              onClick={() => router.push("/")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                marginBottom: "12px",
              }}
            >
              <Image
                src="/logo.png"
                alt="Productive Clip Logo"
                width={36}
                height={36}
                style={{ borderRadius: "8px", objectFit: "contain" }}
              />
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #fff 0%, #c084fc 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.3px",
                }}
              >
                ProductiveClip
              </span>
              <span style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "#c084fc",
                background: "rgba(168, 85, 247, 0.12)",
                border: "1px solid rgba(168, 85, 247, 0.25)",
                padding: "2px 6px",
                borderRadius: "6px",
                marginLeft: "4px",
              }}>
                v0.1
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.45)", lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Ubah video YouTube panjang jadi klip pendek siap pakai secara otomatis dan 100% lokal di perangkat Anda.
            </p>

            {/* Social Links */}
            <div style={{ display: "flex", gap: "10px" }}>
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={social.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.5)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(168,85,247,0.12)";
                    e.currentTarget.style.borderColor = "rgba(168,85,247,0.3)";
                    e.currentTarget.style.color = "#c084fc";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div style={{ display: "flex", gap: "40px", flexWrap: "wrap", marginTop: "8px" }}>
            {/* Navigation Column */}
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#fff", margin: "0 0 12px 0", letterSpacing: "0.5px" }}>
                Navigasi
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { label: "Beranda", path: "/" },
                  { label: "Tentang Kami", path: "/tentang" },
                  { label: "Dashboard", path: "/dashboard" },
                ].map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => router.push(link.path)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "rgba(255, 255, 255, 0.55)",
                        fontSize: "13px",
                        cursor: "pointer",
                        transition: "color 0.2s ease",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#c084fc")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.55)")}
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Features Column */}
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#fff", margin: "0 0 12px 0", letterSpacing: "0.5px" }}>
                Fitur Utama
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {["Generate Video Clip", "Generate Ide Caption", "AI Subtitle Generator"].map((feat) => (
                  <li key={feat}>
                    <span style={{ color: "rgba(255, 255, 255, 0.45)", fontSize: "13px" }}>
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.06)" }} />

        {/* Bottom Section: Copyright & Creator */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.35)" }}>
            © {new Date().getFullYear()} ProductiveClip · Powered by MoviePy & yt-dlp.
          </span>
          <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.35)", display: "flex", alignItems: "center", gap: "6px" }}>
            Created by <span style={{ color: "#fff", fontWeight: 600 }}>PT. Link Productive</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
