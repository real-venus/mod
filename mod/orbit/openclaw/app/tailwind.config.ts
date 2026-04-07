import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Monaco', '"Fira Code"', 'monospace'],
      },
      colors: {
        claw: {
          red: '#ef4444',
          orange: '#f97316',
          green: '#10b981',
          blue: '#3b82f6',
          purple: '#8b5cf6',
          dark: '#0a0a0a',
        },
      },
    },
  },
  plugins: [],
}
export default config
