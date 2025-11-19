import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config, { isServer, dev }) => {
    if (isServer && dev) {
      config.devtool = false;
    }
    return config;
  },
  turbopack: {},
};

export default nextConfig;
