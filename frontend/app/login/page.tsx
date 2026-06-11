"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/app/components/Footer";

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
    // Simulasi loading sebentar lalu masuk ke dashboard
    setTimeout(() => {
      // Simpan sesi sederhana di sessionStorage
      sessionStorage.setItem("autoclip_user", username);
      router.push("/dashboard");
    }, 900);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0f0f13",
      display: "flex", flexDirection: "column",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background orbs */}
      <div aria-hidden style={{
        position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)",
        width: "700px", height: "700px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 65%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Back to Home */}
      <button
        onClick={() => router.push("/")}
        style={{
          position: "fixed", top: "24px", left: "24px", zIndex: 10,
          display: "flex", alignItems: "center", gap: "6px",
          padding: "8px 14px", borderRadius: "8px",
          background: "rgba(42,42,56,0.5)", border: "1px solid #2a2a38",
          color: "#9ca3af", fontSize: "13px", cursor: "pointer",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f0f5")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
      >
        ← Kembali
      </button>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 1,
      }}>
        {/* Login Card */}
        <div className="animate-fade-up" style={{
        width: "100%", maxWidth: "420px", zIndex: 1,
        background: "#18181f", border: "1px solid #2a2a38",
        borderRadius: "24px", padding: "40px 36px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "28px" }}>
          <Image src="/logo.png" alt="Auto Clip" width={160} height={80} priority
            style={{ objectFit: "contain", filter: "drop-shadow(0 0 20px rgba(168,85,247,0.3))" }} />
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Username */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#d1d5db", marginBottom: "7px" }}>
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "11px",
                background: "#0f0f13", border: "1px solid #2a2a38",
                color: "#f0f0f5", fontSize: "14px", outline: "none",
                boxSizing: "border-box", transition: "border-color 0.2s",
                opacity: loading ? 0.6 : 1,
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#a855f7")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a38")}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#d1d5db", marginBottom: "7px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPass ? "text" : "password"}
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "11px 44px 11px 14px", borderRadius: "11px",
                  background: "#0f0f13", border: "1px solid #2a2a38",
                  color: "#f0f0f5", fontSize: "14px", outline: "none",
                  boxSizing: "border-box", transition: "border-color 0.2s",
                  opacity: loading ? 0.6 : 1,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#a855f7")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a38")}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "#6b7280", fontSize: "16px", padding: "4px",
                }}
              >{showPass ? "🙈" : "👁️"}</button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "10px",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              color: "#fca5a5", fontSize: "13px",
            }}>{error}</div>
          )}

          {/* Submit */}
          <button
            id="login-btn"
            type="submit"
            disabled={loading}
            className="animate-glow-pulse"
            style={{
              width: "100%", padding: "13px", borderRadius: "12px",
              fontSize: "15px", fontWeight: 700, color: "#fff",
              border: "none", cursor: loading ? "not-allowed" : "pointer",
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              opacity: loading ? 0.7 : 1,
              transition: "opacity 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              marginTop: "4px",
            }}
          >
            {loading ? (
              <>
                <svg style={{ width: "16px", height: "16px", animation: "spin-slow 1s linear infinite" }}
                  viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M4 12a8 8 0 018-8" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Masuk…
              </>
            ) : "Masuk ke Dashboard →"}
          </button>
        </form>

        {/* Hint */}
        <p style={{
          textAlign: "center", fontSize: "12px", color: "#4b5563", marginTop: "20px",
          lineHeight: 1.6,
        }}>
          Aplikasi ini berjalan sepenuhnya secara lokal.<br />
          Gunakan username dan password apa pun untuk masuk.
        </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
