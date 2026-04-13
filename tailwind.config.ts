import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono:    ['Share Tech Mono', 'monospace'],
        display: ['Orbitron', 'monospace'],
        body:    ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        'toxic-green': '#00ff88',
        'acid-yellow': '#d4ff00',
        'void-purple': '#8b00ff',
        'warning-red': '#ff2244',
        'fart-orange': '#ff6600',
      },
      animation: {
        'ticker-scroll': 'ticker-scroll 60s linear infinite',
        'pulse-ring':    'pulse-ring 1s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'screen-shake':  'screen-shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) both',
      },
    },
  },
  plugins: [],
}

export default config
