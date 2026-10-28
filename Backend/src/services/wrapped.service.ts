import { PipelineStage, Types } from 'mongoose';
import Log from '../models/log.model.js';
import { MediaBase } from '../models/media.model.js';
import MediaReview from '../models/mediaReview.model.js';
import RankSnapshot from '../models/rankSnapshot.model.js';
import UserAchievement from '../models/userAchievement.model.js';
import UserMediaStatus from '../models/userMediaStatus.model.js';
import { calculateLevel } from './calculateLevel.js';
import { effectiveTimeExpression } from './clubLogMetrics.service.js';
import { LISTENING_TYPES, READING_TYPES } from './xp.js';

const TOP_MEDIA_LIMIT = 5;
const TOP_GENRE_LIMIT = 14;
/** Media documents read for genres. The rest of the year has little weight. */
const GENRE_MEDIA_LIMIT = 300;
const PERCENTILE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const WATCH_TYPES = ['anime', 'tv show', 'movie'];
const READ_TYPES = ['manga', 'light-novel', 'vn', 'game'];
/** Log types that link to a media document. Video links to channels, so it is left out. */
const MEDIA_TYPES = [...WATCH_TYPES, ...READ_TYPES];

export interface WrappedMedia {
  mediaId: string;
  type: string;
  title: unknown;
  contentImage?: string;
  isAdult: boolean;
  isAdultImage: boolean;
  time: number;
  xp: number;
}

export interface WrappedStats {
  year: number;
  timezone: string;
  availableYears: number[];
  daysInYear: number;
  totals: {
    logs: number;
    xp: number;
    time: number;
    readingTime: number;
    listeningTime: number;
    chars: number;
    episodes: number;
    pages: number;
  };
  previousYear: { xp: number; time: number } | null;
  daysActive: number;
  longestStreak: number;
  mostActiveDay: { date: string; time: number; xp: number } | null;
  peakHour: number | null;
  peakWeekday: number | null;
  /** `types` maps each log type to its minutes in the month. */
  monthly: {
    month: number;
    time: number;
    xp: number;
    types: Record<string, number>;
  }[];
  monthsActive: number;
  byType: {
    type: string;
    time: number;
    xp: number;
    logs: number;
    chars: number;
    pages: number;
    episodes: number;
  }[];
  level: { start: number; end: number };
  ranking: RankingSummary | null;
  topWatched: WrappedMedia[];
  topRead: WrappedMedia[];
  firstMedia: WrappedMedia | null;
  lastMedia: WrappedMedia | null;
  genres: { genre: string; time: number }[];
  completed: { total: number; byType: Record<string, number> };
  achievementsUnlocked: number;
  reviewsWritten: number;
  /** Share of active users with less XP this year, from 0 to 100. */
  percentile: number | null;
}

/** Return the UTC instant of local midnight on January 1 in a time zone. */
export function startOfYearInZone(year: number, timezone: string): Date {
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(new Date(instant));
    const get = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const wallClock = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second')
    );
    return wallClock - instant;
  };
  const guess = Date.UTC(year, 0, 1);
  const first = guess - offsetAt(guess);
  // Check again, because the offset can differ between the guess and the result.
  return new Date(guess - offsetAt(first));
}

/** Return the longest run of consecutive `YYYY-MM-DD` days. */
export function longestDayStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let current = 0;
  let previous: number | null = null;
  for (const day of sorted) {
    const value = Date.parse(`${day}T00:00:00Z`);
    current =
      previous !== null && value - previous === 86_400_000 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = value;
  }
  return best;
}

/** Return the share of values below `value`, from 0 to 100. */
export function percentileOf(
  sortedAscending: number[],
  value: number
): number | null {
  if (sortedAscending.length === 0 || value <= 0) return null;
  let low = 0;
  let high = sortedAscending.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (sortedAscending[middle] < value) low = middle + 1;
    else high = middle;
  }
  return Math.round((low / sortedAscending.length) * 1000) / 10;
}

export interface RankingSummary {
  /** Best final monthly position and its month (1 to 12). */
  bestMonthly: { position: number; month: number } | null;
  /** Months (1 to 12) that ended with the user at position 1. */
  firstPlaceMonths: number[];
  globalStart: number | null;
  globalEnd: number | null;
}

/**
 * Summarize the weekly rank snapshots of one year.
 * The last snapshot of each UTC month holds the final monthly position for that month.
 * `before` is the last snapshot before the year. It gives the global start position.
 */
