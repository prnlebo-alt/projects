import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disable static optimization for all pages — this is a dynamic SaaS app
  // with auth, so static prerendering doesn't apply
  output: undefined,
  experimental: {},
};

export default nextConfig;
