import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        digital: ['var(--font-digital)', 'monospace'],
        orbitron: ['var(--font-orbitron)', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "glass-gradient": "linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(103, 232, 249, 0.05))",
      },
      backdropBlur: {
        'glass': '20px',
        'glass-sm': '12px',
        'glass-lg': '30px',
      },
      animation: {
        'spin-reverse': 'spin-reverse 1s linear infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
        'glass-glow': 'glass-glow 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'spin-reverse': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'glass-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(167, 139, 250, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(167, 139, 250, 0.2), 0 0 60px rgba(103, 232, 249, 0.1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;