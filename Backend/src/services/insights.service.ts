import { PipelineStage, Types } from 'mongoose';
import Log from '../models/log.model.js';
import { MediaBase } from '../models/media.model.js';
import UserAchievement from '../models/userAchievement.model.js';
import { ILog } from '../types.js';
import { effectiveTimeExpression } from './clubLogMetrics.service.js';
import { resolveDayStartHour } from './streaks.js';
import {
  CONSUMED_DIFFICULTY_MIN_HOURS,
  CONSUMED_DIFFICULTY_PERCENTILE,
  CONSUMED_DIFFICULTY_WINDOW_DAYS,
  JITEN_MAX_DIFFICULTY,
  LISTENING_TYPES,
  MIN_PLAUSIBLE_SPEED_CPH,
  READING_TYPES,
  continuousLevel,
  comfortDifficulty,
  effectiveComfort,
  normalizeJitenDifficulty,
  roughLogMinutes,
  weightedPercentile,
} from './xp.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Number of local months in the speed and comfort timelines, including the current month. */
export const INSIGHTS_MONTHS = 12;
/** Length of the two windows that the speed comparison uses. */
export const SPEED_COMPARISON_WINDOW_DAYS = 30;
export const SPEED_COMPARISON_MONTHS = [3, 6, 12] as const;
export type SpeedComparisonMonths = (typeof SPEED_COMPARISON_MONTHS)[number];
/** A bucket needs this much evidence before it shows a speed. */
export const MIN_SPEED_BUCKET_LOGS = 2;
export const MIN_SPEED_BUCKET_MINUTES = 30;
/** Speeds above this value are treated as data entry errors. */
export const MAX_PLAUSIBLE_SPEED_CPH = 60000;
/** Maximum length of one period in the period comparison. */
export const MAX_COMPARISON_PERIOD_DAYS = 731;

export type InsightsCategory = 'reading' | 'listening';

// ─── Time zone helpers ───────────────────────────────────────────────────────

const partFormatters = new Map<string, Intl.DateTimeFormat>();

function partFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = partFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    });
    partFormatters.set(timezone, formatter);
  }
  return formatter;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface ILocalParts {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  hour: number;
  /** 0 (Sunday) to 6. */
  weekday: number;
}

export function localParts(date: Date, timezone: string): ILocalParts {
  const parts = partFormatter(timezone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    weekday: Math.max(0, WEEKDAYS.indexOf(get('weekday'))),
  };
}

function zoneOffsetMs(instant: number, timezone: string): number {
  const parts = partFormatter(timezone).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const wallClock = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  );
  return wallClock - instant;
}

/**
 * Return the UTC instant of local midnight on a calendar day in a time zone.
 * Out-of-range months and days roll over like `Date.UTC`.
 */
export function localMidnightUtc(
  year: number,
  monthIndex: number,
  day: number,
  timezone: string
): Date {
  const guess = Date.UTC(year, monthIndex, day);
  const first = guess - zoneOffsetMs(guess, timezone);
  // Check again, because the offset can differ between the guess and the result.
  return new Date(guess - zoneOffsetMs(first, timezone));
}

/** Local calendar of a user, with the day start hour applied. */
export interface IUserCalendar {
  timezone: string;
  dayStartHour: number;
}

function dayStartMs(calendar: IUserCalendar): number {
  return resolveDayStartHour(calendar.dayStartHour) * HOUR_MS;
}

/** Local day parts of an instant in the user's calendar. */
export function userDayParts(date: Date, calendar: IUserCalendar): ILocalParts {
  return localParts(
    new Date(date.getTime() - dayStartMs(calendar)),
    calendar.timezone
  );
}

