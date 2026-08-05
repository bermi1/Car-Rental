import React from 'react';
import { cn } from './cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-10', className)}>
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200 border-t-primary-500" />
    </div>
  );
}
