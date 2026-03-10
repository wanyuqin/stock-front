/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 终端主色系
        terminal: {
          bg:       '#0a0e14',   // 最深背景
          surface:  '#0d1117',   // 卡片/面板背景
          panel:    '#131920',   // 侧边栏
          border:   '#1e2d3d',   // 边框
          muted:    '#1c2a38',   // 悬停/次要背景
        },
        // 强调色
        accent: {
          green:  '#00d97e',     // 涨
          red:    '#ff4d6a',     // 跌
          amber:  '#f5a623',     // 警告/高亮
          blue:   '#3b82f6',     // 链接/选中
          cyan:   '#22d3ee',     // 次要强调
        },
        // 文字层级
        ink: {
          primary:   '#e8edf3',
          secondary: '#7a8fa6',
          muted:     '#3d5166',
        },
      },
      fontFamily: {
        // 数字/代码专用等宽字体（数据对齐）
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        // 标题/导航用无衬线字体
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        // 数据展示数字
        data: ['"Roboto Mono"', 'monospace'],
      },
      animation: {
        'fade-in':     'fadeIn 0.2s ease-out',
        'slide-in':    'slideIn 0.25s ease-out',
        'pulse-green': 'pulseGreen 1.5s ease-in-out infinite',
        'blink':       'blink 1s step-end infinite',
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
        pulseGreen: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
      },
      boxShadow: {
        'panel': '0 0 0 1px #1e2d3d, 0 4px 24px rgba(0,0,0,0.4)',
        'glow-green': '0 0 12px rgba(0,217,126,0.25)',
        'glow-red':   '0 0 12px rgba(255,77,106,0.25)',
      },
    },
  },
  plugins: [],
}
