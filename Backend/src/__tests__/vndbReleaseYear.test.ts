import { describe, it, expect } from 'vitest';
import { parseVndbReleaseYear } from '../services/vndbDumpParser.js';

/**
 * VNDB's releases.released column is an integer YYYYMMDD. Unknown month/day
 * components are 99, a TBA date is 99999999, and the column default is 0.
 */
describe('parseVndbReleaseYear', () => {
  it('reads the year from a full date', () => {
    expect(parseVndbReleaseYear('20040226')).toBe(2004);
  });

  it('reads the year when month and day are unknown', () => {
    expect(parseVndbReleaseYear('20049999')).toBe(2004);
    expect(parseVndbReleaseYear('19991299')).toBe(1999);
  });

  it('drops TBA dates', () => {
    expect(parseVndbReleaseYear('99999999')).toBeNull();
  });

  it('drops the "no date" default and empty values', () => {
    expect(parseVndbReleaseYear('0')).toBeNull();
    expect(parseVndbReleaseYear(null)).toBeNull();
    expect(parseVndbReleaseYear('')).toBeNull();
  });

  it('drops non-numeric and out-of-range values', () => {
    expect(parseVndbReleaseYear('not-a-date')).toBeNull();
    expect(parseVndbReleaseYear('18000101')).toBeNull();
  });

  it('accepts a plausible pre-2005 release', () => {
    expect(parseVndbReleaseYear('19961220')).toBe(1996);
  });
});
