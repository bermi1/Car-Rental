/**
 * Shared design tokens for the Rental Car Platform.
 * Consumed by web-admin, web-staff (as a Tailwind preset) and mobile (as raw JS values).
 * Two-color palette: primary (action/brand) + neutral (structure). Everything else is grayscale.
 * Status colors are muted, not competing accents.
 */

import type { BookingStatus } from './types';
export type { BookingStatus };

export const colors = {
  primary: {
    50: '#eef4ff',
    100: '#dce8ff',
    200: '#b8d0ff',
    300: '#8fb3ff',
    400: '#5f8fff',
    500: '#3366ff', // brand primary
    600: '#274fd1',
    700: '#1e3ca3',
    800: '#182f7e',
    900: '#132666',
  },
  neutral: {
    50: '#f7f7f8',
    100: '#eeeef0',
    200: '#dcdce1',
    300: '#c2c2c9',
    400: '#9d9da7',
    500: '#77778a', // secondary/neutral base
    600: '#5c5c6b',
    700: '#454452',
    800: '#2e2d38',
    900: '#1b1a22',
  },
  gray: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },
  status: {
    pending: { bg: '#f2f1ec', fg: '#8a7a4d', dot: '#c4a94f' },
    confirmed: { bg: '#eef2f4', fg: '#4d7a8a', dot: '#4f9ec4' },
    active: { bg: '#eef4ee', fg: '#4d8a5a', dot: '#4fc46f' },
    completed: { bg: '#f0f0f2', fg: '#5c5c6b', dot: '#9d9da7' },
    cancelled: { bg: '#f5eeee', fg: '#8a4d4d', dot: '#c45050' },
    error: { bg: '#f5eeee', fg: '#8a4d4d', dot: '#c45050' },
    warning: { bg: '#f2f1ec', fg: '#8a7a4d', dot: '#c4a94f' },
    success: { bg: '#eef4ee', fg: '#4d8a5a', dot: '#4fc46f' },
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const shadow = {
  sm: '0 1px 2px rgba(27,26,34,0.06)',
  md: '0 4px 12px rgba(27,26,34,0.08)',
  lg: '0 12px 32px rgba(27,26,34,0.10)',
};

export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  scale: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

export const bookingStatusLabels: Record<BookingStatus, string> = {
  pending_documents: 'Pending Documents',
  documents_submitted: 'Documents Submitted',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const bookingStatusOrder: BookingStatus[] = [
  'pending_documents',
  'documents_submitted',
  'confirmed',
  'active',
  'completed',
];

export const bookingStatusColorKey: Record<BookingStatus, keyof typeof colors.status> = {
  pending_documents: 'pending',
  documents_submitted: 'pending',
  confirmed: 'confirmed',
  active: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
};
