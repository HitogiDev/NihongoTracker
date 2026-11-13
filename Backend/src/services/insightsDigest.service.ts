import { Types } from 'mongoose';
import User from '../models/user.model.js';
import { userRoles } from '../types.js';
import { createNotification } from './notifications.service.js';
import {
  IPeriodSummary,
  IUserCalendar,
  dayKey,
  getPeriodSummary,
  localParts,
  monthKey,
  percentChange,
  userCalendar,
  userDayParts,
  userDayStart,
} from './insights.service.js';

export type DigestFrequency = 'weekly' | 'monthly';

/** Local hour after which a finished period sends its digest. */
export const DIGEST_LOCAL_HOUR = 9;
/** Changes smaller than this percentage count as flat. */
export const DIGEST_FLAT_THRESHOLD_PCT = 5;
const DIGEST_EXPIRY_DAYS = 60;

export interface IDigestPeriod {
  key: string;
  start: Date;
  end: Date;
  previousStart: Date;
}

/** The last finished week, and the week before it, in the user's calendar. */
export function lastFinishedWeek(
  now: Date,
  calendar: IUserCalendar,
  weekStartsOn: number
): IDigestPeriod {
  const today = userDayParts(now, calendar);
  const offset = (today.weekday - weekStartsOn + 7) % 7;
  const currentStartDay = today.day - offset;
  const start = userDayStart(today.year, today.month - 1, currentStartDay - 7, calendar);
  const keyDate = new Date(Date.UTC(today.year, today.month - 1, currentStartDay - 7));
  return {
    key: dayKey(
      keyDate.getUTCFullYear(),
      keyDate.getUTCMonth() + 1,
      keyDate.getUTCDate()
    ),
    start,
    end: userDayStart(today.year, today.month - 1, currentStartDay, calendar),
    previousStart: userDayStart(
      today.year,
      today.month - 1,
      currentStartDay - 14,
      calendar
    ),
  };
}

/** The last finished month, and the month before it, in the user's calendar. */
export function lastFinishedMonth(
  now: Date,
  calendar: IUserCalendar
): IDigestPeriod {
  const today = userDayParts(now, calendar);
  const keyDate = new Date(Date.UTC(today.year, today.month - 2, 1));
  return {
    key: monthKey(keyDate.getUTCFullYear(), keyDate.getUTCMonth() + 1),
    start: userDayStart(today.year, today.month - 2, 1, calendar),
    end: userDayStart(today.year, today.month - 1, 1, calendar),
    previousStart: userDayStart(today.year, today.month - 3, 1, calendar),
  };
}

export type DigestTrend = 'up' | 'down' | 'flat' | 'new';

export function digestTrend(
  current: Pick<IPeriodSummary, 'time'>,
  previous: Pick<IPeriodSummary, 'time'>
): { trend: DigestTrend; change: number } {
  const change = percentChange(current.time, previous.time);
  if (change === null) return { trend: 'new', change: 0 };
  if (Math.abs(change) < DIGEST_FLAT_THRESHOLD_PCT) {
    return { trend: 'flat', change: Math.abs(Math.round(change)) };
  }
  return {
    trend: change > 0 ? 'up' : 'down',
    change: Math.abs(Math.round(change)),
  };
}

const TREND_TEXT: Record<DigestTrend, (change: number) => string> = {
  up: (change) => `${change}% more immersion than the period before.`,
  down: (change) => `${change}% less immersion than the period before.`,
  flat: () => 'About the same immersion as the period before.',
  new: () => 'A fresh start. Keep it going!',
};

const TREND_KEYS: Record<DigestTrend, string> = {
  up: 'insights.trendUp',
  down: 'insights.trendDown',
  flat: 'insights.trendFlat',
  new: 'insights.trendNew',
};

