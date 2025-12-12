/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{js,ts,jsx,tsx}',
    '!./node_modules/**/*',
    '!./dist/**/*',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'arch-black': '#1a1a1a',
        'arch-gray': '#f4f4f4',
        'arch-line': '#e5e5e5',
      },
    },
  },
  plugins: [],
};
