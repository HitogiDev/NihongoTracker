import { describe, expect, it } from 'vitest';
import { buildReadingSpeedByDifficultyData } from '../services/readingSpeed.service.js';

describe('buildReadingSpeedByDifficultyData', () => {
  it('normalizes Jiten difficulty and calculates characters per hour', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');

    expect(
      buildReadingSpeedByDifficultyData(
        [
          {
            date,
            type: 'book',
            time: 30,
            chars: 6000,
            mediaId: 'book-1',
          },
        ],
        [
          {
            contentId: 'book-1',
            jitenDifficulty: 2.5,
            title: { contentTitleNative: '本の名前' },
          },
        ]
      )
    ).toEqual([
      {
        date,
        type: 'book',
        mediaId: 'book-1',
        mediaTitle: '本の名前',
        difficulty: 50,
        charsPerHour: 12000,
      },
    ]);
  });

  it('omits logs without a media id or cached Jiten difficulty', () => {
    const log = {
      date: new Date('2026-01-01T00:00:00.000Z'),
      type: 'reading',
      time: 60,
      chars: 1000,
    };

    expect(
      buildReadingSpeedByDifficultyData(
        [
          log,
          { ...log, mediaId: 'missing-difficulty' },
          { ...log, mediaId: 'valid', chars: 0 },
        ],
        [
          {
            contentId: 'missing-difficulty',
            jitenDifficulty: null,
          },
          {
            contentId: 'valid',
            jitenDifficulty: 4,
            title: { contentTitleEnglish: 'Valid' },
          },
        ]
      )
    ).toEqual([]);
  });
});
