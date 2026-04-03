import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        btgreen: "var(--btgreen)",
        btdark: "var(--btdark)",
        btcard: "var(--btcard)",
        btborder: "var(--btborder)",
        btmuted: "var(--btmuted)",
        btred: "var(--btred)",
        btblue: "var(--btblue)",
        btyellow: "var(--btyellow)",
        bttext: "var(--bttext)",
        btbg: "var(--btbg)",
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
      },
      boxShadow: {
        pixel: "4px 4px 0px var(--btborder)",
        "pixel-sm": "2px 2px 0px var(--btborder)",
        "pixel-green": "4px 4px 0px var(--btgreen)",
      },
    },
  },
  plugins: [],
};

export default config;
