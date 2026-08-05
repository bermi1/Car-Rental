import React from 'react';
import { cn } from './cn';
import { Icon, IconName } from './Icon';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: IconName;
  /** Tints the icon chip — use to flag a figure that needs attention. */
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  className?: string;
}

const toneClasses = {
  accent: 'bg-accent-soft text-accent-softFg',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
};

export function StatCard({ label, value, hint, icon, tone = 'accent', className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-4 shadow-xs', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-fg-muted">{label}</p>
        {icon && (
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-fg">{value}</p>
      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}
