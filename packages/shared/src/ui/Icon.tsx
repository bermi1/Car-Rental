import React from 'react';

/**
 * Inline icon set. Kept in-repo rather than pulled from an icon package so the
 * bundle stays small and nothing needs to be fetched at runtime.
 *
 * All glyphs are drawn on a 24x24 grid with a 1.5 stroke and inherit
 * currentColor, so they sit correctly next to text at any size.
 */

export type IconName =
  | 'dashboard'
  | 'car'
  | 'calendar'
  | 'users'
  | 'shield'
  | 'file'
  | 'wallet'
  | 'chart'
  | 'settings'
  | 'clipboard'
  | 'activity'
  | 'plus'
  | 'search'
  | 'check'
  | 'x'
  | 'chevronRight'
  | 'chevronDown'
  | 'arrowLeft'
  | 'download'
  | 'upload'
  | 'logout'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'alert'
  | 'wrench'
  | 'clock'
  | 'external';

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="8.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
      <rect x="13.5" y="12.5" width="7.5" height="8.5" rx="1.5" />
      <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" />
    </>
  ),
  car: (
    <>
      <path d="M5 17h14M4.5 17v1.5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V17M21.5 17v1.5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V17" />
      <path d="M2.5 17v-4.2a2 2 0 0 1 .3-1l1.9-3.2A2 2 0 0 1 6.4 7.6h11.2a2 2 0 0 1 1.7 1l1.9 3.2a2 2 0 0 1 .3 1V17z" />
      <path d="M6 13.5h2M16 13.5h2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.4a6.5 6.5 0 0 1 3.5 5.6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8l7.5 3v5.7c0 4.6-3.1 8.4-7.5 9.7-4.4-1.3-7.5-5.1-7.5-9.7V5.8z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  file: (
    <>
      <path d="M14 2.8H7a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.8z" />
      <path d="M14 2.8V7.8h5M8.5 13h7M8.5 16.5h4.5" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" />
      <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
      <path d="M16.5 13.5h.01" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16.5V12M12.5 16.5V7.5M17 16.5v-6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V8a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="3" width="8" height="4" rx="1.5" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="M9 12.5l2 2 4-4" />
    </>
  ),
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  check: <path d="M4.5 12.5l5 5 10-11" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  download: <path d="M12 3v12M7 10.5l5 5 5-5M4 20h16" />,
  upload: <path d="M12 16V4M7 8.5l5-5 5 5M4 20h16" />,
  logout: (
    <>
      <path d="M9.5 3.5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h3.5" />
      <path d="M15 8l4 4-4 4M19 12H9" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  alert: (
    <>
      <path d="M12 3.5l9.5 16.5H2.5z" />
      <path d="M12 10v4M12 17.2h.01" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  wrench: <path d="M15.5 8.5a4.5 4.5 0 0 1-5.9 5.9L4.4 19.6a2 2 0 0 1-2.8-2.8l5.2-5.2a4.5 4.5 0 0 1 5.9-5.9L10 8.3l1.4 4.3 4.3 1.4z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </>
  ),
};

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
