import React from 'react';
import { Icon } from '@rental/shared';

/** Inline error banner for failed actions. Renders nothing when empty. */
export function ErrorNotice({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger-fg">
      <Icon name="alert" size={16} className="mt-px shrink-0" />
      <span>{message}</span>
    </div>
  );
}
