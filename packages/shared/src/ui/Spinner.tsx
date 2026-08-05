import React from 'react';
import { cn } from './cn';

export function Spinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <span
        className="animate-spin rounded-full border-2 border-line border-t-accent"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

/**
 * Placeholder block for content that is still loading. Preferred over a
 * spinner where the shape of the incoming content is known, since it avoids
 * the layout jump when data lands.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-sunken', className)} />;
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
