/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        modblue: "#1E3A5F",
        modcyan: "#0EA5E9",
        paper: "#FAFAF7",
        ink: "#111111",
      },
      fontFamily: {
        serif: ["Charter", "Georgia", "ui-serif", "serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
