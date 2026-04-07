/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:50088',
  },
}
