/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pixel: {
          black: "#000000",
          bg: "#0a0a0a",
          panel: "#1a1a1a",
          border: "#333333",
          green: "#ffffff",
          "green-dim": "#cccccc",
          lime: "#eeeeee",
          cyan: "#ffffff",
          "cyan-dim": "#cccccc",
          magenta: "#ffffff",
          purple: "#cccccc",
          red: "#000000",
          "red-dim": "#222222",
          amber: "#ffffff",
          "amber-dim": "#cccccc",
          orange: "#ffffff",
          blue: "#cccccc",
          "blue-bright": "#ffffff",
          white: "#ffffff",
          gray: "#666666",
          "gray-light": "#999999",
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
          "0%, 100%": { textShadow: "2px 2px 0 #000000" },
          "50%": { textShadow: "3px 3px 0 #333333" },
        },
        "pixel-pulse": {
          "0%, 100%": { boxShadow: "inset 3px 3px 0 #333333, inset -3px -3px 0 #000000" },
          "50%": { boxShadow: "inset 3px 3px 0 #666666, inset -3px -3px 0 #000000" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "mario-jump": {
          "0%, 100%": { transform: "translateY(0) scaleY(1)" },
          "40%": { transform: "translateY(-8px) scaleY(1.1)" },
          "60%": { transform: "translateY(-8px) scaleY(0.9)" },
        },
        "coin-spin": {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(360deg)" },
        },
      },
      animation: {
        scanline: "scanline 8s linear infinite",
        blink: "blink 1s step-end infinite",
        glow: "glow 2s ease-in-out infinite",
        "pixel-pulse": "pixel-pulse 3s ease-in-out infinite",
        float: "float 2s ease-in-out infinite",
        "mario-jump": "mario-jump 0.6s ease-in-out infinite",
        "coin-spin": "coin-spin 1s linear infinite",
      },
    },
  },
  plugins: [],
};
