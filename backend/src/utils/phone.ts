/**
 * Tanzanian phone numbers, stored one way.
 *
 * People type their number four different ways — 0712 345 678, 255712345678,
 * +255 712 345 678 — and they all mean the same account. Everything is folded
 * to +255XXXXXXXXX on the way in so registration, login and duplicate checks
 * agree with each other.
 */
export function normalizePhone(input: string): string {
  const trimmed = String(input ?? '').trim();
  const withPlus = trimmed.replace(/[^0-9+]/g, '');
  const digits = trimmed.replace(/[^0-9]/g, '');

  if (/^\+255[0-9]{9}$/.test(withPlus)) return withPlus;
  if (/^255[0-9]{9}$/.test(digits)) return `+${digits}`;
  if (/^0[0-9]{9}$/.test(digits)) return `+255${digits.slice(1)}`;

  // Another country's number, or something we don't recognise — keep the
  // caller's own formatting rather than inventing a country code for them.
  return withPlus || trimmed;
}

/** True when the value looks like a phone number rather than an email. */
export function looksLikePhone(input: string): boolean {
  const value = String(input ?? '').trim();
  if (value.includes('@')) return false;
  return /^[+0-9][0-9\s()-]{6,}$/.test(value);
}

/** A number we're willing to create an account against. */
export function isValidPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  // Tanzanian numbers get the strict check; anything else just has to be a
  // plausible international number.
  if (normalized.startsWith('+255')) return /^\+255[0-9]{9}$/.test(normalized);
  return /^\+?[0-9]{9,15}$/.test(normalized);
}
