// RC04 UI tokens: dark neutral surfaces + one lime accent (mapped onto the existing
// `indigo`/`yellow` utility names so no component logic changes). System fonts only.
module.exports = {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          400: '#9AA4B2', 500: '#7A8596', 600: '#3A4350', 700: '#262D37',
          800: '#1A1F27', 850: '#151A21', 900: '#11141A', 950: '#0B0D10',
        },
        indigo: {
          50: '#F7FEE0', 100: '#EEFCC0', 200: '#E1F98F', 300: '#D4F76B', 400: '#CFF550',
          500: '#C8F135', 600: '#B2DA25', 700: '#8FB31C', 800: '#5F7A12', 900: '#3A4A0C', 950: '#1C2406',
        },
        yellow: { 300: '#D4F76B', 400: '#C8F135', 500: '#B2DA25' },
      },
    },
  },
  plugins: [],
};