export function buildDigestNotification(input: {
  frequency: DigestFrequency;
  current: IPeriodSummary;
  previous: IPeriodSummary;
}) {
  const { trend, change } = digestTrend(input.current, input.previous);
  const hours = (Math.round((input.current.time / 60) * 10) / 10).toString();
  const xp = String(Math.round(input.current.xp));
  const achievements = input.current.achievements;
  const periodLabel = input.frequency === 'weekly' ? 'week' : 'month';
  let achievementText = '';
  if (achievements === 1) achievementText = ' You unlocked 1 achievement.';
  if (achievements > 1) {
    achievementText = ` You unlocked ${achievements} achievements.`;
  }
  return {
    title: `Your ${periodLabel}: ${hours} h of immersion and ${xp} XP`,
    titleKey:
      input.frequency === 'weekly' ? 'insights.weeklyTitle' : 'insights.monthlyTitle',
    body: `${TREND_TEXT[trend](change)}${achievementText}`,
    bodyKey: TREND_KEYS[trend],
    meta: {
      hours,
      xp,
      change: String(change),
      count: String(achievements),
    },
  };
}

interface IDigestUser {
  _id: Types.ObjectId;
  username: string;
  roles?: string[];
  patreon?: { tier?: string | null; isActive?: boolean } | null;
  stats?: { readingXp?: number; listeningXp?: number } | null;
  settings?: {
    timezone?: string;
    dayStartHour?: number;
    weekStartsOn?: number;
    insightsDigest?: {
      weekly?: boolean;
      monthly?: boolean;
      lastWeeklyKey?: string | null;
      lastMonthlyKey?: string | null;
    } | null;
  } | null;
}

async function sendDigest(
  user: IDigestUser,
  frequency: DigestFrequency,
  period: IDigestPeriod,
  calendar: IUserCalendar
): Promise<boolean> {
  const field =
    frequency === 'weekly'
      ? 'settings.insightsDigest.lastWeeklyKey'
      : 'settings.insightsDigest.lastMonthlyKey';
  // Claim the period first so concurrent instances send one digest.
  const claim = await User.updateOne(
    { _id: user._id, [field]: { $ne: period.key } },
    { $set: { [field]: period.key } }
  );
  if (claim.modifiedCount !== 1) return false;

  const [current, previous] = await Promise.all([
    getPeriodSummary(user._id, period.start, period.end, calendar),
    getPeriodSummary(user._id, period.previousStart, period.start, calendar),
  ]);
  if (current.logs === 0 && previous.logs === 0) return false;

  const content = buildDigestNotification({ frequency, current, previous });
  await createNotification({
    recipient: user._id,
    type: 'insights_digest',
    ...content,
    link: `/user/${encodeURIComponent(user.username)}/stats?tab=insights`,
    entityType: 'insights_digest',
    entityId: `${frequency}:${period.key}`,
    expireAt: new Date(Date.now() + DIGEST_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  });
  return true;
}

/**
 * Send the weekly and monthly digests that are due.
 * A digest is due after DIGEST_LOCAL_HOUR on the first day of the next period.
 * Missed ticks send the digest later, because each period key is sent once.
 */
export async function runInsightsDigests(now = new Date()): Promise<number> {
  const users = (await User.find({
    $and: [
      {
        $or: [
          { 'settings.insightsDigest.weekly': true },
          { 'settings.insightsDigest.monthly': true },
        ],
      },
      {
        $or: [
          { roles: userRoles.admin },
          {
            'patreon.isActive': true,
            'patreon.tier': { $in: ['enthusiast', 'consumer'] },
            // Manual tiers expire on the next request. Skip them here too.
            'patreon.manualTierExpiry': { $not: { $lt: now } },
          },
        ],
      },
    ],
  })
    .select('username roles patreon settings.timezone settings.dayStartHour settings.weekStartsOn settings.insightsDigest')
    .lean()) as unknown as IDigestUser[];

  let sent = 0;
  for (const user of users) {
    const calendar = userCalendar(user);
    if (localParts(now, calendar.timezone).hour < DIGEST_LOCAL_HOUR) continue;
    const digest = user.settings?.insightsDigest;
    try {
      if (digest?.weekly) {
        const week = lastFinishedWeek(
          now,
          calendar,
          user.settings?.weekStartsOn === 0 ? 0 : 1
        );
        if (digest.lastWeeklyKey !== week.key) {
          if (await sendDigest(user, 'weekly', week, calendar)) sent += 1;
        }
      }
      if (digest?.monthly) {
        const month = lastFinishedMonth(now, calendar);
        if (digest.lastMonthlyKey !== month.key) {
          if (await sendDigest(user, 'monthly', month, calendar)) sent += 1;
        }
      }
    } catch (error) {
      console.error(`Insights digest failed for ${user.username}:`, error);
    }
  }
  return sent;
}
