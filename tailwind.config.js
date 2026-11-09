/**
 * tailwind.config.js - Tailwind v3 config for the Nexora FX frontend.
 *
 * The site used to load Tailwind from the Play CDN at runtime, which made
 * every first paint wait on an external script (blank page for 20-60s on a
 * slow connection). The CSS is now compiled once into
 * frontend/css/tailwind.css and served locally.
 *
 * Rebuild after changing any class in the HTML/JS:
 *   npx tailwindcss -i ./frontend/css/tailwind-input.css -o ./frontend/css/tailwind.css --minify
 * (content globs below cover every .html and .js file under frontend/.)
 */
module.exports = {
  content: ['./frontend/**/*.html', './frontend/**/*.js'],
  theme: {
    extend: {
      colors: {
        orange: { DEFAULT: '#FF6A00', 500: '#FF6A00', 600: '#FF7A00', 400: '#FF8C33' },
        dark: { DEFAULT: '#1E2329', 800: '#181A20', 900: '#0F1015' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] },
      borderRadius: { xl: '14px', '2xl': '16px', '3xl': '20px' },
    },
  },
  plugins: [],
};
