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
        ibm: {
          black: "#0a0a0a",
          dark: "#111111",
          panel: "#161616",
          border: "#2a2a2a",
          green: "#42be65",
          "green-bright": "#6fdc8c",
          "green-dim": "#198038",
          amber: "#f1c21b",
          "amber-dim": "#8a6d3b",
          red: "#fa4d56",
          "red-dim": "#750e13",
          blue: "#4589ff",
          cyan: "#08bdba",
          gray: "#525252",
          "gray-light": "#8d8d8d",
          white: "#f4f4f4",
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', "monospace"],
        sans: ['"IBM Plex Sans"', "sans-serif"],
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
          "0%, 100%": { boxShadow: "0 0 5px #42be65, 0 0 10px #42be6533" },
          "50%": { boxShadow: "0 0 10px #42be65, 0 0 20px #42be6544" },
        },
      },
      animation: {
        scanline: "scanline 8s linear infinite",
        blink: "blink 1s step-end infinite",
        glow: "glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
