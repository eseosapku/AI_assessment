/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'apple-white': '#FFFFFF',
        'apple-black': '#1D1D1F',
        'apple-blue': '#007AFF',
        'apple-gray': '#F5F5F7',
        'apple-dark-gray': '#86868B',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'sans-serif'],
      },
      borderRadius: {
        'apple': '20px',
      },
      boxShadow: {
        'apple': '0 2px 16px rgba(0, 0, 0, 0.08)',
        'apple-lg': '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
      backdropBlur: {
        'apple': '40px',
      },
    },
  },
  plugins: [],
}
