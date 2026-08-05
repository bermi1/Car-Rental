import React from 'react';
import { cn } from './cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Removes the default padding — use for cards that hold a full-bleed table. */
  flush?: boolean;
}

export function Card({ className, flush, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface shadow-xs',
        !flush && 'p-5',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-4', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-sm font-semibold tracking-[-0.01em] text-fg', className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-0.5 text-[13px] text-fg-muted', className)} {...rest}>
      {children}
    </p>
  );
}

/** Header row for a card that contains a table — sits flush above the table. */
export function CardToolbar({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
