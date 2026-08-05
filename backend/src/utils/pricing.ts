export function daysBetween(start: string | Date, end: string | Date): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 1);
}

/**
 * Quote = base daily rate (TZS) x number of days, converted to the requested
 * currency using the admin-set exchange rate. Seasonal multipliers (if any
 * active window overlaps the rental dates) are applied to the daily rate first.
 */
export function calculateQuote(params: {
  dailyRateTzs: number;
  startDate: string;
  endDate: string;
  currency: 'TZS' | 'USD';
  usdToTzsRate: number;
  seasonalMultiplier?: number;
}): { days: number; amount: number } {
  const days = daysBetween(params.startDate, params.endDate);
  const multiplier = params.seasonalMultiplier ?? 1;
  const totalTzs = params.dailyRateTzs * multiplier * days;
  const amount = params.currency === 'USD' ? totalTzs / params.usdToTzsRate : totalTzs;
  return { days, amount: Math.round(amount * 100) / 100 };
}
