/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg:       '#0a0e14',
          surface:  '#0d1117',
          panel:    '#131920',
          border:   '#1e2d3d',
          muted:    '#1c2a38',
        },
        accent: {
          green:  '#00d97e',
          red:    '#ff4d6a',
          amber:  '#f5a623',
          blue:   '#3b82f6',
          cyan:   '#22d3ee',
        },
        ink: {
          primary:   '#e8edf3',
          secondary: '#7a8fa6',
          muted:     '#3d5166',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        data: ['"Roboto Mono"', 'monospace'],
      },
      animation: {
        'fade-in':       'fadeIn 0.2s ease-out',
        'slide-in':      'slideIn 0.25s ease-out',
        'slide-up':      'slideUp 0.2s ease-out',
        'pulse-green':   'pulseGreen 1.5s ease-in-out infinite',
        'blink':         'blink 1s step-end infinite',
        'stop-loss':     'stopLossGlow 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGreen: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        stopLossGlow: {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(255,77,106,0)',
            borderColor: 'rgba(239,68,68,0.45)',
          },
          '50%': {
            boxShadow: '0 0 0 3px rgba(255,77,106,0.12), 0 0 20px rgba(255,77,106,0.18)',
            borderColor: 'rgba(239,68,68,0.85)',
          },
        },
      },
      boxShadow: {
        'panel':        '0 0 0 1px #1e2d3d, 0 4px 24px rgba(0,0,0,0.4)',
        'glow-green':   '0 0 12px rgba(0,217,126,0.25)',
        'glow-red':     '0 0 12px rgba(255,77,106,0.25)',
        'glow-amber':   '0 0 12px rgba(245,158,35,0.20)',
      },
    },
  },
  plugins: [],
}
