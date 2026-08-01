import i18n from '../i18n';

interface AchievementLike {
  key?: string;
  name?: string;
  description?: string;
  hint?: string;
}

/**
 * Achievement names and descriptions live in the database in English, seeded by
 * `Backend/src/scripts/seedAchievements.ts`. Rather than translating them
 * server-side, the client looks them up by the achievement's stable `key`.
 *
 * `defaultValue` covers the two cases where no translation applies: secret
 * achievements, whose text the API withholds until they are unlocked, and any
 * newly seeded achievement whose translation has not landed yet.
 */
function lookup(
  achievement: AchievementLike | null | undefined,
  field: 'name' | 'description' | 'hint'
): string {
  if (!achievement) return '';

  const fallback = achievement[field] ?? '';
  if (!achievement.key) return fallback;

  // The key comes from the database at runtime, so the typed `t` signature
  // cannot apply; `errorCodes`-style catalogue drift is guarded by the seed
  // check in the i18n status script instead.
  const translate = i18n.t.bind(i18n) as unknown as (
    key: string,
    options: { defaultValue: string }
  ) => string;

  return translate(`achievements:items.${achievement.key}.${field}`, {
    defaultValue: fallback,
  });
}

export function getAchievementName(
  achievement: AchievementLike | null | undefined
): string {
  return lookup(achievement, 'name');
}

export function getAchievementDescription(
  achievement: AchievementLike | null | undefined
): string {
  return lookup(achievement, 'description');
}

export function getAchievementHint(
  achievement: AchievementLike | null | undefined
): string {
  return lookup(achievement, 'hint');
}
