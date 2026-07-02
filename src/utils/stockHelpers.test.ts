import { describe, expect, it } from 'vitest';
import { computeWeightedAverage } from './stockHelpers';

describe('computeWeightedAverage', () => {
  it('returns incoming price when starting from zero stock', () => {
    expect(computeWeightedAverage(0, 0, 10, 25)).toBe(25);
  });

  it('returns current average when no incoming quantity', () => {
    expect(computeWeightedAverage(5, 20, 0, 30)).toBe(20);
  });

  it('blends existing and incoming unit costs', () => {
    // (10 × 20 + 10 × 30) / 20 = 25
    expect(computeWeightedAverage(10, 20, 10, 30)).toBe(25);
  });
});
