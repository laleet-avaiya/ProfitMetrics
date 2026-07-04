const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Share of the subscription period used as the renewal warning window (e.g. 0.1 = final 10%). */
const WARNING_FRACTION_OF_PERIOD = 0.1;

/**
 * Whole calendar days from `start` to `end` (start/end normalized to local midnight).
 * At least 1 when end is on or after start.
 */
export function getSubscriptionPeriodDays(start: Date, end: Date): number {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const raw = Math.ceil((e.getTime() - s.getTime()) / MS_PER_DAY);
  return Math.max(1, raw);
}

/** Show renewal / expiry notices when this many days or fewer remain (including expired). */
export const SUBSCRIPTION_RENEWAL_NOTICE_DAYS = 15;

export function shouldShowSubscriptionRenewalNotice(daysRemaining: number | null): boolean {
  return daysRemaining !== null && daysRemaining <= SUBSCRIPTION_RENEWAL_NOTICE_DAYS;
}

/** Days from today (local midnight) until `subscriptionEnd` (0 if already ended that day or before). */
export function getSubscriptionDaysRemaining(subscriptionEnd: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(subscriptionEnd);
  endDate.setHours(0, 0, 0, 0);
  const diff = endDate.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / MS_PER_DAY));
}

/** True when the org has a subscription end date on or before today. */
export function isOrgSubscriptionExpired(org: { subscriptionEnd?: Date }): boolean {
  if (org.subscriptionEnd == null) return false;
  return getSubscriptionDaysRemaining(org.subscriptionEnd) <= 0;
}

/**
 * How many days before end we should show the “renew soon” banner.
 * Derived from subscription length (end − start), not a fixed number of days.
 * If `subscriptionStart` is missing, `periodFallbackStart` (e.g. company `createdAt`) is used to approximate the period.
 */
export function getSubscriptionWarningThresholdDays(
  subscriptionStart: Date | undefined,
  subscriptionEnd: Date | undefined,
  periodFallbackStart?: Date
): number | null {
  if (subscriptionEnd == null) return null;

  const periodStart = subscriptionStart ?? periodFallbackStart;
  if (periodStart == null) return null;

  const totalDays = getSubscriptionPeriodDays(periodStart, subscriptionEnd);
  const threshold = Math.max(1, Math.ceil(totalDays * WARNING_FRACTION_OF_PERIOD));
  return Math.min(threshold, totalDays);
}
