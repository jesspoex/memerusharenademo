// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dd.dexscreener.com' },
      { protocol: 'https', hostname: '**.dexscreener.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
};

export default config;
