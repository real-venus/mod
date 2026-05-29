import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#06070a",
        panel: "#0d0f14",
        panel2: "#11151b",
        border: "#1c2230",
        ink: "#e6edf3",
        muted: "#8b949e",
        accent: "#50fa7b",
        accent2: "#5ec5ff",
        warn: "#f1c40f",
        loss: "#ff6b6b",
        win: "#50fa7b",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
