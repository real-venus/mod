import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        proton: {
          purple: "#6d4aff",
          dark: "#1b1340",
          deeper: "#0f0a2a",
          card: "#1e1650",
          border: "#2d2066",
          text: "#c4b5fd",
          muted: "#7c6fb0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
