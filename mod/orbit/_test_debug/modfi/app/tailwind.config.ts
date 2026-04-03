import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        modfi: {
          bg: '#0a0b0f',
          card: '#12131a',
          border: '#1e2030',
          hover: '#1a1b2e',
          purple: '#6366f1',
          violet: '#7c3aed',
          green: '#22c55e',
          red: '#ef4444',
          yellow: '#eab308',
          muted: '#6b7280',
          text: '#e5e7eb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
