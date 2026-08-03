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
      // MediaRequest/Moderation resolve these through labelKey or a helper.
      'admin:mediaRequest.languages.*',
      'admin:mediaRequest.status.*',
      'admin:mediaRequest.types.*',
      'admin:moderation.history.*',
      // Empty-state wording picks a status context at runtime.
      'admin:queue.empty*',
      // AchievementsScreen resolves these through labelKey or a template literal.
      'achievements:category.*',
      'achievements:rarity.*',
      'achievements:screen.sort.*',
      'achievements:screen.status.*',
      'common:mediaTypes.*',
      'common:patreonTiers.*',
      'errors:*',
      // FeaturesScreen looks these up by catalogue id.
      'home:features.categories.*',
      'home:features.howItWorks.steps.*',
      // The legal pages are structured documents rendered by LegalDocument.tsx,
      // so none of their prose is reachable from a literal t() call.
      'legal:*',
      // Entry counts pick a per-media-type context at runtime.
      'media:lists.entries*',
      'media:lists.filters.*',
      'nav:titles.*',
      // ProfileScreen resolves achievement categories through labelKey.
      // ImmersionGoals resolves goal types through labelKey.
      'goals:types.*',
      // The media search placeholder picks a vn/game context at runtime.
      'texthooker:mediaSession.searchPlaceholder*',
      // The hooker theme picker resolves one entry through labelKey.
      'texthooker:hooker.settings.useAppTheme',
      'profile:categories.*',
      'profile:favoritesWidget.types.*',
      'notifications:*',
      'settings:profileWidgets.*',
      'validation:*',
    ],
  },
});
