/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Button variants are composed dynamically (`btn-${variant}`), so they must be safelisted.
  safelist: ['btn-primary', 'btn-brand', 'btn-secondary', 'btn-ghost', 'btn-danger', 'btn-sm'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Inter', 'sans-serif'],
      },
      colors: {
        ink: { 950: '#070d1a', 900: '#0b1324', 800: '#111c33', 700: '#1a2742', 600: '#26365a' },
        court: { 50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75' },
        ball: { 300: '#e4ff6b', 400: '#d4f53c', 500: '#bfe022' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.05)',
        pop: '0 10px 30px rgba(15,23,42,.18)',
      },
    },
  },
  plugins: [],
}