/** First instant of a local day in the user's calendar. */
export function userDayStart(
  year: number,
  monthIndex: number,
  day: number,
  calendar: IUserCalendar
): Date {
  return new Date(
    localMidnightUtc(year, monthIndex, day, calendar.timezone).getTime() +
      dayStartMs(calendar)
  );
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export interface IMonthWindow {
  key: string;
  start: Date;
  end: Date;
}

/** The last `count` local months, oldest first. The last month is the current one. */
export function recentMonths(
  now: Date,
  calendar: IUserCalendar,
  count = INSIGHTS_MONTHS
): IMonthWindow[] {
  const today = userDayParts(now, calendar);
  const months: IMonthWindow[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const monthIndex = today.month - 1 - offset;
    const start = userDayStart(today.year, monthIndex, 1, calendar);
    const end = userDayStart(today.year, monthIndex + 1, 1, calendar);
    const normalized = new Date(Date.UTC(today.year, monthIndex, 1));
    months.push({
      key: monthKey(normalized.getUTCFullYear(), normalized.getUTCMonth() + 1),
      start,
      end,
    });
  }
  return months;
}

/**
 * Parse an inclusive local period. Return null for invalid dates, reversed
 * periods, and periods longer than MAX_COMPARISON_PERIOD_DAYS.
 */
export function parseLocalPeriod(
  startValue: unknown,
  endValue: unknown,
  calendar: IUserCalendar
): { start: Date; end: Date; startKey: string; endKey: string; days: number } | null {
  const parse = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    const [year, month, day] = value.split('-').map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.toISOString().slice(0, 10) !== value) return null;
    return { year, month, day, utc: check.getTime() };
  };
  const first = parse(startValue);
  const last = parse(endValue);
  if (!first || !last || last.utc < first.utc) return null;
  const days = Math.round((last.utc - first.utc) / DAY_MS) + 1;
  if (days > MAX_COMPARISON_PERIOD_DAYS) return null;
  return {
    start: userDayStart(first.year, first.month - 1, first.day, calendar),
    end: userDayStart(last.year, last.month - 1, last.day + 1, calendar),
    startKey: startValue as string,
    endKey: endValue as string,
    days,
  };
}

// ─── Reading speed ───────────────────────────────────────────────────────────

export interface IInsightLog {
  date: Date;
  type: ILog['type'];
  time?: number | null;
  chars?: number | null;
  pages?: number | null;
  episodes?: number | null;
  xp?: number | null;
  mediaId?: string | null;
}

interface ISpeedTotals {
  chars: number;
  minutes: number;
  logs: number;
}

export interface ISpeedPoint {
  month: string;
  /** Null when the month has too little evidence. */
  charsPerHour: number | null;
  hours: number;
  logs: number;
}

export interface ISpeedWindow {
  start: Date;
  end: Date;
  charsPerHour: number;
  hours: number;
  logs: number;
}

export interface ISpeedComparison {
  monthsAgo: number;
  current: ISpeedWindow | null;
  previous: ISpeedWindow | null;
  /** Percent change from the previous window to the current window. */
  changePct: number | null;
}

export interface IReadingSpeedInsights {
  overall: ISpeedPoint[];
  byType: {
    type: string;
    points: ISpeedPoint[];
    charsPerHour: number | null;
    comparison: ISpeedComparison;
  }[];
  /** Jiten bands: band N covers difficulty N to N + 1 (band 4 includes 5). */
  byDifficulty: {
    band: number;
    points: ISpeedPoint[];
    charsPerHour: number | null;
    hours: number;
  }[];
  comparison: ISpeedComparison;
}

function emptyTotals(): ISpeedTotals {
  return { chars: 0, minutes: 0, logs: 0 };
}

function addSample(totals: ISpeedTotals, log: IInsightLog): void {
  totals.chars += log.chars ?? 0;
  totals.minutes += log.time ?? 0;
  totals.logs += 1;
}

function speedOf(totals: ISpeedTotals): number | null {
  if (
    totals.logs < MIN_SPEED_BUCKET_LOGS ||
    totals.minutes < MIN_SPEED_BUCKET_MINUTES
  ) {
    return null;
  }
  return Math.round((totals.chars / totals.minutes) * 60);
}

function roundHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

