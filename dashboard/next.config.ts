import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => {
    const baseUrl = process.env.OPENJCK_API_URL || "http://localhost:7070";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${baseUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
