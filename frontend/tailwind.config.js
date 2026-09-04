/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        soc: {
          bg: '#070B14',
          surface: '#0B1120',
          card: '#111827',
          cardHover: '#172033',
          border: '#1E293B',
          cyan: '#06B6D4',
          blue: '#38BDF8',
          teal: '#14B8A6',
          danger: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
        }
      }
    },
  },
  plugins: [],
}
