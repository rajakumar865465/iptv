import type { NextConfig } from "next";

// Backend URL: use env var in production, fallback to localhost for development.
// On EC2, set NEXT_PUBLIC_API_URL=http://44.206.18.189 in the environment,
// or point to a domain name if you have one (e.g. https://api.yourdomain.com).
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

// The browser talks to the backend directly (API + WebSocket) when
// NEXT_PUBLIC_API_URL is set, so CSP connect-src must allow that origin.
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL || '';
const PUBLIC_API_WS = PUBLIC_API.replace(/^http/, 'ws');
const connectSrc = ["'self'", PUBLIC_API, PUBLIC_API_WS, 'ws:', 'wss:'].filter(Boolean).join(' ');

// The admin token lives in a JS-accessible cookie (required by the Edge
// middleware), so a CSP is the main XSS mitigation: it blocks external
// scripts and limits where injected code could exfiltrate data to.
// img-src stays open because channel logos are hosted on arbitrary domains.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc} https://api.razorpay.com https://lumberjack-metrics.razorpay.com`,
  "frame-src 'self' https://api.razorpay.com https://accounts.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  compress: false,
  // Silence "multiple lockfiles" warning — our root is the frontend dir
  outputFileTracingRoot: require('path').join(__dirname),
  // Required for nginx to proxy correctly on EC2
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/logos/:path*',
        destination: `${BACKEND_URL}/logos/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  // Disable x-powered-by header
  poweredByHeader: false,
};

export default nextConfig;
