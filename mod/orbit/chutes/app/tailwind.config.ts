import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        crt: {
          darker: "#050505",
          dark: "#0a0a0a",
          green: "#33ff33",
          amber: "#ffb000",
          red: "#ff3333",
          blue: "#00aaff",
          cyan: "#00ffcc",
          purple: "#bf5fff",
          magenta: "#ff00ff",
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
