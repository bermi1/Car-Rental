import React from 'react';
import { cn } from './cn';

type Tone = 'success' | 'warning' | 'info' | 'danger' | 'muted' | 'accent';

const toneClasses: Record<Tone, string> = {
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  info: 'bg-info-soft text-info-fg',
  danger: 'bg-danger-soft text-danger-fg',
  muted: 'bg-muted-soft text-muted-fg',
  accent: 'bg-accent-soft text-accent-softFg',
};

const dotClasses: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  danger: 'bg-danger',
  muted: 'bg-muted',
  accent: 'bg-accent',
};

/**
 * Every status string the API can return, mapped to a tone and a display
 * label. Keeping this in one table means booking, vehicle, deposit and
 * document statuses all read consistently wherever they appear.
 */
const STATUS_MAP: Record<string, { tone: Tone; label: string }> = {
  // Bookings
  pending_documents: { tone: 'warning', label: 'Pending Documents' },
  documents_submitted: { tone: 'info', label: 'Documents Submitted' },
  confirmed: { tone: 'accent', label: 'Confirmed' },
  active: { tone: 'success', label: 'Active' },
  completed: { tone: 'muted', label: 'Completed' },
  cancelled: { tone: 'danger', label: 'Cancelled' },
  // Vehicles
  available: { tone: 'success', label: 'Available' },
  booked: { tone: 'accent', label: 'Booked' },
  in_service: { tone: 'warning', label: 'In Service' },
  out_of_service: { tone: 'danger', label: 'Out of Service' },
  // Deposits
  held: { tone: 'warning', label: 'Held' },
  released: { tone: 'success', label: 'Released' },
  forfeited: { tone: 'danger', label: 'Forfeited' },
  // Generic
  verified: { tone: 'success', label: 'Verified' },
  pending: { tone: 'warning', label: 'Pending' },
  rejected: { tone: 'danger', label: 'Rejected' },
  inactive: { tone: 'muted', label: 'Inactive' },
};

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface StatusBadgeProps {
  status: string;
  /** Overrides the label looked up from the status map. */
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const entry = STATUS_MAP[status] ?? { tone: 'muted' as Tone, label: humanize(status) };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium',
        toneClasses[entry.tone],
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClasses[entry.tone])} />
      {label ?? entry.label}
    </span>
  );
}

/** Small count/label chip without the status semantics. */
export function Chip({
  children,
  tone = 'muted',
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
