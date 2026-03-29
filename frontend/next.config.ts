import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.BACKEND_URL ?? "http://localhost:8000",
  },
};

export default nextConfig;
