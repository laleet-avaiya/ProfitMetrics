/**
 * Display dates/times in the user's local timezone.
 * Storage uses UTC instants — see `firestoreDates.ts`.
 */

function assertValidDate(date: Date): Date {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Invalid date');
  }
  return date;
}

/** Local calendar date, e.g. 29/06/2026 (format follows browser locale). */
export function formatDateLocal(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  }).format(assertValidDate(date));
}

/** Like `formatDateLocal` but returns a fallback when the date is missing or invalid. */
export function formatDateLocalSafe(
  date: Date | undefined | null,
  fallback = '—',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return fallback;
  return formatDateLocal(date, options);
}

/** Local date and time, e.g. 29/06/2026, 2:30 PM */
export function formatDateTimeLocal(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(assertValidDate(date));
}

/** Local time only */
export function formatTimeLocal(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(assertValidDate(date));
}

/** Format using company timezone (for reports), falls back to local. */
export function formatDateInTimezone(
  date: Date,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
    ...options,
  }).format(assertValidDate(date));
}

/** @deprecated Use `formatDateLocal` */
export const formatDate = formatDateLocal;

/** @deprecated Use `formatDateTimeLocal` */
export const formatDateTime = formatDateTimeLocal;

/** Start of today in local timezone */
export function startOfLocalToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Compare calendar days in local timezone */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
