import { describe, it, expect } from 'vitest';
import {
  buildVndbImageUrl,
  buildVndbScreenshotUrls,
  buildVnScreenshots,
  pickVnBannerScreenshot,
  MAX_VN_SCREENSHOTS,
  IVndbScreenshotInfo,
} from '../services/vndbFilterPolicy.js';

const safeInfo = (width = 1280, height = 720): IVndbScreenshotInfo => ({
  width,
  height,
  sexualAvg: 0,
  violenceAvg: 0,
});

describe('buildVndbScreenshotUrls', () => {
  it('builds the full-size and thumbnail CDN URLs', () => {
    expect(buildVndbScreenshotUrls('sf12345')).toEqual({
      url: 'https://t.vndb.org/sf/45/12345.jpg',
      thumbnailUrl: 'https://t.vndb.org/st/45/12345.jpg',
    });
  });

  it('pads the directory of IDs with one digit', () => {
    expect(buildVndbScreenshotUrls('sf7')?.url).toBe(
      'https://t.vndb.org/sf/07/7.jpg'
    );
    expect(buildVndbImageUrl('cv7')).toBe('https://t.vndb.org/cv/07/7.jpg');
  });

  it('rejects IDs that are not screenshots', () => {
    expect(buildVndbScreenshotUrls('cv123')).toBeNull();
    expect(buildVndbScreenshotUrls(null)).toBeNull();
  });
});

describe('buildVnScreenshots', () => {
  it('sorts, removes duplicates, and limits the list', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `sf${100 - i}`);
    const info = new Map(ids.map((id) => [id, safeInfo()]));
    const result = buildVnScreenshots([...ids, 'sf100'], info);

    expect(result).toHaveLength(MAX_VN_SCREENSHOTS);
    expect(result[0].url).toBe('https://t.vndb.org/sf/81/81.jpg');
  });

  it('marks sexual, brutal, and unrated images as adult', () => {
    const info = new Map<string, IVndbScreenshotInfo>([
      ['sf1', safeInfo()],
      ['sf2', { ...safeInfo(), sexualAvg: 120 }],
      ['sf3', { ...safeInfo(), violenceAvg: 180 }],
    ]);
    const flags = buildVnScreenshots(['sf1', 'sf2', 'sf3', 'sf4'], info).map(
      (shot) => shot.isAdult
    );
    expect(flags).toEqual([false, true, true, true]);
  });
});

describe('pickVnBannerScreenshot', () => {
  it('prefers a wide safe screenshot', () => {
    const info = new Map<string, IVndbScreenshotInfo>([
      ['sf1', { ...safeInfo(), sexualAvg: 200 }],
      ['sf2', safeInfo(400, 300)],
      ['sf3', safeInfo(1280, 720)],
    ]);
    const shots = buildVnScreenshots(['sf1', 'sf2', 'sf3'], info);
    expect(pickVnBannerScreenshot(shots)).toBe(
      'https://t.vndb.org/sf/03/3.jpg'
    );
  });

  it('returns null when every screenshot is adult', () => {
    const shots = buildVnScreenshots(['sf1'], new Map());
    expect(pickVnBannerScreenshot(shots)).toBeNull();
  });
});
