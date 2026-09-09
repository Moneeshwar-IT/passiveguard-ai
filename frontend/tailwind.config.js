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
        card: '0 1px 3px rgba(15, 23, 42, 0.06)',
        cardHover: '0 4px 12px rgba(15, 23, 42, 0.08)',
        subtle: '0 1px 2px rgba(0, 0, 0, 0.04)',
      },
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          DEFAULT: '#2563EB',
        },
        success: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#BBF7D0',
          600: '#16A34A',
          700: '#15803D',
          DEFAULT: '#16A34A',
        },
        warning: {
          50: '#FEF3C7',
          100: '#FDE68A',
          600: '#D97706',
          700: '#B45309',
          DEFAULT: '#D97706',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FECACA',
          200: '#FCA5A5',
          600: '#DC2626',
          700: '#B91C1C',
          DEFAULT: '#DC2626',
        },
        critical: {
          DEFAULT: '#B91C1C',
          bg: '#FEF2F2',
          border: '#FCA5A5',
        },
        ai: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          600: '#7C3AED',
          700: '#6D28D9',
          DEFAULT: '#7C3AED',
        },
        indigoAcc: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          600: '#4F46E5',
          700: '#4338CA',
          DEFAULT: '#4F46E5',
        },
        soc: {
          bg: '#F4F7FB',
          surface: '#FFFFFF',
          surfaceSubtle: '#F8FAFC',
          border: '#E2E8F0',
          borderHover: '#CBD5E1',
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
