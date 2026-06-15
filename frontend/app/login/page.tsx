"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Username dan password tidak boleh kosong.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      sessionStorage.setItem("autoclip_user", username);
      router.push("/dashboard");
    }, 900);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)",
        width: "700px", height: "700px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 65%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <button onClick={() => router.push("/")} style={{
        position: "fixed", top: "24px", left: "24px", zIndex: 10,
        display: "flex", alignItems: "center", gap: "6px",
        padding: "8px 14px", borderRadius: "8px",
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.6)", fontSize: "13px", cursor: "pointer", transition: "color 0.2s",
      }}
        onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
      >← Kembali</button>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 1 }}>
        <div className="animate-fade-up" style={{
          width: "100%", maxWidth: "420px", zIndex: 1,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px", padding: "40px 36px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "28px" }}>
            <Image src="/logo.png" alt="Auto Clip" width={160} height={80} priority style={{ objectFit: "contain" }} />
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)", marginBottom: "7px" }}>Username</label>
              <input id="username" type="text" placeholder="Masukkan username"
                value={username} onChange={e => setUsername(e.target.value)}
                disabled={loading} autoComplete="username"
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: "11px",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.2s", opacity: loading ? 0.6 : 1,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)", marginBottom: "7px" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input id="password" type={showPass ? "text" : "password"} placeholder="Masukkan password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  disabled={loading} autoComplete="current-password"
                  style={{
                    width: "100%", padding: "11px 44px 11px 14px", borderRadius: "11px",
                    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s", opacity: loading ? 0.6 : 1,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: "16px", padding: "4px",
                }}>{showPass ? "🙈" : "👁️"}</button>
              </div>
            </div>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: "13px" }}>
                {error}
              </div>
            )}

            <button id="login-btn" type="submit" disabled={loading} style={{
              width: "100%", padding: "13px", borderRadius: "50px",
              fontSize: "15px", fontWeight: 700, color: "#000", border: "none",
              cursor: loading ? "not-allowed" : "pointer", background: "#fff",
              opacity: loading ? 0.7 : 1, transition: "opacity 0.2s, background 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px",
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#e5e5e5"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
            >
              {loading ? (
                <>
                  <svg style={{ width: "16px", height: "16px", animation: "spin-slow 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#000" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M4 12a8 8 0 018-8" stroke="#000" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Masuk…
                </>
              ) : "Masuk ke Dashboard →"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "20px", lineHeight: 1.6 }}>
            Aplikasi ini berjalan sepenuhnya secara lokal.<br />
            Gunakan username dan password apa pun untuk masuk.
          </p>
        </div>
      </div>
    </div>
  );
}
