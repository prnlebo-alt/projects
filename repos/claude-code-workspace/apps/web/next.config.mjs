/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The monorepo's packages use NodeNext-style ".js" import specifiers that
  // resolve to ".ts" source files (correct for tsc/tsx/node's ESM loader).
  // Webpack doesn't apply that mapping by default, so teach it to.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"]
    };
    return config;
  }
};

export default nextConfig;
