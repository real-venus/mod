/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:50150";

const nextConfig = {
  env: { NEXT_PUBLIC_API_URL: apiUrl },
  async rewrites() {
    return [
      { source: "/api/store/:path*", destination: `${apiUrl}/:path*` },
    ];
  },
};

export default nextConfig;
