import React from 'react';
import { cn } from './cn';

/**
 * Table primitives. The wrapper owns horizontal scrolling so a wide table
 * never forces the page body to scroll sideways.
 */

export function Table({ className, children, ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, children, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('border-b border-line', className)} {...rest}>
      {children}
    </thead>
  );
}

export function TH({
  className,
  numeric,
  children,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-fg-subtle',
        numeric && 'text-right',
        className
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TBody({ className, children, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-line', className)} {...rest}>
      {children}
    </tbody>
  );
}

export function TR({ className, children, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('transition-colors hover:bg-surface-sunken/60', className)} {...rest}>
      {children}
    </tr>
  );
}

export function TD({
  className,
  numeric,
  children,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'px-5 py-3 align-middle text-fg-muted',
        // Tabular figures keep number columns aligned down the page.
        numeric && 'text-right tabular-nums',
        className
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
