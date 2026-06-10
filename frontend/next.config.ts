import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow <video> to load clips served by the FastAPI backend
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
