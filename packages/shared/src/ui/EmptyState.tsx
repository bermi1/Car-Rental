import React from 'react';
import { cn } from './cn';
import { Icon, IconName } from './Icon';

export function EmptyState({
  title,
  description,
  icon = 'file',
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-sunken text-fg-subtle">
        <Icon name={icon} size={20} />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
