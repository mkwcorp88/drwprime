/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#d4af37',
        'primary-light': '#f4d03f',
        dark: '#0a0a0a',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
      },
      fontFamily: {
        playfair: ['Gilroy', 'Avenir Next', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
        inter: ['Gilroy', 'Avenir Next', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
        jakarta: ['Gilroy', 'Avenir Next', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
