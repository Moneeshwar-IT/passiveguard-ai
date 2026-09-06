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
        card: '0 2px 8px rgba(15, 23, 42, 0.06)',
        cardHover: '0 4px 14px rgba(15, 23, 42, 0.09)',
      },
      colors: {
        enterprise: {
          bg: '#F4F7FB',
          sidebar: '#FFFFFF',
          card: '#FFFFFF',
          cardHover: '#F8FAFC',
          border: '#E2E8F0',
          borderHover: '#CBD5E1',
          primary: '#2563EB',
          primaryHover: '#1D4ED8',
          indigo: '#4F46E5',
          purple: '#7C3AED',
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626',
          critical: '#B91C1C',
          textPrimary: '#0F172A',
          textSecondary: '#475569',
          textMuted: '#64748B',
          textTechnical: '#334155',
        }
      }
    },
  },
  plugins: [],
}
