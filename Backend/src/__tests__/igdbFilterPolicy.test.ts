import { describe, expect, it } from 'vitest';
import { isJapanReleaseRegion } from '../services/igdbFilterPolicy.js';

describe('isJapanReleaseRegion', () => {
  it.each([5, '5', 'japan', 'Japan'])('accepts %s', (region) => {
    expect(isJapanReleaseRegion(region)).toBe(true);
  });

  it.each([1, '2', 'europe', '', null, undefined])('rejects %s', (region) => {
    expect(isJapanReleaseRegion(region)).toBe(false);
  });
});
