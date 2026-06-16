/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        telegram: {
          bg: '#0e1621',
          sidebar: '#17212b',
          hover: '#202b36',
          primary: '#5288c1',
          text: '#f5f5f5',
          muted: '#7f91a4',
          messageIn: '#182533',
          messageOut: '#2b5278'
        }
      }
    },
  },
  plugins: [],
}
