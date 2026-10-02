/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cwr: {
          green: "#2f7a4f",
          soil: "#8a5a3b",
          sky: "#3b7a9e",
        },
      },
    },
  },
  plugins: [],
};
