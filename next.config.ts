import type { Configuration } from 'webpack';

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // Mark native modules as external so Turbopack/webpack doesn't try to bundle them
  serverExternalPackages: ['canvas', 'pdf-to-img'],
  webpack: (
    config: Configuration,
    { isServer }: { isServer: boolean }
  ) => {
    if (!isServer) {
      config.resolve!.alias!['canvas'] = false as unknown as
        | false
        | string;
    }
    return config;
  },
};

module.exports = nextConfig;
