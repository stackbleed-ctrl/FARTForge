import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'toxic-green':  '#00ff88',
        'toxic-dim':    '#00cc6a',
        'magenta':      '#ff00ff',
        'magenta-dim':  '#cc00cc',
        'neon-purple':  '#8b00ff',
        'sulfur':       '#ffd700',
        'gas-blue':     '#00cfff',
        'void':         '#030308',
        'stink-brown':  '#8b4513',
      },
      fontFamily: {
        display: ['Orbitron', 'monospace'],
        mono:    ['Share Tech Mono', 'monospace'],
        body:    ['Rajdhani', 'sans-serif'],
      },
      animation: {
        'pulse-green': 'pulse-green 2s ease-in-out infinite',
        'float':       'float 3s ease-in-out infinite',
        'gas-drift':   'gas-drift 4s ease-out forwards',
        'marquee':     'marquee 30s linear infinite',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,255,136,0.3)' },
          '50%':       { boxShadow: '0 0 40px rgba(0,255,136,0.8), 0 0 80px rgba(0,255,136,0.3)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
        'gas-drift': {
          '0%':   { transform: 'translate(0,0) scale(1)',   opacity: '0.6' },
          '50%':  { transform: 'translate(20px,-30px) scale(1.2)', opacity: '0.8' },
          '100%': { transform: 'translate(-10px,-60px) scale(0.8)', opacity: '0' },
        },
        marquee: {
          '0%':   { transform: 'translateX(100vw)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      backgroundImage: {
        'grid-green': `
          linear-gradient(rgba(0,255,136,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,136,0.04) 1px, transparent 1px)
        `,
        'stink-gradient': 'linear-gradient(90deg, #00ff88 0%, #ffff00 40%, #ff8800 70%, #ff0044 100%)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      boxShadow: {
        'neon-green':   '0 0 20px rgba(0,255,136,0.5), 0 0 60px rgba(0,255,136,0.2)',
        'neon-magenta': '0 0 20px rgba(255,0,255,0.5), 0 0 60px rgba(255,0,255,0.2)',
        'neon-purple':  '0 0 20px rgba(139,0,255,0.5)',
        'neon-gold':    '0 0 20px rgba(255,215,0,0.5)',
      },
      dropShadow: {
        'green': '0 0 10px rgba(0,255,136,0.8)',
        'magenta': '0 0 10px rgba(255,0,255,0.8)',
      },
    },
  },
  plugins: [],
}

export default config
