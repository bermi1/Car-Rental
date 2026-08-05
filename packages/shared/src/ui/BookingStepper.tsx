import React from 'react';
import { cn } from './cn';
import { Icon } from './Icon';
import { bookingStatusOrder, bookingStatusLabels, BookingStatus } from '../tokens';

/**
 * Progress through the booking lifecycle. Cancelled is not a step on the
 * path — it's terminal from anywhere — so it renders as its own banner.
 */
export function BookingStepper({ status, className }: { status: BookingStatus; className?: string }) {
  if (status === 'cancelled') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg bg-danger-soft px-4 py-3 text-sm font-medium text-danger-fg',
          className
        )}
      >
        <Icon name="x" size={16} />
        This booking was cancelled
      </div>
    );
  }

  const currentIndex = bookingStatusOrder.indexOf(status);

  return (
    <ol className={cn('flex items-start', className)}>
      {bookingStatusOrder.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const last = i === bookingStatusOrder.length - 1;

        return (
          <li key={step} className={cn('flex items-start', !last && 'flex-1')}>
            <div className="flex w-20 shrink-0 flex-col items-center gap-2">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  done && 'bg-accent text-accent-fg',
                  current && 'bg-accent-soft text-accent-softFg ring-2 ring-accent',
                  !done && !current && 'bg-surface-sunken text-fg-subtle'
                )}
              >
                {done ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-center text-[11px] leading-tight',
                  current ? 'font-medium text-fg' : 'text-fg-subtle'
                )}
              >
                {bookingStatusLabels[step]}
              </span>
            </div>
            {!last && (
              <span
                className={cn(
                  'mt-3.5 h-0.5 flex-1 rounded-full transition-colors',
                  done ? 'bg-accent' : 'bg-line'
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
