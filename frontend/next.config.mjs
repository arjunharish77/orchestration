import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
const apiOrigin = (() => {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return '';
  }
})();
const devConnectSources = process.env.NODE_ENV === 'production'
  ? []
  : ['http://127.0.0.1:4000', 'http://localhost:4000', 'ws://127.0.0.1:3000', 'ws://localhost:3000'];
const connectSources = ["'self'", apiOrigin, ...devConnectSources].filter(Boolean);

const csp = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  `connect-src ${[...new Set(connectSources)].join(' ')}`,
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'"
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  turbopack: {
    root: path.resolve(__dirname, '..')
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
        ]
      }
    ];
  }
};

export default nextConfig;
