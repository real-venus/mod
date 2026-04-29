const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:50091";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/polymarket";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  async rewrites() {
    return [
      {
        source: "/api/pm/:path*",
        destination: `${apiUrl}/:path*`,
        ...(basePath ? { basePath: false } : {}),
      },
    ];
  },
};
export default nextConfig;
