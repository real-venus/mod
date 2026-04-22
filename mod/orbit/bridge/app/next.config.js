const fs = require('fs')
const path = require('path')

// Internal backend URL for Next.js rewrites (dev proxy to FastAPI)
let apiUrl = 'http://localhost:8840'
try {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'))
  if (config.port) apiUrl = `http://localhost:${config.port}`
} catch {}

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/bridge',
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_API_URL: '/bridge/api',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
}

module.exports = nextConfig
