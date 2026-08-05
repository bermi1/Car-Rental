import React from 'react';
import { cn } from './cn';
import { bookingStatusOrder, bookingStatusLabels, BookingStatus } from '../tokens';

export function BookingStepper({ status }: { status: BookingStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="rounded-lg bg-status-cancelledBg px-4 py-2 text-sm font-medium text-status-cancelledFg">
        Cancelled
      </div>
    );
  }
  const currentIndex = bookingStatusOrder.indexOf(status);

  return (
    <div className="flex items-center">
      {bookingStatusOrder.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  done && 'bg-primary-500 text-white',
                  current && 'bg-primary-100 text-primary-700 ring-2 ring-primary-400',
                  !done && !current && 'bg-neutral-100 text-neutral-400'
                )}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={cn(
                  'max-w-[80px] text-center text-[11px] leading-tight',
                  current ? 'font-medium text-neutral-900' : 'text-neutral-400'
                )}
              >
                {bookingStatusLabels[step]}
              </span>
            </div>
            {i < bookingStatusOrder.length - 1 && (
              <div className={cn('mx-1 mb-4 h-0.5 flex-1', done ? 'bg-primary-500' : 'bg-neutral-200')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
