/**
 * Booking lifecycle metadata shared by the web app and the API-facing types.
 *
 * Visual design tokens live in `theme.css` (as CSS custom properties) and
 * `tailwind-preset.js`; they aren't duplicated here.
 */

import type { BookingStatus } from './types';
export type { BookingStatus };

export const bookingStatusLabels: Record<BookingStatus, string> = {
  pending_documents: 'Pending Documents',
  documents_submitted: 'Documents Submitted',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** The happy path, in order. `cancelled` is terminal and not part of it. */
export const bookingStatusOrder: BookingStatus[] = [
  'pending_documents',
  'documents_submitted',
  'confirmed',
  'active',
  'completed',
];
