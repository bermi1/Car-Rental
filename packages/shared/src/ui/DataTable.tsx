import React from 'react';
import { cn } from './cn';

/**
 * A table on a wide screen, a stack of cards on a phone.
 *
 * Horizontally scrolling a six-column table on a 390px screen is close to
 * unusable — you lose the row you're reading as soon as you scroll sideways.
 * Below `md` each row becomes a card instead: the `primary` column is the
 * heading, `secondary` sits under it, and the rest render as labelled pairs.
 * One definition drives both, so the two layouts can't drift apart.
 */

export interface DataColumn<T> {
  /** Stable key, also used for the mobile label. */
  key: string;
  header: React.ReactNode;
  /** Label shown on the mobile card. Defaults to `header`. */
  label?: React.ReactNode;
  render: (row: T) => React.ReactNode;
  numeric?: boolean;
  /** Card heading on mobile; hidden from the labelled pairs. */
  primary?: boolean;
  /** Sits directly under the heading on mobile, unlabelled. */
  secondary?: boolean;
  /** Right-aligned action area on the mobile card. */
  action?: boolean;
  /** Drop this column from the mobile card entirely. */
  hideOnMobile?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  className?: string;
}

export function DataTable<T>({ columns, rows, rowKey, className }: DataTableProps<T>) {
  const primary = columns.find((c) => c.primary);
  const secondary = columns.filter((c) => c.secondary);
  const actions = columns.filter((c) => c.action);
  const details = columns.filter(
    (c) => !c.primary && !c.secondary && !c.action && !c.hideOnMobile
  );

  return (
    <div className={className}>
      {/* Desktop */}
      <div className="hidden w-full overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-line">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'whitespace-nowrap px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-fg-subtle',
                    c.numeric && 'text-right'
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-surface-sunken/60">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-5 py-3 align-middle text-fg-muted',
                      c.numeric && 'text-right tabular-nums',
                      c.className
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {primary && <div className="text-sm font-medium text-fg">{primary.render(row)}</div>}
                {secondary.map((c) => (
                  <div key={c.key} className="mt-0.5 text-xs text-fg-subtle">
                    {c.render(row)}
                  </div>
                ))}
              </div>
              {actions.length > 0 && (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {actions.map((c) => (
                    <div key={c.key}>{c.render(row)}</div>
                  ))}
                </div>
              )}
            </div>

            {details.length > 0 && (
              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
                {details.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wider text-fg-subtle">
                      {c.label ?? c.header}
                    </dt>
                    <dd className={cn('mt-0.5 truncate text-[13px] text-fg-muted', c.numeric && 'tabular-nums')}>
                      {c.render(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
