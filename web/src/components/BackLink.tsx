import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@rental/shared';

export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
    >
      <Icon name="arrowLeft" size={15} />
      {children}
    </Link>
  );
}
