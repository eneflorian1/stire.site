import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverSourceMaps: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = false;
    }
    return config;
  },
  turbopack: {},
};

export default nextConfig;
