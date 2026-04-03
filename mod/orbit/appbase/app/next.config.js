/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/appbase',
  assetPrefix: '/appbase',
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { fs: false, net: false, tls: false };
    }
    return config;
  },
};
module.exports = nextConfig;
