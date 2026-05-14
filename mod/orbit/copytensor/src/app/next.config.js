/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:50150";
    return [{ source: "/ct/:path*", destination: `${api}/:path*` }];
  },
};

module.exports = nextConfig;
