/**
 * Shared Tailwind preset for the rental platform.
 *
 * Colours are declared as CSS custom properties (see theme.css) rather than
 * literal hex values, so a single `.dark` class on <html> reskins the whole
 * app without any component knowing which theme is active. Every colour here
 * is semantic — `surface`, `border`, `muted` — because component code should
 * describe intent, not pick shades.
 */

/** Wraps a CSS variable so Tailwind's opacity modifiers (bg-surface/50) work. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const statusColor = (name) => ({
  DEFAULT: v(`${name}`),
  soft: v(`${name}-soft`),
  fg: v(`${name}-fg`),
});

module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: {
          DEFAULT: v('surface'),
          raised: v('surface-raised'),
          sunken: v('surface-sunken'),
        },
        line: {
          DEFAULT: v('border'),
          strong: v('border-strong'),
        },
        fg: {
          DEFAULT: v('fg'),
          muted: v('fg-muted'),
          subtle: v('fg-subtle'),
        },
        accent: {
          DEFAULT: v('accent'),
          hover: v('accent-hover'),
          fg: v('accent-fg'),
          soft: v('accent-soft'),
          softFg: v('accent-soft-fg'),
        },
        success: statusColor('success'),
        warning: statusColor('warning'),
        info: statusColor('info'),
        danger: statusColor('danger'),
        muted: statusColor('muted'),
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        // Tightened tracking on display sizes — large Inter reads loose by default.
        '2xl': ['1.5rem', { lineHeight: '1.875rem', letterSpacing: '-0.02em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.022em' }],
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        xs: '0 1px 2px rgb(var(--shadow) / 0.06)',
        sm: '0 1px 3px rgb(var(--shadow) / 0.08), 0 1px 2px rgb(var(--shadow) / 0.04)',
        md: '0 4px 12px rgb(var(--shadow) / 0.08), 0 2px 4px rgb(var(--shadow) / 0.04)',
        lg: '0 12px 32px rgb(var(--shadow) / 0.12), 0 4px 8px rgb(var(--shadow) / 0.04)',
        pop: '0 16px 48px rgb(var(--shadow) / 0.18)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
};
