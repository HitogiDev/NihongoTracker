import i18n from '../i18n';

interface AchievementLike {
  key?: string;
  name?: string;
  description?: string;
  hint?: string;
}

type AchievementField = 'name' | 'description' | 'hint' | 'fullDescription';

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
  field: AchievementField
): string {
  if (!achievement) return '';

  // `fullDescription` has no database counterpart — it only exists as a
  // translation, so an untranslated achievement falls back to nothing here and
  // the caller drops to the public description instead.
  const fallback =
    field === 'fullDescription' ? '' : (achievement[field] ?? '');
  if (!achievement.key) return fallback;

  // An empty `defaultValue` makes i18next hand back the key itself, which would
  // render as `items.<key>.fullDescription` on screen.
  if (
    !fallback &&
    !i18n.exists(`achievements:items.${achievement.key}.${field}`)
  )
    return '';

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

/**
 * The spelled-out description of a secret, for the user who unlocked it.
 *
 * Secrets describe themselves vaguely in public so they stay a surprise; only
 * `isOwnUnlock` payloads should reach this. Falls back to the public line for
 * achievements that have nothing extra to say.
 */
export function getAchievementFullDescription(
  achievement: AchievementLike | null | undefined
): string {
  return (
    lookup(achievement, 'fullDescription') || lookup(achievement, 'description')
  );
}
