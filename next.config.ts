import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@speego/shared"],
  async rewrites() {
    const configured = process.env.API_URL?.trim();
    if (process.env.VERCEL === "1" && !configured) {
      throw new Error("Thiếu API_URL: đặt origin HTTPS của backend trong env Vercel FE.");
    }
    const backend = new URL(configured || "http://127.0.0.1:4000");
    if (
      !["http:", "https:"].includes(backend.protocol) ||
      (process.env.VERCEL === "1" && backend.protocol !== "https:") ||
      backend.username || backend.password ||
      backend.pathname !== "/" || backend.search || backend.hash
    ) {
      throw new Error("API_URL phải là origin của backend, không chứa /api, đường dẫn hay thông tin đăng nhập; Vercel yêu cầu HTTPS.");
    }
    return [{ source: "/api/:path*", destination: `${backend.origin}/api/:path*` }];
  },
  turbopack: {
    root: process.env.TURBOPACK_ROOT,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
