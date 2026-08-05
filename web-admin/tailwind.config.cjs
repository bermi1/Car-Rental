const sharedPreset = require('../packages/shared/src/tailwind-preset.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [sharedPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../packages/shared/src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
