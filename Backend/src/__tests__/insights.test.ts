import { describe, expect, it } from 'vitest';
import {
  IInsightLog,
  buildComfortTimeline,
  buildReadingSpeedInsights,
  jitenBand,
  localMidnightUtc,
  parseLocalPeriod,
  recentMonths,
} from '../services/insights.service.js';
import {
  buildDigestNotification,
  digestTrend,
  lastFinishedMonth,
  lastFinishedWeek,
} from '../services/insightsDigest.service.js';
import { continuousLevel, comfortDifficulty } from '../services/xp.js';

const utc = { timezone: 'UTC', dayStartHour: 0 };

function readingLog(date: string, chars: number, time: number, mediaId?: string): IInsightLog {
  return { date: new Date(date), type: 'vn', chars, time, mediaId: mediaId ?? null };
}

describe('time zone helpers', () => {
  it('returns local midnight in a time zone with an offset', () => {
    expect(localMidnightUtc(2026, 0, 15, 'America/New_York').toISOString()).toBe(
      '2026-01-15T05:00:00.000Z'
    );
    expect(localMidnightUtc(2026, 6, 15, 'America/New_York').toISOString()).toBe(
      '2026-07-15T04:00:00.000Z'
    );
  });

  it('lists the last 12 months with the current month last', () => {
    const months = recentMonths(new Date('2026-03-10T12:00:00Z'), utc);
    expect(months).toHaveLength(12);
    expect(months[0].key).toBe('2025-04');
    expect(months[11].key).toBe('2026-03');
    expect(months[11].start.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(months[11].end.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('applies the day start hour to month boundaries', () => {
    const months = recentMonths(new Date('2026-03-01T02:00:00Z'), {
      timezone: 'UTC',
      dayStartHour: 4,
    });
    expect(months[11].key).toBe('2026-02');
    expect(months[11].start.toISOString()).toBe('2026-02-01T04:00:00.000Z');
  });

  it('parses inclusive local periods and rejects invalid ones', () => {
    const period = parseLocalPeriod('2026-01-01', '2026-01-31', utc);
    expect(period?.days).toBe(31);
    expect(period?.end.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(parseLocalPeriod('2026-02-30', '2026-03-01', utc)).toBeNull();
    expect(parseLocalPeriod('2026-03-01', '2026-02-01', utc)).toBeNull();
    expect(parseLocalPeriod('2020-01-01', '2026-01-01', utc)).toBeNull();
  });
});

describe('buildReadingSpeedInsights', () => {
  const now = new Date('2026-07-20T12:00:00Z');
  const months = recentMonths(now, utc);

  it('compares the last 30 days with the window six months ago', () => {
    const logs = [
      readingLog('2026-01-15T10:00:00Z', 10000, 60),
      readingLog('2026-01-25T10:00:00Z', 10000, 60),
      readingLog('2026-07-10T10:00:00Z', 13000, 60),
      readingLog('2026-07-15T10:00:00Z', 13000, 60),
    ];
    const result = buildReadingSpeedInsights({
      logs,
      difficultyByMediaId: new Map(),
      months,
      now,
      compareMonths: 6,
    });
    expect(result.comparison.previous?.charsPerHour).toBe(10000);
    expect(result.comparison.current?.charsPerHour).toBe(13000);
    expect(result.comparison.changePct).toBe(30);
    const july = result.overall.find((point) => point.month === '2026-07');
    expect(july?.charsPerHour).toBe(13000);
    expect(result.byType[0].type).toBe('vn');
  });

  it('ignores implausible speeds and months without enough evidence', () => {
    const result = buildReadingSpeedInsights({
      logs: [
        readingLog('2026-07-10T10:00:00Z', 1000000, 10),
        readingLog('2026-07-11T10:00:00Z', 5000, 60),
      ],
      difficultyByMediaId: new Map(),
      months,
      now,
      compareMonths: 6,
    });
    const july = result.overall.find((point) => point.month === '2026-07');
    expect(july?.logs).toBe(1);
    expect(july?.charsPerHour).toBeNull();
  });

  it('groups speeds by Jiten band', () => {
    const result = buildReadingSpeedInsights({
      logs: [
        readingLog('2026-07-10T10:00:00Z', 12000, 60, 'easy'),
        readingLog('2026-07-11T10:00:00Z', 12000, 60, 'easy'),
        readingLog('2026-07-12T10:00:00Z', 6000, 60, 'hard'),
        readingLog('2026-07-13T10:00:00Z', 6000, 60, 'hard'),
      ],
      difficultyByMediaId: new Map([
        ['easy', 30],
        ['hard', 90],
      ]),
      months,
      now,
      compareMonths: 6,
    });
    expect(result.byDifficulty.map((entry) => entry.band)).toEqual([1, 4]);
    expect(result.byDifficulty[0].charsPerHour).toBe(12000);
    expect(result.byDifficulty[1].charsPerHour).toBe(6000);
    expect(jitenBand(100)).toBe(4);
    expect(jitenBand(0)).toBe(0);
  });
});

describe('buildComfortTimeline', () => {
  it('rebuilds past levels by removing later log XP', () => {
    const now = new Date('2026-07-20T12:00:00Z');
    const months = recentMonths(now, utc);
    const result = buildComfortTimeline({
      category: 'reading',
      logs: [
        { date: new Date('2026-07-05T10:00:00Z'), type: 'vn', time: 60, xp: 4000 },
      ],
      difficultyByMediaId: new Map(),
      months,
      currentCategoryXp: 10000,
      now,
    });
    const june = result.points.find((point) => point.month === '2026-06');
    const july = result.points.find((point) => point.month === '2026-07');
    const toJiten = (xp: number) =>
      Math.round((comfortDifficulty(continuousLevel(xp)) / 100) * 5 * 100) / 100;
    expect(june?.comfort).toBe(toJiten(6000));
    expect(july?.comfort).toBe(toJiten(10000));
    expect(result.change).toBeGreaterThan(0);
  });
});

describe('insights digest', () => {
  it('finds the last finished week from the week start setting', () => {
    // 2026-07-15 is a Wednesday.
    const now = new Date('2026-07-15T12:00:00Z');
    const monday = lastFinishedWeek(now, utc, 1);
    expect(monday.key).toBe('2026-07-06');
    expect(monday.end.toISOString()).toBe('2026-07-13T00:00:00.000Z');
    expect(monday.previousStart.toISOString()).toBe('2026-06-29T00:00:00.000Z');
    expect(lastFinishedWeek(now, utc, 0).key).toBe('2026-07-05');
  });

  it('finds the last finished month across a year boundary', () => {
    const month = lastFinishedMonth(new Date('2026-01-03T12:00:00Z'), utc);
    expect(month.key).toBe('2025-12');
    expect(month.start.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(month.previousStart.toISOString()).toBe('2025-11-01T00:00:00.000Z');
  });

  it('classifies trends', () => {
    expect(digestTrend({ time: 130 }, { time: 100 })).toEqual({ trend: 'up', change: 30 });
    expect(digestTrend({ time: 50 }, { time: 100 })).toEqual({ trend: 'down', change: 50 });
    expect(digestTrend({ time: 102 }, { time: 100 }).trend).toBe('flat');
    expect(digestTrend({ time: 100 }, { time: 0 }).trend).toBe('new');
  });

  it('builds translatable notification content', () => {
    const summary = {
      start: new Date(),
      end: new Date(),
      xp: 1234.4,
      time: 150,
      readingTime: 150,
      listeningTime: 0,
      chars: 0,
      pages: 0,
      episodes: 0,
      logs: 3,
      activeDays: 2,
      charsPerHour: null,
      achievements: 2,
      byType: [],
    };
    const content = buildDigestNotification({
      frequency: 'weekly',
      current: summary,
      previous: { ...summary, time: 100 },
    });
    expect(content.titleKey).toBe('insights.weeklyTitle');
    expect(content.bodyKey).toBe('insights.trendUp');
    expect(content.meta).toEqual({ hours: '2.5', xp: '1234', change: '50', count: '2' });
    expect(content.body).toContain('2 achievements');
  });
});
