import 'i18next';
import en from './locales/en';

/**
 * Makes translation keys type-safe: a key that does not exist in the English
 * locale files is a `tsc` error, and `npm run build` runs `tsc` first. This is
 * the main correctness gate for the whole i18n migration.
 *
 * Regenerate nothing by hand — English JSON is the source of truth, kept in
 * sync by `npm run i18n:extract`.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof en;
  }
}
