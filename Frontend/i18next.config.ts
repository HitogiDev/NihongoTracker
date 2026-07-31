import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en', 'es'],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    output: 'src/i18n/locales/{{language}}/{{namespace}}.json',
    primaryLanguage: 'en',
    defaultNS: 'common',
    nsSeparator: ':',
    keySeparator: '.',
    sort: true,
    indentation: 2,
    // Missing Spanish keys are written as empty strings. i18n/index.ts sets
    // `returnEmptyString: false`, so they render the English fallback instead
    // of a blank until they are translated.
    defaultValue: '',
    // Keys the extractor cannot see because they are passed to `t()` through a
    // variable — route titles, validation results, achievement/error catalogues.
    // Without these, `removeUnusedKeys` (on by default) silently deletes them.
    preservePatterns: [
      'achievements:items.*',
      'common:mediaTypes.*',
      'common:patreonTiers.*',
      'errors:*',
      'nav:titles.*',
      'notifications:*',
      'settings:profileWidgets.*',
      'validation:*',
    ],
  },
});
