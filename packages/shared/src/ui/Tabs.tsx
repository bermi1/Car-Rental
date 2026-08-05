import React from 'react';
import { cn } from './cn';

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

/** Segmented filter control used above lists. */
export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1 rounded-lg bg-surface-sunken p-1', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all',
              active ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg'
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn('tabular-nums', active ? 'text-fg-muted' : 'text-fg-subtle')}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
