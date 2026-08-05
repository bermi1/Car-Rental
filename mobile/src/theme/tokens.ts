/**
 * Mirrors packages/shared/src/tokens.ts values for React Native, which can't
 * consume the web package's Tailwind/JSX-based exports directly. Keep colors
 * in sync with the shared token file if the palette changes.
 */
export const colors = {
  primary: {
    50: '#eef4ff', 100: '#dce8ff', 200: '#b8d0ff', 300: '#8fb3ff', 400: '#5f8fff',
    500: '#3366ff', 600: '#274fd1', 700: '#1e3ca3', 800: '#182f7e', 900: '#132666',
  },
  neutral: {
    50: '#f7f7f8', 100: '#eeeef0', 200: '#dcdce1', 300: '#c2c2c9', 400: '#9d9da7',
    500: '#77778a', 600: '#5c5c6b', 700: '#454452', 800: '#2e2d38', 900: '#1b1a22',
  },
  white: '#ffffff',
  status: {
    pending: { bg: '#f2f1ec', fg: '#8a7a4d' },
    confirmed: { bg: '#eef2f4', fg: '#4d7a8a' },
    active: { bg: '#eef4ee', fg: '#4d8a5a' },
    completed: { bg: '#f0f0f2', fg: '#5c5c6b' },
    cancelled: { bg: '#f5eeee', fg: '#8a4d4d' },
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 10, lg: 16, xl: 24, full: 9999 };
export const fontSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30 };

export type BookingStatus =
  | 'pending_documents'
  | 'documents_submitted'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled';

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

export function statusColorFor(status: string) {
  switch (status) {
    case 'pending_documents':
    case 'documents_submitted':
    case 'held':
      return colors.status.pending;
    case 'confirmed':
    case 'booked':
      return colors.status.confirmed;
    case 'active':
    case 'available':
    case 'released':
      return colors.status.active;
    case 'completed':
      return colors.status.completed;
    case 'cancelled':
    case 'forfeited':
    case 'out_of_service':
      return colors.status.cancelled;
    default:
      return { bg: colors.neutral[100], fg: colors.neutral[600] };
  }
}
