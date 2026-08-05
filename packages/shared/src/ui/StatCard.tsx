import React from 'react';
import { Card } from './Card';

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-sm text-neutral-500">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold text-neutral-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
      </div>
      {icon && <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-500">{icon}</div>}
    </Card>
  );
}
