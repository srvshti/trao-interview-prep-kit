/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#102a43',
        mist: '#f4f7fb',
        mint: '#138a72',
        coral: '#dc5f47'
      }
    }
  },
  plugins: []
};

export default config;
