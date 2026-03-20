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
        btgreen: "#00D18C",
        btdark: "#0A0A0F",
        btcard: "#12121A",
        btborder: "#1E1E2E",
        btmuted: "#6B7280",
        btred: "#EF4444",
        btblue: "#3B82F6",
        btyellow: "#F59E0B",
      },
    },
  },
  plugins: [],
};

export default config;
