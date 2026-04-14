/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#4f6ef7',
          600: '#3b5ae8',
          700: '#2d47cc',
        },
      },
    },
  },
  plugins: [],
}
