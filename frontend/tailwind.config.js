/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        soc: {
          bg: '#0f172a',
          card: '#1e293b',
          sidebar: '#0b1329',
          border: '#334155',
          accent: '#38bdf8',
          danger: '#ef4444',
          warning: '#f59e0b',
          success: '#10b981',
        }
      }
    },
  },
  plugins: [],
}
