import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: "#111111",
        card: "#1a1a1a",
        border: "#2a2a2a",
        accent: "#00ff88",
        "accent-dim": "#00cc6a",
        danger: "#ff4444",
        warn: "#ffaa00",
      },
    },
  },
  plugins: [],
};

export default config;
