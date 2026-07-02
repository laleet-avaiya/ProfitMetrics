import { Timestamp } from 'firebase/firestore';

/**
 * Firestore stores instants as UTC Timestamps. JavaScript `Date` is also a UTC instant;
 * format with Intl / local helpers when showing in the UI.
 */

/** Current instant (UTC). Use when creating/updating records. */
export function nowUtc(): Date {
  return new Date();
}

export function toFirestoreTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

export function fromFirestoreTimestamp(value: unknown): Date | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === 'function') return maybe.toDate();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

/** ISO-8601 UTC string, e.g. `2026-06-29T14:30:00.000Z` */
export function toIsoUtcString(date: Date): string {
  return date.toISOString();
}

/**
 * `<input type="date">` value (local calendar day) → UTC instant at local midnight.
 * Use for business dates like order date / expense date.
 */
export function localDateInputToUtc(dateStr: string): Date {
  const trimmed = dateStr.trim();
  if (!trimmed) return nowUtc();
  const [y, m, d] = trimmed.split('-').map(Number);
  if (!y || !m || !d) return nowUtc();
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** UTC instant → `YYYY-MM-DD` for `<input type="date">` in the user's local timezone. */
export function utcToLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** End of local calendar day (23:59:59.999) for inclusive date-range filters. */
export function localDateInputToUtcEndOfDay(dateStr: string): Date {
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  if (!y || !m || !d) return nowUtc();
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

const DATE_FIELD_NAMES = new Set([
  'createdAt',
  'updatedAt',
  'deletedAt',
  'orderDate',
  'expenseDate',
  'returnedAt',
  'subscriptionStart',
  'subscriptionEnd',
  'termsAcceptedAt',
  'usagePolicyAcceptedAt',
  'paidAt',
  'purchaseDate',
  'paymentDate',
  'receivedAt',
  'lastReceivedAt',
  'invoiceDate',
  'dueDate',
  'ts',
  'uploadedAt',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/** Recursively convert Firestore Timestamps → `Date` when reading documents. */
export function convertTimestamps<T>(data: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp || (DATE_FIELD_NAMES.has(key) && value != null)) {
      const date = fromFirestoreTimestamp(value);
      out[key] = date ?? value;
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        isPlainObject(item) ? convertTimestamps(item) : fromFirestoreTimestamp(item) ?? item
      );
      continue;
    }

    if (isPlainObject(value)) {
      out[key] = convertTimestamps(value);
      continue;
    }

    out[key] = value;
  }

  return out as T;
}

/** Recursively convert `Date` → Firestore `Timestamp` when writing documents. */
export function prepareDatesForFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (value instanceof Date) {
      out[key] = toFirestoreTimestamp(value);
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        isPlainObject(item) ? prepareDatesForFirestore(item) : item instanceof Date ? toFirestoreTimestamp(item) : item
      );
      continue;
    }

    if (isPlainObject(value)) {
      out[key] = prepareDatesForFirestore(value);
      continue;
    }

    out[key] = value;
  }

  return out;
}
