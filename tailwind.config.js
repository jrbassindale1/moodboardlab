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
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // font-display = Space Grotesk for site headings and display typography.
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        // font-wordmark = Anton for the Moodboard Lab logo only.
        wordmark: ['Anton', 'Arial Narrow', 'sans-serif'],
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
