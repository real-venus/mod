/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/v1',
  assetPrefix: '/v1',
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { fs: false, net: false, tls: false };
    }
    return config;
  },
};
module.exports = nextConfig;
