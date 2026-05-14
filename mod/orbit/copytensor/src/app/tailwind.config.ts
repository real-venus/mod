import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        surface: "#141414",
        border: "#262626",
        muted: "#737373",
        accent: "#22d3ee",
        positive: "#22c55e",
        negative: "#ef4444",
      },
    },
  },
  plugins: [],
};

export default config;
