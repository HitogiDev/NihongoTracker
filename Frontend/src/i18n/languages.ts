/**
 * UI languages the app ships translations for.
 * Mirrored in Backend/src/types.ts (`SUPPORTED_LANGUAGES`) — there is no shared
 * package in this monorepo, so both lists must be updated together.
 */
export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/** Each language is always labelled in its own language, never translated. */
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
};

/**
 * localStorage cache of the active language. Read before React mounts so the
 * first paint is already in the right language, and deliberately kept outside
 * the persisted `userData` blob so it survives logout.
 */
export const LANGUAGE_STORAGE_KEY = 'language';

export function isSupportedLanguage(
  value: unknown
): value is SupportedLanguage {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}
