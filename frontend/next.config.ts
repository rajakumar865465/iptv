import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/internal/:path*',
        destination: 'http://127.0.0.1:5000/api/internal/:path*',
      },
    ];
  },
};

export default nextConfig;