export function summarizeRankSnapshots(
  snapshots: { date: Date; globalPosition: number; monthlyPosition: number }[],
  year: number,
  before?: { globalPosition: number } | null
): RankingSummary | null {
  const inYear = snapshots
    .filter((snapshot) => snapshot.date.getUTCFullYear() === year)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (inYear.length === 0) return null;
  const finalByMonth = new Map<number, number>();
  for (const snapshot of inYear) {
    finalByMonth.set(snapshot.date.getUTCMonth() + 1, snapshot.monthlyPosition);
  }
  let bestMonthly: RankingSummary['bestMonthly'] = null;
  for (const [month, position] of finalByMonth) {
    if (position > 0 && (!bestMonthly || position < bestMonthly.position)) {
      bestMonthly = { position, month };
    }
  }
  return {
    bestMonthly,
    firstPlaceMonths: [...finalByMonth]
      .filter(([, position]) => position === 1)
      .map(([month]) => month),
    globalStart: before?.globalPosition ?? inYear[0].globalPosition,
    globalEnd: inYear[inYear.length - 1].globalPosition,
  };
}

const percentileCache = new Map<
  string,
  { expiresAt: number; values: Promise<number[]> }
>();

/** Return the sorted XP totals of every user with public logs in the range. */
function yearlyXpDistribution(year: number, start: Date, end: Date) {
  const key = String(year);
  const cached = percentileCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.values;
  const values = Log.aggregate<{ xp: number }>([
    { $match: { date: { $gte: start, $lt: end }, private: { $ne: true } } },
    { $group: { _id: '$user', xp: { $sum: { $ifNull: ['$xp', 0] } } } },
    { $match: { xp: { $gt: 0 } } },
    { $project: { _id: 0, xp: 1 } },
  ])
    .allowDiskUse(true)
    .then((rows) => rows.map((row) => row.xp).sort((a, b) => a - b))
    .catch((error) => {
      percentileCache.delete(key);
      throw error;
    });
  percentileCache.set(key, {
    expiresAt: Date.now() + PERCENTILE_CACHE_TTL_MS,
    values,
  });
  return values;
}

interface MediaGroup {
  _id: { mediaId: string; type: string };
  time: number;
  xp: number;
  firstDate: Date;
  lastDate: Date;
}

interface FacetResult {
  totals: (WrappedStats['totals'] & { _id: null })[];
  days: { _id: string; time: number; xp: number }[];
  months: { _id: { month: number; type: string }; time: number; xp: number }[];
  hours: { _id: number; time: number }[];
  weekdays: { _id: number; time: number }[];
  types: {
    _id: string;
    time: number;
    xp: number;
    logs: number;
    chars: number;
    pages: number;
    episodes: number;
  }[];
  media: MediaGroup[];
}

function peakKey(rows: { _id: number; time: number }[]): number | null {
  const best = rows.reduce<{ _id: number; time: number } | null>(
    (top, row) => (!top || row.time > top.time ? row : top),
    null
  );
  return best && best.time > 0 ? best._id : null;
}

