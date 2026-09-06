/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 20px rgba(5, 8, 22, 0.4)',
        cardHover: '0 6px 24px rgba(34, 211, 238, 0.08)',
        cyanGlow: '0 0 15px rgba(34, 211, 238, 0.2)',
      },
      colors: {
        midnight: {
          bg: '#050816',
          bgSecondary: '#080D1C',
          card: '#0D1426',
          cardHover: '#111B32',
          border: '#1C2A45',
          borderHover: '#2B4268',
          cyan: '#22D3EE',
          indigo: '#6366F1',
          purple: '#A855F7',
          success: '#22C55E',
          warning: '#F59E0B',
          danger: '#EF4444',
          critical: '#DC2626',
          textPrimary: '#F8FAFC',
          textSecondary: '#94A3B8',
          textMuted: '#64748B',
          textTechnical: '#CBD5E1',
        }
      }
    },
  },
  plugins: [],
}
