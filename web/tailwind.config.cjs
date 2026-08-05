const preset = require('../packages/shared/src/tailwind-preset.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../packages/shared/src/**/*.{ts,tsx}'],
};
