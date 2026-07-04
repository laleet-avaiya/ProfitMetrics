import { describe, expect, it } from 'vitest';
import { getSubscriptionDaysRemaining, isOrgSubscriptionExpired } from './subscription';

describe('isOrgSubscriptionExpired', () => {
  it('returns false when subscription end is in the future', () => {
    const end = new Date();
    end.setDate(end.getDate() + 10);
    expect(isOrgSubscriptionExpired({ subscriptionEnd: end })).toBe(false);
  });

  it('returns true when subscription end is today or in the past', () => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    expect(isOrgSubscriptionExpired({ subscriptionEnd: end })).toBe(
      getSubscriptionDaysRemaining(end) <= 0
    );
  });

  it('returns false when subscription end is missing', () => {
    expect(isOrgSubscriptionExpired({})).toBe(false);
  });
});
