import { readFileSync } from 'node:fs';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../types.js';

/**
 * Push messages have no client to translate them, so the server reads the
 * frontend catalogs. The path is the same from `src/services` and
 * `build/services`, and the Docker image keeps `Frontend/` next to `Backend/`.
 */
const LOCALES_DIR = new URL('../../../Frontend/src/i18n/locales/', import.meta.url);

type Catalog = Record<string, unknown>;
const catalogs = new Map<string, Catalog | null>();

function readCatalog(language: SupportedLanguage, namespace: string) {
  const cacheKey = `${language}:${namespace}`;
  if (!catalogs.has(cacheKey)) {
    try {
      const file = new URL(`${language}/${namespace}.json`, LOCALES_DIR);
      catalogs.set(cacheKey, JSON.parse(readFileSync(file, 'utf8')) as Catalog);
    } catch {
      catalogs.set(cacheKey, null);
    }
  }
  return catalogs.get(cacheKey) ?? null;
}

function lookup(catalog: Catalog | null, path: string[]) {
  let value: unknown = catalog;
  for (const part of path) {
    if (!value || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' && value ? value : undefined;
}

export function normalizeLanguage(value: unknown): SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
    ? (value as SupportedLanguage)
    : 'en';
}

/**
 * Resolve a notification key with the same rules as
 * `Frontend/src/utils/notificationText.ts`. Return undefined when the stored
 * English text must stay.
 */
function translateKey(
  language: SupportedLanguage,
  key: string,
  meta: Record<string, string>
) {
  const items = readCatalog(language, 'notifications')?.items as
    | Catalog
    | undefined;
  if (!items) return undefined;

  const params: Record<string, string> = { ...meta };
  if (meta.achievementKey) {
    const achievements = readCatalog(language, 'achievements');
    for (const field of ['name', 'description'] as const) {
      const text = lookup(achievements, ['items', meta.achievementKey, field]);
      if (text) params[field] = text;
    }
  }

  let template = lookup(items, [key]);
  if (meta.count !== undefined) {
    const count = Number(meta.count);
    const category =
      count === 0 ? 'zero' : new Intl.PluralRules(language).select(count);
    template =
      lookup(items, [`${key}_${category}`]) ??
      lookup(items, [`${key}_other`]) ??
      template;
  }
  if (!template) return undefined;

  const text = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    params[name] ?? match
  );
  // A missing parameter leaves a placeholder, which reads as a bug.
  return text.includes('{{') ? undefined : text;
}

export interface PushTextSource {
  title: string;
  body?: string | null;
  titleKey?: string | null;
  bodyKey?: string | null;
  meta?: Record<string, string> | Map<string, string> | null;
}

/** Return the push title and body in the language of the recipient. */
export function localizePushText(
  source: PushTextSource,
  language: SupportedLanguage
) {
  const meta =
    source.meta instanceof Map
      ? Object.fromEntries(source.meta)
      : { ...(source.meta ?? {}) };
  const resolve = (
    field: 'title' | 'body',
    key: string | null | undefined,
    fallback: string
  ) =>
    meta[`${field}_${language}`] ||
    (key && language !== 'en' ? translateKey(language, key, meta) : undefined) ||
    fallback;

  return {
    title: resolve('title', source.titleKey, source.title),
    body: resolve('body', source.bodyKey, source.body ?? '') || undefined,
  };
}
