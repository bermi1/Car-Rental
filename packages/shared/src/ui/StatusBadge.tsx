import React from 'react';
import { cn } from './cn';
import type { BookingStatus } from '../types';

const statusStyles: Record<string, { bg: string; fg: string; label: string }> = {
  pending_documents: { bg: 'bg-status-pendingBg', fg: 'text-status-pendingFg', label: 'Pending Documents' },
  documents_submitted: { bg: 'bg-status-pendingBg', fg: 'text-status-pendingFg', label: 'Documents Submitted' },
  confirmed: { bg: 'bg-status-confirmedBg', fg: 'text-status-confirmedFg', label: 'Confirmed' },
  active: { bg: 'bg-status-activeBg', fg: 'text-status-activeFg', label: 'Active' },
  completed: { bg: 'bg-status-completedBg', fg: 'text-status-completedFg', label: 'Completed' },
  cancelled: { bg: 'bg-status-cancelledBg', fg: 'text-status-cancelledFg', label: 'Cancelled' },
  held: { bg: 'bg-status-pendingBg', fg: 'text-status-pendingFg', label: 'Held' },
  released: { bg: 'bg-status-activeBg', fg: 'text-status-activeFg', label: 'Released' },
  forfeited: { bg: 'bg-status-cancelledBg', fg: 'text-status-cancelledFg', label: 'Forfeited' },
  available: { bg: 'bg-status-activeBg', fg: 'text-status-activeFg', label: 'Available' },
  booked: { bg: 'bg-status-confirmedBg', fg: 'text-status-confirmedFg', label: 'Booked' },
  in_service: { bg: 'bg-status-pendingBg', fg: 'text-status-pendingFg', label: 'In Service' },
  out_of_service: { bg: 'bg-status-cancelledBg', fg: 'text-status-cancelledFg', label: 'Out of Service' },
};

export function StatusBadge({ status, className }: { status: BookingStatus | string; className?: string }) {
  const style = statusStyles[status] || { bg: 'bg-neutral-100', fg: 'text-neutral-600', label: status };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        style.bg,
        style.fg,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}
