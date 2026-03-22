import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
      },
      colors: {
        crt: {
          green: "#33ff33",
          amber: "#ffb000",
          blue: "#00aaff",
          red: "#ff3333",
          dark: "#0a0a0a",
          darker: "#050505",
          gray: "#1a1a1a",
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        scanline: "scanline 8s linear infinite",
        flicker: "flicker 0.15s infinite",
      },
      keyframes: {
        blink: {
          "50%": { opacity: "0" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.98" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
