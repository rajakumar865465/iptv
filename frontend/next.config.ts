import type { NextConfig } from "next";

// Backend URL: use env var in production, fallback to localhost for development.
// On EC2, set NEXT_PUBLIC_API_URL=http://35.154.128.217:5000 in the environment,
// or point to a domain name if you have one (e.g. https://api.yourdomain.com).
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

const nextConfig: NextConfig = {
  // Required for nginx to proxy correctly on EC2
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
  // Disable x-powered-by header
  poweredByHeader: false,
};

export default nextConfig;