/** Return true for reading logs with chars, time, and a plausible speed. */
export function isSpeedSample(log: IInsightLog): boolean {
  if (!READING_TYPES.includes(log.type)) return false;
  const chars = log.chars ?? 0;
  const time = log.time ?? 0;
  if (chars <= 0 || time <= 0) return false;
  const speed = (chars / time) * 60;
  return speed >= MIN_PLAUSIBLE_SPEED_CPH && speed <= MAX_PLAUSIBLE_SPEED_CPH;
}

export function jitenBand(difficulty: number): number {
  const jiten = (difficulty / 100) * JITEN_MAX_DIFFICULTY;
  return Math.min(JITEN_MAX_DIFFICULTY - 1, Math.max(0, Math.floor(jiten)));
}

function buildPoints(
  logs: IInsightLog[],
  months: IMonthWindow[]
): { points: ISpeedPoint[]; total: ISpeedTotals } {
  const buckets = months.map(() => emptyTotals());
  const total = emptyTotals();
  for (const log of logs) {
    const time = log.date.getTime();
    const index = months.findIndex(
      (month) => time >= month.start.getTime() && time < month.end.getTime()
    );
    if (index !== -1) {
      addSample(buckets[index], log);
      addSample(total, log);
    }
  }
  return {
    points: months.map((month, index) => ({
      month: month.key,
      charsPerHour: speedOf(buckets[index]),
      hours: roundHours(buckets[index].minutes),
      logs: buckets[index].logs,
    })),
    total,
  };
}

