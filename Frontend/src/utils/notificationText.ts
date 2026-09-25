import i18n from '../i18n';
import {
  getAchievementDescription,
  getAchievementName,
} from './achievementText';

interface NotificationLike {
  label: string;
  labelKey?: string;
  body?: string;
  bodyKey?: string;
  meta?: Record<string, string>;
}

/**
 * Notifications are stored with their English text *and*, since the i18n work,
 * a translation key. This resolves one to the text the user should see.
 *
 * The English text always wins as a fallback, which covers three cases without
 * any data migration:
 *  - rows written before keys existed (they simply have no `labelKey`);
 *  - a key the client does not know yet (older client, newer server);
 *  - a key that was removed from the locale files.
 *
 * Reads the i18next singleton rather than a hook so it can be used from list
 * renderers and non-component code alike.
 */
function resolve(
  key: string | undefined,
  fallback: string,
  meta: Record<string, string> | undefined
): string {
  if (!key) return fallback;

  const fullKey = `notifications:items.${key}`;
  if (!i18n.exists(fullKey)) return fallback;

  // Keys and params are runtime strings from the API, so the typed `t`
  // signature cannot apply; the catalogue is kept in sync by hand.
  const translate = i18n.t.bind(i18n) as unknown as (
    k: string,
    options?: Record<string, unknown>
  ) => string;

  const params: Record<string, unknown> = { ...meta };

  // `meta` is a Map of String on the server, so numbers arrive as strings.
  // i18next silently falls back to the `other` plural unless count is a number.
  if (meta?.count !== undefined) {
    params.count = Number(meta.count);
  }

  // Achievement names live in the client's own catalogue, keyed by the stable
  // achievement key, so the notification never carries translated text.
  if (meta?.achievementKey) {
    const name = getAchievementName({ key: meta.achievementKey });
    const description = getAchievementDescription({ key: meta.achievementKey });

    // Left unset when the catalogue has no entry (a secret achievement, or one
    // seeded ahead of its translation) so the guard below keeps the stored
    // English instead of rendering an empty line.
    if (name) params.name = name;
    if (description) params.description = description;
  }

  const translated = translate(fullKey, params);

  // i18next leaves `{{placeholder}}` verbatim when a param is missing, which
  // reads as a bug to the user. Rows written before a param existed (or by a
  // server that forgot to send it) are better served by the stored English.
  if (translated.includes('{{')) return fallback;

  return translated;
}

export function getNotificationLabel(item: NotificationLike): string {
  return resolve(item.labelKey, item.label, item.meta);
}

export function getNotificationBody(item: NotificationLike): string {
  return resolve(item.bodyKey, item.body ?? '', item.meta);
}
