/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        blueprint: {
          DEFAULT: '#0D2438',
          soft: '#123049',
          line: '#1D425F',
        },
        cyanline: {
          DEFAULT: '#BFE3F0',
          dim: '#7FA9BC',
        },
        brass: {
          DEFAULT: '#D9A94E',
          bright: '#EBC373',
          dim: '#8A6A2E',
        },
        signal: {
          go: '#4FBE87',
          hold: '#E0A94A',
          stop: '#DB6558',
        },
      },
      fontFamily: {
        display: ['"Space Mono"', 'ui-monospace', 'monospace'],
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        widest2: '0.2em',
      },
      boxShadow: {
        blueprint: '0 0 0 1px rgba(191,227,240,0.15), 0 10px 28px -10px rgba(0,0,0,0.7)',
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(191,227,240,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(191,227,240,0.06) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: '24px 24px',
      },
    },
  },
  plugins: [],
}
