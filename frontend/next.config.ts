import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/internal/:path*',
        destination: 'http://localhost:5000/api/internal/:path*',
      },
    ];
  },
};

export default nextConfig;
