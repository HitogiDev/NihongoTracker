import { Types } from 'mongoose';
import Log from '../models/log.model.js';
import { MediaBase } from '../models/media.model.js';
import { fetchJitenDetail } from './jiten.js';
import { getUserReadingSpeedCph, medianOf } from './xp.js';
import {
  IImmersionForecast,
  IImmersionForecastProgress,
  ImmersionForecastMetric,
  ImmersionForecastTargetSource,
  IMediaDocument,
} from '../types.js';

const DAY_MS = 86_400_000;

type TargetDefinition = {
  metric: ImmersionForecastMetric;
  total: number;
  source: ImmersionForecastTargetSource;
  episodeDuration?: number;
};

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function mediaTitle(media: IMediaDocument): string {
  return (
    media.title.contentTitleNative ||
    media.title.contentTitleRomaji ||
    media.title.contentTitleEnglish ||
    media.contentId
  );
}

export async function resolveForecastTarget(
  mediaId: string,
  mediaType: IMediaDocument['type']
): Promise<{ media: IMediaDocument; target: TargetDefinition } | null> {
  const media = (await MediaBase.findOne({
    contentId: mediaId,
    type: mediaType,
  }).lean()) as IMediaDocument | null;
  if (!media || mediaType === 'video') return null;

  if (mediaType === 'anime' || mediaType === 'tv show') {
    const total = positive(media.episodes);
    if (!total) return null;
    return {
      media,
      target: {
        metric: 'episodes',
        total,
        source: 'media',
        episodeDuration: positive(media.episodeDuration) ?? undefined,
      },
    };
  }

  if (mediaType === 'movie') {
    const total = positive(media.runtime);
    return total
      ? { media, target: { metric: 'minutes', total, source: 'media' } }
      : null;
  }

  const storedCharacters = positive(media.characters);
  if (storedCharacters) {
    return {
      media,
      target: { metric: 'chars', total: storedCharacters, source: 'media' },
    };
  }

  const jitenType = mediaType === 'light-novel' ? 'reading' : mediaType;
  const jiten = await fetchJitenDetail(
    jitenType,
    mediaId,
    media.title.contentTitleNative
  );
  const jitenCharacters = positive(jiten?.data?.mainDeck?.characterCount);
  if (jitenCharacters) {
    return {
      media,
      target: { metric: 'chars', total: jitenCharacters, source: 'jiten' },
    };
  }

  if (mediaType === 'book') {
    const pages = positive(media.pageCount);
    if (pages) {
      return {
        media,
        target: { metric: 'pages', total: pages, source: 'google_books' },
      };
    }
  }

  return null;
}

export async function getForecastProgressTotal(
  userId: Types.ObjectId | string,
  mediaId: string,
  mediaType: string,
  metric: ImmersionForecastMetric,
  now = new Date()
): Promise<number> {
  const field =
    metric === 'chars'
      ? '$chars'
      : metric === 'pages'
        ? '$pages'
        : metric === 'episodes'
          ? '$episodes'
          : '$time';
  const result = await Log.aggregate([
    {
      $match: {
        user: new Types.ObjectId(String(userId)),
        mediaId,
        type: mediaType,
        date: { $lte: now },
      },
    },
    { $group: { _id: null, total: { $sum: { $ifNull: [field, 0] } } } },
  ]);
  return Math.max(0, Number(result[0]?.total ?? 0));
}

export function dateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function dayNumber(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function inclusiveDays(from: string, through: string): number {
  return Math.max(0, dayNumber(through) - dayNumber(from) + 1);
}

async function estimateMinutes(
  forecast: IImmersionForecast,
  remaining: number
): Promise<number | null> {
  if (remaining <= 0) return 0;
  if (forecast.metric === 'minutes') return Math.ceil(remaining);
  if (forecast.metric === 'episodes') {
    return forecast.episodeDuration
      ? Math.ceil(remaining * forecast.episodeDuration)
      : null;
  }
  if (forecast.metric === 'chars') {
    const speed = await getUserReadingSpeedCph(
      forecast.user,
      forecast.mediaType
    );
    return speed ? Math.ceil((remaining / speed) * 60) : null;
  }

  const pageLogs = await Log.find({
    user: forecast.user,
    type: forecast.mediaType,
    pages: { $gt: 0 },
    time: { $gt: 0 },
  })
    .sort({ date: -1 })
    .limit(50)
    .select('pages time')
    .lean();
  const pagesPerHour = medianOf(
    pageLogs.map((log) => ((log.pages as number) / (log.time as number)) * 60)
  );
  return pagesPerHour ? Math.ceil((remaining / pagesPerHour) * 60) : null;
}

export async function calculateImmersionForecast(
  forecast: IImmersionForecast,
  now = new Date()
): Promise<IImmersionForecastProgress> {
  const currentProgress = await getForecastProgressTotal(
    forecast.user,
    forecast.mediaId,
    forecast.mediaType,
    forecast.metric,
    now
  );
  const remaining = Math.max(0, forecast.targetTotal - currentProgress);
  const estimatedMinutes = await estimateMinutes(forecast, remaining);
  return calculateForecastSchedule({
    targetTotal: forecast.targetTotal,
    startingProgress: forecast.startingProgress,
    currentProgress,
    createdAt: forecast.createdAt,
    targetDate: forecast.targetDate,
    timezone: forecast.timezone,
    now,
    estimatedMinutes,
  });
}

export function calculateForecastSchedule({
  targetTotal,
  startingProgress,
  currentProgress,
  createdAt,
  targetDate,
  timezone,
  now,
  estimatedMinutes,
}: {
  targetTotal: number;
  startingProgress: number;
  currentProgress: number;
  createdAt: Date;
  targetDate: Date;
  timezone: string;
  now: Date;
  estimatedMinutes: number | null;
}): IImmersionForecastProgress {
  const remaining = Math.max(0, targetTotal - currentProgress);
  const todayKey = dateKey(now, timezone);
  const targetKey = targetDate.toISOString().slice(0, 10);
  const createdKey = dateKey(createdAt, timezone);
  const remainingDays = inclusiveDays(todayKey, targetKey);
  const requiredPerDay =
    remainingDays > 0 ? Math.ceil(remaining / remainingDays) : 0;

  const totalPlanDays = inclusiveDays(createdKey, targetKey);
  const completedPlanDays = Math.min(
    totalPlanDays,
    Math.max(0, dayNumber(todayKey) - dayNumber(createdKey))
  );
  const plannedAmount = Math.max(0, targetTotal - startingProgress);
  const expectedByToday =
    totalPlanDays > 0
      ? (plannedAmount * completedPlanDays) / totalPlanDays
      : plannedAmount;
  const actualSinceCreation = Math.max(0, currentProgress - startingProgress);
  const behindBy = Math.ceil(Math.max(0, expectedByToday - actualSinceCreation));

  const status =
    remaining === 0
      ? 'completed'
      : remainingDays === 0
        ? 'overdue'
        : behindBy > 0
          ? 'behind'
          : 'on_track';
  return {
    currentProgress,
    remaining,
    percentage: Math.min(100, (currentProgress / targetTotal) * 100),
    remainingDays,
    requiredPerDay,
    behindBy,
    status,
    estimatedMinutes,
    paceStatus:
      estimatedMinutes === null ? 'insufficient_data' : 'available',
  };
}
