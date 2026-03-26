import type { Configuration } from 'webpack';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  devIndicators: false,
  // Mark native modules as external so Turbopack/webpack doesn't try to bundle them
  serverExternalPackages: ['canvas', 'pdf-to-img'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js requires 'unsafe-inline' for hydration scripts; 'unsafe-eval' for dev HMR only
              `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''} https://*.clerk.accounts.dev`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://img.clerk.com",
              "font-src 'self'",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} https://api.anthropic.com https://*.clerk.accounts.dev`,
              "frame-ancestors 'none'",
              "worker-src 'self' blob:",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
  webpack: (
    config: Configuration,
    { isServer }: { isServer: boolean }
  ) => {
    if (!isServer) {
      // Disable canvas on client-side to avoid bundling issues
      const alias = config.resolve?.alias as Record<string, string | false> | undefined;
      if (alias) {
        alias['canvas'] = false;
      }
    }
    return config;
  },
};

module.exports = nextConfig;