export async function getWrappedStats(input: {
  userId: Types.ObjectId;
  year: number;
  timezone: string;
  includePrivate: boolean;
  /** Current total XP of the user. It also counts manual immersion outside logs. */
  currentXp: number;
  now?: Date;
}): Promise<WrappedStats> {
  const { userId, year, timezone } = input;
  const now = input.now ?? new Date();
  const start = startOfYearInZone(year, timezone);
  const end = startOfYearInZone(year + 1, timezone);
  const previousStart = startOfYearInZone(year - 1, timezone);
  const privacy = input.includePrivate ? {} : { private: { $ne: true } };
  const yearMatch = {
    user: userId,
    date: { $gte: start, $lt: end },
    ...privacy,
  };
  const local = (format: string) => ({
    $dateToString: { date: '$date', format, timezone },
  });

  const facet: PipelineStage = {
    $facet: {
      totals: [
        {
          $group: {
            _id: null,
            logs: { $sum: 1 },
            xp: { $sum: { $ifNull: ['$xp', 0] } },
            time: { $sum: effectiveTimeExpression },
            readingTime: {
              $sum: {
                $cond: [
                  { $in: ['$type', READING_TYPES] },
                  effectiveTimeExpression,
                  0,
                ],
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
            episodes: { $sum: { $ifNull: ['$episodes', 0] } },
            pages: { $sum: { $ifNull: ['$pages', 0] } },
          },
        },
      ],
      days: [
        {
          $group: {
            _id: local('%Y-%m-%d'),
            time: { $sum: effectiveTimeExpression },
            xp: { $sum: { $ifNull: ['$xp', 0] } },
          },
        },
      ],
      months: [
        {
          $group: {
            _id: { month: { $toInt: local('%m') }, type: '$type' },
            time: { $sum: effectiveTimeExpression },
            xp: { $sum: { $ifNull: ['$xp', 0] } },
          },
        },
      ],
      hours: [
        { $match: { unknownDate: { $ne: true } } },
        {
          $group: {
            _id: { $toInt: local('%H') },
            time: { $sum: effectiveTimeExpression },
          },
        },
      ],
      weekdays: [
        // MongoDB numbers weekdays from 1 (Sunday) to 7. Shift them to the JavaScript range 0 to 6.
        {
          $group: {
            _id: { $subtract: [{ $toInt: local('%w') }, 1] },
            time: { $sum: effectiveTimeExpression },
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
      media: [
        {
          $match: { mediaId: { $nin: [null, ''] }, type: { $in: MEDIA_TYPES } },
        },
        {
          $group: {
            _id: { mediaId: '$mediaId', type: '$type' },
            time: { $sum: effectiveTimeExpression },
            xp: { $sum: { $ifNull: ['$xp', 0] } },
            firstDate: { $min: '$date' },
            lastDate: { $max: '$date' },
          },
        },
      ],
    },
  };

  const [
    [result],
    xpSince,
    snapshots,
    snapshotBefore,
    previous,
    firstLog,
    completedRows,
    achievementsUnlocked,
    reviewsWritten,
  ] = await Promise.all([
    Log.aggregate<FacetResult>([{ $match: yearMatch }, facet]),
    // Count private logs for the level history, because they also give XP.
    Log.aggregate<{ sinceStart: number; sinceEnd: number }>([
      { $match: { user: userId, date: { $gte: start } } },
      {
        $group: {
          _id: null,
          sinceStart: { $sum: { $ifNull: ['$xp', 0] } },
          sinceEnd: {
            $sum: {
              $cond: [{ $gte: ['$date', end] }, { $ifNull: ['$xp', 0] }, 0],
            },
          },
        },
      },
    ]),
    RankSnapshot.find({ userId, date: { $gte: start, $lt: end } })
      .select('date globalPosition monthlyPosition')
      .lean(),
    RankSnapshot.findOne({ userId, date: { $lt: start } })
      .sort({ date: -1 })
      .select('globalPosition')
      .lean(),
    Log.aggregate<{ xp: number; time: number }>([
      {
        $match: {
          user: userId,
          date: { $gte: previousStart, $lt: start },
          ...privacy,
        },
      },
      {
        $group: {
          _id: null,
          xp: { $sum: { $ifNull: ['$xp', 0] } },
          time: { $sum: effectiveTimeExpression },
        },
      },
    ]),
    Log.findOne({ user: userId, ...privacy })
      .sort({ date: 1 })
      .select('date')
      .lean(),
    UserMediaStatus.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          user: userId,
          completed: true,
          completedAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    UserAchievement.countDocuments({
      user: userId,
      unlockedAt: { $gte: start, $lt: end },
    }),
    MediaReview.countDocuments({
      user: userId,
      createdAt: { $gte: start, $lt: end },
    }),
  ]);

  const byTime = (a: MediaGroup, b: MediaGroup) =>
    b.time - a.time || b.xp - a.xp;
  const media = [...result.media].sort(byTime);
  const topWatchedGroups = media
    .filter((m) => WATCH_TYPES.includes(m._id.type))
    .slice(0, TOP_MEDIA_LIMIT * 2);
  const topReadGroups = media
    .filter((m) => READ_TYPES.includes(m._id.type))
    .slice(0, TOP_MEDIA_LIMIT * 2);
  // Take extra candidates, because some logs link to media without a document.
  const DATE_CANDIDATES = 10;
  const earliest = [...media]
    .sort((a, b) => a.firstDate.getTime() - b.firstDate.getTime())
    .slice(0, DATE_CANDIDATES);
  const latest = [...media]
    .sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime())
    .slice(0, DATE_CANDIDATES);
  const genreGroups = media.slice(0, GENRE_MEDIA_LIMIT);

  const lookupGroups = [
    ...new Map(
      [
        ...genreGroups,
        ...topWatchedGroups,
        ...topReadGroups,
        ...earliest,
        ...latest,
      ].map((m) => [`${m._id.type}:${m._id.mediaId}`, m])
    ).values(),
  ];
  const docs = lookupGroups.length
    ? await MediaBase.find({
        $or: lookupGroups.map((m) => ({
          contentId: m._id.mediaId,
          type: m._id.type,
        })),
      })
        .select('contentId type title contentImage genres isAdult isAdultImage')
        .lean()
    : [];
  const docByKey = new Map(
    docs.map((doc) => [`${doc.type}:${doc.contentId}`, doc])
  );
  const toMedia = (group: MediaGroup | null): WrappedMedia | null => {
    if (!group) return null;
    const doc = docByKey.get(`${group._id.type}:${group._id.mediaId}`);
    if (!doc) return null;
    return {
      mediaId: group._id.mediaId,
      type: group._id.type,
      title: doc.title,
      contentImage: doc.contentImage ?? undefined,
      isAdult: doc.isAdult === true,
      isAdultImage: doc.isAdultImage === true,
      time: Math.round(group.time),
      xp: Math.round(group.xp),
    };
  };
  const toMediaList = (groups: MediaGroup[]) =>
    groups
      .map(toMedia)
      .filter((m): m is WrappedMedia => m !== null)
      .slice(0, TOP_MEDIA_LIMIT);
  const firstWithDocument = (groups: MediaGroup[]) =>
    groups.map(toMedia).find((m): m is WrappedMedia => m !== null) ?? null;

  const genreTime = new Map<string, number>();
  for (const group of genreGroups) {
    const doc = docByKey.get(`${group._id.type}:${group._id.mediaId}`);
    for (const genre of doc?.genres ?? []) {
      genreTime.set(genre, (genreTime.get(genre) ?? 0) + group.time);
    }
  }

  const days = result.days.filter((day) => day.time > 0 || day.xp > 0);
  const mostActive = days.reduce<FacetResult['days'][number] | null>(
    (best, day) =>
      !best ||
      day.time > best.time ||
      (day.time === best.time && day.xp > best.xp)
        ? day
        : best,
    null
  );
  const totals = result.totals[0];
  const yearXp = totals?.xp ?? 0;
  const percentile =
    yearXp > 0
      ? percentileOf(await yearlyXpDistribution(year, start, end), yearXp)
      : null;

  const firstYear = firstLog?.date
    ? Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
        }).format(firstLog.date)
      )
    : year;
  const currentYear = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
    }).format(now)
  );
  const availableYears: number[] = [];
  for (let y = currentYear; y >= Math.min(firstYear, currentYear); y -= 1)
    availableYears.push(y);

  const monthly = Array.from({ length: 12 }, (_, index) => {
    const rows = result.months.filter((row) => row._id.month === index + 1);
    return {
      month: index + 1,
      time: Math.round(rows.reduce((sum, row) => sum + row.time, 0)),
      xp: Math.round(rows.reduce((sum, row) => sum + row.xp, 0)),
      types: Object.fromEntries(
        rows
          .filter((row) => row.time > 0)
          .map((row) => [row._id.type, Math.round(row.time)])
      ),
    };
  });

  const completedByType = Object.fromEntries(
    completedRows.map((row) => [row._id, row.count])
  );

  return {
    year,
    timezone,
    availableYears,
    daysInYear: Math.round((end.getTime() - start.getTime()) / 86_400_000),
    totals: {
      logs: totals?.logs ?? 0,
      xp: Math.round(yearXp),
      time: Math.round(totals?.time ?? 0),
      readingTime: Math.round(totals?.readingTime ?? 0),
      listeningTime: Math.round(totals?.listeningTime ?? 0),
      chars: totals?.chars ?? 0,
      episodes: totals?.episodes ?? 0,
      pages: totals?.pages ?? 0,
    },
    previousYear: previous[0]
      ? { xp: Math.round(previous[0].xp), time: Math.round(previous[0].time) }
      : null,
    daysActive: days.length,
    longestStreak: longestDayStreak(days.map((day) => day._id)),
    mostActiveDay: mostActive
      ? {
          date: mostActive._id,
          time: Math.round(mostActive.time),
          xp: Math.round(mostActive.xp),
        }
      : null,
    peakHour: peakKey(result.hours),
    peakWeekday: peakKey(result.weekdays),
    monthly,
    monthsActive: monthly.filter((month) => month.time > 0 || month.xp > 0)
      .length,
    level: {
      start: Math.max(
        1,
        calculateLevel(
          Math.max(0, input.currentXp - (xpSince[0]?.sinceStart ?? 0))
        )
      ),
      end: Math.max(
        1,
        calculateLevel(
          Math.max(0, input.currentXp - (xpSince[0]?.sinceEnd ?? 0))
        )
      ),
    },
    ranking: summarizeRankSnapshots(snapshots, year, snapshotBefore),
    byType: result.types
      .map((row) => ({
        chars: row.chars,
        pages: row.pages,
        episodes: row.episodes,
        type: row._id,
        time: Math.round(row.time),
        xp: Math.round(row.xp),
        logs: row.logs,
      }))
      .sort((a, b) => b.time - a.time || b.xp - a.xp),
    topWatched: toMediaList(topWatchedGroups),
    topRead: toMediaList(topReadGroups),
    firstMedia: firstWithDocument(earliest),
    lastMedia: firstWithDocument(latest),
    genres: [...genreTime.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_GENRE_LIMIT)
      .map(([genre, time]) => ({ genre, time: Math.round(time) })),
    completed: {
      total: completedRows.reduce((sum, row) => sum + row.count, 0),
      byType: completedByType,
    },
    achievementsUnlocked,
    reviewsWritten,
    percentile,
  };
}
