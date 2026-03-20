import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      colors: {
        retro: {
          bg: '#0a0a0a',
          black: '#000000',
          green: '#00ff41',
          cyan: '#00ffff',
          magenta: '#ff00ff',
          yellow: '#ffff00',
          red: '#ff0055',
          blue: '#0055ff',
          purple: '#aa00ff',
        },
      },
      boxShadow: {
        'pixel': '4px 4px 0 #000',
        'pixel-sm': '2px 2px 0 #000',
        'pixel-green': '0 0 10px rgba(0, 255, 65, 0.3)',
        'pixel-cyan': '0 0 10px rgba(0, 255, 255, 0.3)',
      },
      animation: {
        'glitch': 'glitch 3s infinite',
        'blink': 'blink 1s step-end infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
