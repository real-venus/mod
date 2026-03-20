import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pixel: {
          black: "#0f0f0f",
          bg: "#1a1a2e",
          panel: "#16213e",
          border: "#0f3460",
          green: "#00ff41",
          "green-dim": "#00aa2a",
          lime: "#adff2f",
          cyan: "#00ffff",
          "cyan-dim": "#008b8b",
          magenta: "#ff00ff",
          purple: "#9b59b6",
          red: "#ff0040",
          "red-dim": "#aa0028",
          amber: "#ffd700",
          "amber-dim": "#b8960f",
          orange: "#ff6600",
          blue: "#4169ff",
          "blue-bright": "#00bfff",
          white: "#e0e0e0",
          gray: "#666680",
          "gray-light": "#9999aa",
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        glow: {
          "0%, 100%": { textShadow: "0 0 4px #00ff41, 0 0 8px #00ff4166" },
          "50%": { textShadow: "0 0 8px #00ff41, 0 0 16px #00ff4188" },
        },
        "pixel-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 1px #00ff4144, inset 0 0 20px #00ff4108" },
          "50%": { boxShadow: "0 0 0 1px #00ff4188, inset 0 0 30px #00ff4115" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
      },
      animation: {
        scanline: "scanline 8s linear infinite",
        blink: "blink 1s step-end infinite",
        glow: "glow 2s ease-in-out infinite",
        "pixel-pulse": "pixel-pulse 3s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
