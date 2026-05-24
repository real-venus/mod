const apiUrl = process.env.POLYMARKET_API_URL || "http://localhost:50091";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/polymarket";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevent double-mount in dev that causes API race conditions
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_API_URL: "/api/polymarket",
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STRAT_HMAC_SECRET: process.env.NEXT_PUBLIC_STRAT_HMAC_SECRET || "",
  },
  async rewrites() {
    return [
      {
        source: "/api/polymarket/:path*",
        destination: `${apiUrl}/:path*`,
        basePath: false,
      },
      // L2 CLOB passthrough (order, balance-allowance, orders, cancel).
      // Mirrors the Caddy @l2 block so the app works in dev modes where
      // the docker-generated Caddyfile isn't in front of Next.js.
      {
        source: "/api/polymarket-l2/:path*",
        destination: "https://clob.polymarket.com/:path*",
        basePath: false,
      },
    ];
  },
};
export default nextConfig;
