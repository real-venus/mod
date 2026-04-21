const fs = require('fs')
const path = require('path')

// Read API URL from config.json urls map (mod protocol)
let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8840'
try {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf-8'))
  if (config.urls?.api) apiUrl = config.urls.api
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
