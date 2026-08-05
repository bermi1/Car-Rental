/** Shared Tailwind preset — extend this from web-admin and web-staff tailwind.config.js */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4ff', 100: '#dce8ff', 200: '#b8d0ff', 300: '#8fb3ff', 400: '#5f8fff',
          500: '#3366ff', 600: '#274fd1', 700: '#1e3ca3', 800: '#182f7e', 900: '#132666',
        },
        neutral: {
          50: '#f7f7f8', 100: '#eeeef0', 200: '#dcdce1', 300: '#c2c2c9', 400: '#9d9da7',
          500: '#77778a', 600: '#5c5c6b', 700: '#454452', 800: '#2e2d38', 900: '#1b1a22',
        },
        status: {
          pendingBg: '#f2f1ec', pendingFg: '#8a7a4d',
          confirmedBg: '#eef2f4', confirmedFg: '#4d7a8a',
          activeBg: '#eef4ee', activeFg: '#4d8a5a',
          completedBg: '#f0f0f2', completedFg: '#5c5c6b',
          cancelledBg: '#f5eeee', cancelledFg: '#8a4d4d',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 4px 12px rgba(27,26,34,0.08)',
        cardLg: '0 12px 32px rgba(27,26,34,0.10)',
      },
    },
  },
};
