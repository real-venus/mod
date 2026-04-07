import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        uni: {
          pink: '#FC72FF',
          purple: '#7B61FF',
          dark: '#0d0e14',
          card: '#131a2a',
          border: '#1e293b',
        },
      },
    },
  },
  plugins: [],
}
export default config
