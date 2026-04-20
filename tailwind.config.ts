import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        arm: ['"Noto Sans Armenian"', '"Mardoto"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif Armenian"', 'Georgia', 'serif']
      },
      colors: {
        heruni: {
          ink: '#1a1a2e',
          parchment: '#f7f2e7',
          sun: '#c6872a',
          amber: '#d9a24a',
          bronze: '#7a4a1f',
          moss: '#4a6b4a'
        }
      }
    }
  },
  plugins: []
};

export default config;
