import type { Configuration } from 'webpack';

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
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
