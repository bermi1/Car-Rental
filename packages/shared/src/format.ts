/**
 * Display formatting helpers. Centralised so money and dates read the same
 * way on every screen.
 */

/** `1500000` -> `1,500,000 TZS` */
export function formatMoney(amount: number | string, currency = 'TZS'): string {
  const n = Number(amount) || 0;
  return `${n.toLocaleString('en-US')} ${currency}`;
}

/** Compact form for dashboard tiles: `1,500,000` -> `1.5M` */
export function formatCompactMoney(amount: number | string, currency = 'TZS'): string {
  const n = Number(amount) || 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M ${currency}`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K ${currency}`;
  return `${n.toLocaleString('en-US')} ${currency}`;
}

/** `2026-08-05` -> `5 Aug 2026` */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** `5 Aug 2026, 14:30` */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDate(d)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/** `5 Aug – 9 Aug 2026`, collapsing the year when both ends share it. */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '—';
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${left} – ${formatDate(b)}`;
}

/** Whole days between two dates, minimum 1. */
export function rentalDays(start: string | Date, end: string | Date): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** `2 hours ago`, `3 days ago` — for activity feeds. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';

  // Each threshold is the point at which the next-larger unit reads better.
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const steps: { limit: number; per: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { limit: 3600, per: 60, unit: 'minute' },
    { limit: 86_400, per: 3600, unit: 'hour' },
    { limit: 604_800, per: 86_400, unit: 'day' },
    { limit: 2_592_000, per: 604_800, unit: 'week' },
  ];
  for (const { limit, per, unit } of steps) {
    if (seconds < limit) return rtf.format(-Math.floor(seconds / per), unit);
  }
  // Beyond a month an absolute date is more useful than "5 months ago".
  return formatDate(d);
}

/** `national_id` -> `National ID` */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
