// Centralized API base URL — ganti dari env variable
// Development: http://localhost:8000
// Production: https://your-backend.up.railway.app
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
