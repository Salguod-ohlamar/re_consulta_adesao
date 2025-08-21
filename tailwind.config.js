// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  // O 'content' diz ao Tailwind onde procurar as classes CSS
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