function speedWindow(
  logs: IInsightLog[],
  start: Date,
  end: Date
): ISpeedWindow | null {
  const totals = emptyTotals();
  for (const log of logs) {
    if (log.date >= start && log.date < end) addSample(totals, log);
  }
  const charsPerHour = speedOf(totals);
  if (charsPerHour === null) return null;
  return {
    start,
    end,
    charsPerHour,
    hours: roundHours(totals.minutes),
    logs: totals.logs,
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function compareSpeedWindows(
  logs: IInsightLog[],
  now: Date,
  monthsAgo: number
): ISpeedComparison {
  const windowMs = SPEED_COMPARISON_WINDOW_DAYS * DAY_MS;
  const currentStart = new Date(now.getTime() - windowMs);
  const pastCenter = new Date(now);
  pastCenter.setUTCMonth(pastCenter.getUTCMonth() - monthsAgo);
  const previousStart = new Date(pastCenter.getTime() - windowMs / 2);
  const previousEnd = new Date(pastCenter.getTime() + windowMs / 2);

  const current = speedWindow(logs, currentStart, now);
  const previous = speedWindow(logs, previousStart, previousEnd);
  return {
    monthsAgo,
    current,
    previous,
    changePct:
      current && previous
        ? percentChange(current.charsPerHour, previous.charsPerHour)
        : null,
  };
}

/**
 * Build reading speed timelines from logs with chars and time.
 * Speeds weight each log by its time: total chars divided by total hours.
 */
export function buildReadingSpeedInsights(input: {
  logs: IInsightLog[];
  difficultyByMediaId: Map<string, number>;
  months: IMonthWindow[];
  now: Date;
  compareMonths: number;
}): IReadingSpeedInsights {
  const samples = input.logs.filter(isSpeedSample);
  const overall = buildPoints(samples, input.months);

  const types = Array.from(new Set(samples.map((log) => log.type)));
  const byType = types
    .map((type) => {
      const typeLogs = samples.filter((log) => log.type === type);
      const built = buildPoints(typeLogs, input.months);
      return {
        type,
        points: built.points,
        charsPerHour: speedOf(built.total),
        comparison: compareSpeedWindows(typeLogs, input.now, input.compareMonths),
        minutes: built.total.minutes,
      };
    })
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .map((entry) => ({
      type: entry.type,
      points: entry.points,
      charsPerHour: entry.charsPerHour,
      comparison: entry.comparison,
    }));

  const byBand = new Map<number, IInsightLog[]>();
  for (const log of samples) {
    const difficulty = log.mediaId
      ? input.difficultyByMediaId.get(log.mediaId)
      : undefined;
    if (difficulty === undefined) continue;
    const band = jitenBand(difficulty);
    const list = byBand.get(band) ?? [];
    list.push(log);
    byBand.set(band, list);
  }
  const byDifficulty = Array.from(byBand.entries())
    .sort(([a], [b]) => a - b)
    .map(([band, bandLogs]) => {
      const built = buildPoints(bandLogs, input.months);
      return {
        band,
        points: built.points,
        charsPerHour: speedOf(built.total),
        hours: roundHours(built.total.minutes),
      };
    })
    .filter((entry) => entry.hours > 0);

  return {
    overall: overall.points,
    byType,
    byDifficulty,
    comparison: compareSpeedWindows(samples, input.now, input.compareMonths),
  };
}

// ─── Comfort difficulty ──────────────────────────────────────────────────────

export interface IComfortPoint {
  month: string;
  /** Effective comfort on the Jiten scale (0 to 5) at the end of the month. */
  comfort: number;
  /** Comfort from the category level alone, on the Jiten scale. */
  levelComfort: number;
  /** Hours-weighted median of the 90 days before the month end. Null without enough tagged hours. */
  recentDifficulty: number | null;
  /** Hours-weighted median of the difficulty consumed in the month. */
  monthDifficulty: number | null;
  taggedHours: number;
}

export interface IComfortTimeline {
  category: InsightsCategory;
  points: IComfortPoint[];
  current: IComfortPoint | null;
  /** Comfort change in Jiten points from the first month to the current month. */
  change: number | null;
}

function toJiten(value: number): number {
  return Math.round((value / 100) * JITEN_MAX_DIFFICULTY * 100) / 100;
}

interface IDifficultySample {
  time: number;
  value: number;
  weight: number;
}

function difficultySamples(
  logs: IInsightLog[],
  types: ILog['type'][],
  difficultyByMediaId: Map<string, number>
): IDifficultySample[] {
  const samples: IDifficultySample[] = [];
  for (const log of logs) {
    if (!types.includes(log.type) || !log.mediaId) continue;
    const difficulty = difficultyByMediaId.get(log.mediaId);
    if (difficulty === undefined) continue;
    const hours = roughLogMinutes(log) / 60;
    if (hours > 0) {
      samples.push({ time: log.date.getTime(), value: difficulty, weight: hours });
    }
  }
  return samples;
}

function medianBetween(
  samples: IDifficultySample[],
  start: number,
  end: number,
  minHours: number
): { median: number | null; hours: number } {
  const inRange = samples.filter((s) => s.time >= start && s.time < end);
  const hours = inRange.reduce((sum, s) => sum + s.weight, 0);
  if (hours <= 0 || hours < minHours) return { median: null, hours };
  return {
    median: weightedPercentile(inRange, CONSUMED_DIFFICULTY_PERCENTILE),
    hours,
  };
}

/**
 * Rebuild the effective comfort at the end of each month.
 * The category XP at a past instant is the current XP minus the log XP after it.
 * The formula matches `effectiveComfort` in services/xp.ts.
 */
export function buildComfortTimeline(input: {
  category: InsightsCategory;
  logs: IInsightLog[];
  difficultyByMediaId: Map<string, number>;
  months: IMonthWindow[];
  currentCategoryXp: number;
  now: Date;
}): IComfortTimeline {
  const types = input.category === 'reading' ? READING_TYPES : LISTENING_TYPES;
  const categoryLogs = input.logs.filter((log) => types.includes(log.type));
  const samples = difficultySamples(
    categoryLogs,
    types,
    input.difficultyByMediaId
  );
  const windowMs = CONSUMED_DIFFICULTY_WINDOW_DAYS * DAY_MS;

  const points = input.months.map((month) => {
    const endMs = Math.min(month.end.getTime(), input.now.getTime());
    const xpAfter = categoryLogs.reduce(
      (sum, log) => (log.date.getTime() >= endMs ? sum + (log.xp ?? 0) : sum),
      0
    );
    const xpAtEnd = Math.max(0, input.currentCategoryXp - xpAfter);
    const level = continuousLevel(xpAtEnd);
    const recent = medianBetween(
      samples,
      endMs - windowMs,
      endMs,
      CONSUMED_DIFFICULTY_MIN_HOURS
    );
    const monthOnly = medianBetween(samples, month.start.getTime(), endMs, 1);
    return {
      month: month.key,
      comfort: toJiten(effectiveComfort(level, recent.median)),
      levelComfort: toJiten(comfortDifficulty(level)),
      recentDifficulty: recent.median === null ? null : toJiten(recent.median),
      monthDifficulty:
        monthOnly.median === null ? null : toJiten(monthOnly.median),
      taggedHours: Math.round(monthOnly.hours * 10) / 10,
    };
  });

  const current = points.length ? points[points.length - 1] : null;
  const first = points.find((point) => point.levelComfort > 0) ?? null;
  return {
    category: input.category,
    points,
    current,
    change:
      current && first
        ? Math.round((current.comfort - first.comfort) * 100) / 100
        : null,
  };
}

// ─── Loading ─────────────────────────────────────────────────────────────────

export interface IInsightsUser {
  _id: Types.ObjectId;
  stats?: { readingXp?: number; listeningXp?: number } | null;
  settings?: { timezone?: string; dayStartHour?: number } | null;
}

export function userCalendar(user: IInsightsUser): IUserCalendar {
  return {
    timezone: user.settings?.timezone || 'UTC',
    dayStartHour: resolveDayStartHour(user.settings?.dayStartHour),
  };
}

async function loadDifficulties(
  mediaIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!mediaIds.length) return map;
  const medias = await MediaBase.find({
    contentId: { $in: mediaIds },
    jitenDifficulty: { $ne: null },
  })
    .select('contentId jitenDifficulty')
    .lean();
  for (const media of medias) {
    const normalized = normalizeJitenDifficulty(media.jitenDifficulty);
    if (normalized !== null) map.set(media.contentId, normalized);
  }
  return map;
}

export async function getUserInsights(input: {
  user: IInsightsUser;
  compareMonths: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const calendar = userCalendar(input.user);
  const months = recentMonths(now, calendar);
  // Include the comfort window before the first month and the oldest comparison window.
  const earliest = Math.min(
    months[0].start.getTime() - CONSUMED_DIFFICULTY_WINDOW_DAYS * DAY_MS,
    now.getTime() - (input.compareMonths * 31 + SPEED_COMPARISON_WINDOW_DAYS) * DAY_MS
  );

  const logs = (await Log.find({
    user: input.user._id,
    date: { $gte: new Date(earliest) },
    type: { $in: [...READING_TYPES, ...LISTENING_TYPES] },
  })
    .select('date type time chars pages episodes xp mediaId')
    .lean()) as unknown as IInsightLog[];

  // Comfort needs the XP of every log after the first month end, which the query already covers.
  const mediaIds = Array.from(
    new Set(logs.map((log) => log.mediaId).filter((id): id is string => !!id))
  );
  const difficultyByMediaId = await loadDifficulties(mediaIds);

  return {
    generatedAt: now,
    months: months.map((month) => month.key),
    readingSpeed: buildReadingSpeedInsights({
      logs,
      difficultyByMediaId,
      months,
      now,
      compareMonths: input.compareMonths,
    }),
    comfort: (['reading', 'listening'] as const).map((category) =>
      buildComfortTimeline({
        category,
        logs,
        difficultyByMediaId,
        months,
        currentCategoryXp:
          (category === 'reading'
            ? input.user.stats?.readingXp
            : input.user.stats?.listeningXp) ?? 0,
        now,
      })
    ),
  };
}

// ─── Period summaries ────────────────────────────────────────────────────────

export interface IPeriodTypeSummary {
  type: string;
  time: number;
  xp: number;
  logs: number;
  chars: number;
  pages: number;
  episodes: number;
}

export interface IPeriodSummary {
  start: Date;
  end: Date;
  xp: number;
  /** Minutes, with anime episodes without time counted at 24 minutes. */
  time: number;
  readingTime: number;
  listeningTime: number;
  chars: number;
  pages: number;
  episodes: number;
  logs: number;
  activeDays: number;
  charsPerHour: number | null;
  achievements: number;
  byType: IPeriodTypeSummary[];
}

interface IPeriodFacet {
  totals: {
    xp: number;
    time: number;
    readingTime: number;
    listeningTime: number;
    chars: number;
    pages: number;
    episodes: number;
    logs: number;
    speedChars: number;
    speedTime: number;
    speedLogs: number;
  }[];
  days: { _id: string }[];
  types: (IPeriodTypeSummary & { _id: string })[];
}

/** Summarize all logs of a user in a period, including private logs. */
export async function getPeriodSummary(
  userId: Types.ObjectId,
  start: Date,
  end: Date,
  calendar: IUserCalendar
): Promise<IPeriodSummary> {
  const shiftMs = dayStartMs(calendar);
  const speedCondition = {
    $and: [
      { $in: ['$type', READING_TYPES] },
      { $gt: ['$chars', 0] },
      { $gt: ['$time', 0] },
    ],
  };
  const facet: PipelineStage = {
    $facet: {
      totals: [
        {
          $group: {
            _id: null,
            xp: { $sum: { $ifNull: ['$xp', 0] } },
            time: { $sum: effectiveTimeExpression },
            readingTime: {
              $sum: {
                $cond: [{ $in: ['$type', READING_TYPES] }, effectiveTimeExpression, 0],
              },
            },
            listeningTime: {
              $sum: {
                $cond: [
                  { $in: ['$type', LISTENING_TYPES] },
                  effectiveTimeExpression,
                  0,
                ],
              },
            },
            chars: { $sum: { $ifNull: ['$chars', 0] } },
            pages: { $sum: { $ifNull: ['$pages', 0] } },
            episodes: { $sum: { $ifNull: ['$episodes', 0] } },
            logs: { $sum: 1 },
            speedChars: { $sum: { $cond: [speedCondition, '$chars', 0] } },
            speedTime: { $sum: { $cond: [speedCondition, '$time', 0] } },
            speedLogs: { $sum: { $cond: [speedCondition, 1, 0] } },
          },
        },
      ],
      days: [
        {
          $group: {
            _id: {
              $dateToString: {
                date:
                  shiftMs > 0 ? { $subtract: ['$date', shiftMs] } : '$date',
                format: '%Y-%m-%d',
                timezone: calendar.timezone,
              },
            },
          },
        },
      ],
      types: [
        {
          $group: {
            _id: '$type',
            time: { $sum: effectiveTimeExpression },
            xp: { $sum: { $ifNull: ['$xp', 0] } },
            logs: { $sum: 1 },
            chars: { $sum: { $ifNull: ['$chars', 0] } },
            pages: { $sum: { $ifNull: ['$pages', 0] } },
            episodes: { $sum: { $ifNull: ['$episodes', 0] } },
          },
        },
      ],
    },
  };

  const [[result], achievements] = await Promise.all([
    Log.aggregate<IPeriodFacet>([
      { $match: { user: userId, date: { $gte: start, $lt: end } } },
      facet,
    ]),
    UserAchievement.countDocuments({
      user: userId,
      unlockedAt: { $gte: start, $lt: end },
    }),
  ]);

  const totals = result?.totals[0];
  const speed = totals
    ? speedOf({
        chars: totals.speedChars,
        minutes: totals.speedTime,
        logs: totals.speedLogs,
      })
    : null;

  return {
    start,
    end,
    xp: totals?.xp ?? 0,
    time: Math.round(totals?.time ?? 0),
    readingTime: Math.round(totals?.readingTime ?? 0),
    listeningTime: Math.round(totals?.listeningTime ?? 0),
    chars: totals?.chars ?? 0,
    pages: totals?.pages ?? 0,
    episodes: totals?.episodes ?? 0,
    logs: totals?.logs ?? 0,
    activeDays: result?.days.length ?? 0,
    charsPerHour: speed,
    achievements,
    byType: (result?.types ?? [])
      .map(({ _id, ...entry }) => ({ ...entry, type: _id, time: Math.round(entry.time) }))
      .sort((a, b) => b.time - a.time),
  };
}
