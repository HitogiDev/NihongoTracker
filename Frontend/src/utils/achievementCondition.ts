import i18n from '../i18n';
import type { IAchievementCondition } from '../types';
import { getLogTypeLabelKey } from './logTypes';

/**
 * Renders an achievement's unlock condition as a sentence.
 *
 * The API sends the condition as structured data rather than prose (see
 * `ownerUnlockCondition` in Backend/src/controllers/achievement.controller.ts),
 * so the sentence is assembled here and translates with the rest of the UI —
 * the same division of labour as `achievementText.ts`, which looks achievement
 * names up by `key`.
 *
 * Only earned secrets ever carry a condition for their earner, so this is the
 * one place the vague description gets spelled out.
 */

/**
 * The condition `type` is a runtime string from the database, so the typed `t`
 * signature cannot apply. Same escape hatch as `achievementText.ts`; a missing
 * key surfaces as `undefined` and the caller renders nothing.
 */
const translate = i18n.t.bind(i18n) as unknown as (
  key: string,
  options?: Record<string, unknown>
) => string;

function key(name: string): string {
  return `achievements:condition.${name}`;
}

/** Localized media type label, reusing the log form's key map. */
function mediaLabel(mediaType?: string): string {
  if (!mediaType) return '';
  const labelKey = getLogTypeLabelKey(mediaType);
  return labelKey
    ? translate(`common:${labelKey}`, { defaultValue: mediaType })
    : mediaType;
}

/** '07-07' -> 'July 7' / '7 de julio'. */
function dateLabel(pattern?: string): string {
  if (!pattern) return '';
  const match = /^(\d{2})-(\d{2})$/.exec(pattern);
  if (!match) return pattern;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12) return pattern;
  // Year 2000 is a leap year, so 02-29 formats instead of rolling over
  return new Date(Date.UTC(2000, month - 1, day)).toLocaleDateString(
    i18n.language,
    { month: 'long', day: 'numeric', timeZone: 'UTC' }
  );
}

/** 0 -> '12 AM' in English, '0' in Spanish — whatever the locale's clock is. */
function hourLabel(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  return new Date(Date.UTC(2000, 0, 1, normalized)).toLocaleTimeString(
    i18n.language,
    { hour: 'numeric', timeZone: 'UTC' }
  );
}

/** "4 hours" / "4 horas" — used inside sentences that already own `count`. */
function hoursPhrase(count: number): string {
  return translate(key('units.hours'), { count });
}

/** "7 days" / "7 días" — likewise. */
function daysPhrase(count: number): string {
  return translate(key('units.days'), { count });
}

export function describeAchievementCondition(
  condition: IAchievementCondition | null | undefined
): string | undefined {
  if (!condition?.type) return undefined;

  const count = condition.threshold ?? 1;

  switch (condition.type) {
    case 'streak':
    case 'totalXp':
    case 'logCount':
    case 'totalHours':
    case 'achievementCount':
    case 'singleDayHours':
    case 'weeklyHours':
    case 'sessionsInDay':
    case 'platformAge':
    case 'clubsCreated':
    case 'clubsJoined':
    case 'clubMvp':
    case 'distinctMediaCount':
    case 'singleSessionHours':
    case 'streakComeback':
    case 'streakAfterBreak':
    case 'secretAchievementCount':
    case 'earlyAdopter':
      return translate(key(condition.type), { count });

    case 'mediaType':
    case 'mediaTypeHours':
      return translate(key(condition.type), {
        count,
        media: mediaLabel(condition.mediaType),
      });

    case 'level':
      return translate(key('level'), {
        level: count,
        stat: translate(key(`levelStat.${condition.stat ?? 'userLevel'}`), {
          defaultValue: translate(key('levelStat.userLevel')),
        }),
      });

    case 'logTimeRange':
      return translate(key('logTimeRange'), {
        count,
        start: hourLabel(condition.startHour ?? 0),
        end: hourLabel(condition.endHour ?? 24),
      });

    case 'logOnDate':
      return translate(key('logOnDate'), {
        date: dateLabel(condition.datePattern),
      });

    case 'mediaTypesInWeek':
      return translate(key('mediaTypesInWeek'), {
        count,
        window: daysPhrase(condition.days ?? 7),
      });

    case 'mediaReleasedBefore':
      return translate(key('mediaReleasedBefore'), {
        media: mediaLabel(condition.mediaType ?? 'vn'),
        year: String(condition.year ?? 2005),
      });

    case 'consecutiveDaysWithHours':
      return translate(key('consecutiveDaysWithHours'), {
        count,
        hours: hoursPhrase(condition.hours ?? 4),
      });

    case 'rapidSuccession':
      return translate(key('rapidSuccession'), {
        count: condition.seconds ?? 60,
      });

    case 'logDuringAiring':
    case 'rankDethroned':
    case 'manualGrant':
      return translate(key(condition.type));

    default:
      return undefined;
  }
}
