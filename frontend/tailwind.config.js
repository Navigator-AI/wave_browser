/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'wave-bg': '#1e1e2e',
        'wave-panel': '#252536',
        'wave-border': '#3a3a4d',
        'wave-accent': '#7aa2f7',
        'wave-text': '#c0c0d0',
        'wave-signal-0': '#f38ba8',
        'wave-signal-1': '#a6e3a1',
        'wave-signal-x': '#f9e2af',
        'wave-signal-z': '#89b4fa',
      }
    },
  },
  plugins: [],
}
