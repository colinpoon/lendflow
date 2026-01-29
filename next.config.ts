import type { Configuration } from 'webpack';

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (
    config: Configuration,
    { isServer }: { isServer: boolean }
  ) => {
    if (!isServer) {
      const alias = config.resolve?.alias as Record<string, string | false> | undefined;
      if (alias) {
        alias['canvas'] = false;
      }
    }
    return config;
  },
};

module.exports = nextConfig;
