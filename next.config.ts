import type { Configuration } from 'webpack';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  devIndicators: false,
  // Mark native modules as external so Turbopack/webpack doesn't try to bundle them
  serverExternalPackages: ['canvas', 'pdf-to-img'],
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
