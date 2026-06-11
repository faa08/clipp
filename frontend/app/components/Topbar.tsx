"use client";

import Image from "next/image";

export default function Topbar() {
  return (
    <header
      className="topbar"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: "68px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        background: "rgba(15, 15, 19, 0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(42, 42, 56, 0.8)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
      }}
    >
      {/* ── Left: Logo + App Name ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <Image
          src="/logo.png"
          alt="Auto Clip Logo"
          width={44}
          height={44}
          priority
          style={{ borderRadius: "10px", objectFit: "contain" }}
        />
        <div>
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
            Auto Clip
          </span>
          <span
            style={{
              display: "block",
              fontSize: "10px",
              color: "#6b7280",
              fontWeight: 500,
              marginTop: "-2px",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            Local MVP
          </span>
        </div>
      </div>

      {/* ── Center: Nav Links ── */}
      <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {[
          { label: "Dashboard", active: true },
          { label: "History", active: false },
          { label: "Settings", active: false },
        ].map((item) => (
          <button
            key={item.label}
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: item.active ? 600 : 400,
              color: item.active ? "#e2d9f3" : "#6b7280",
              background: item.active
                ? "rgba(168, 85, 247, 0.12)"
                : "transparent",
              border: item.active
                ? "1px solid rgba(168, 85, 247, 0.25)"
                : "1px solid transparent",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (!item.active) {
                (e.currentTarget as HTMLButtonElement).style.color = "#c4b5fd";
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(168,85,247,0.06)";
              }
            }}
            onMouseLeave={(e) => {
              if (!item.active) {
                (e.currentTarget as HTMLButtonElement).style.color = "#6b7280";
                (e.currentTarget as HTMLButtonElement).style.background =
                  "transparent";
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* ── Right: Status Badge ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>


        {/* Avatar placeholder */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 700,
            color: "#fff",
            border: "2px solid rgba(168,85,247,0.3)",
            cursor: "pointer",
          }}
        >
          A
        </div>
      </div>
    </header>
  );
}
