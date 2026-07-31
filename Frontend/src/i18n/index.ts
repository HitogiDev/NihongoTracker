import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  isSupportedLanguage,
} from './languages';

type LocaleResources = Record<string, Record<string, unknown>>;

/**
 * One chunk per language. Vite emits these as separate chunks, so a Spanish
 * user never downloads the English bundle except as the fallback (below).
 */
const loaders: Record<
  SupportedLanguage,
  () => Promise<{ default: LocaleResources }>
> = {
  en: () => import('./locales/en'),
  es: () => import('./locales/es'),
};

/**
 * Picks the language for the very first paint, before React mounts.
 *
 * Mirrors `resolveInitialTheme()` in main.tsx. Every step is defensive on
 * purpose: this runs at module scope in the entry chunk, so an exception here
 * is a white screen with no error boundary to catch it.
 */
export function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(stored)) {
      return stored;
    }
  } catch {
    // localStorage can throw in private mode / blocked-cookie contexts
  }

  // Fall back to the persisted zustand blob so a returning logged-in user sees
  // their account language immediately, without waiting for the store to hydrate.
  try {
    const raw = localStorage.getItem('userData');
    if (raw) {
      const parsed = JSON.parse(raw) as {
        state?: { user?: { settings?: { language?: unknown } } };
      };
      const fromUser = parsed?.state?.user?.settings?.language;
      if (isSupportedLanguage(fromUser)) {
        return fromUser;
      }
    }
  } catch {
    // Corrupt blob — never let it break the entry chunk
  }

  try {
    const browser = navigator.language?.split('-')[0];
    if (isSupportedLanguage(browser)) {
      return browser;
    }
  } catch {
    // navigator can be missing in exotic environments
  }

  return DEFAULT_LANGUAGE;
}

async function loadResources(
  languages: SupportedLanguage[]
): Promise<Record<string, LocaleResources>> {
  const loaded = await Promise.all(
    languages.map(async (lng) => [lng, (await loaders[lng]()).default] as const)
  );

  return Object.fromEntries(loaded);
}

/**
 * Awaited before `createRoot` so there is never a flash of untranslated UI and
 * no component ever has to suspend on a missing namespace.
 *
 * English is always loaded alongside the active language: `i18next-cli extract`
 * seeds new Spanish keys as empty strings, and with `returnEmptyString: false`
 * those fall through to English instead of rendering blank.
 */
export async function initI18n(language: SupportedLanguage) {
  const languages = Array.from(
    new Set<SupportedLanguage>([DEFAULT_LANGUAGE, language])
  );
  const resources = await loadResources(languages);

  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'common',
    ns: Object.keys(resources[DEFAULT_LANGUAGE]),
    resources,
    returnEmptyString: false,
    interpolation: {
      // React already escapes interpolated values
      escapeValue: false,
    },
    react: {
      // Everything is bundled, so there is nothing to suspend on
      useSuspense: false,
    },
  });

  i18n.on('languageChanged', (lng) => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lng;
    }
  });

  return i18n;
}

/**
 * Single entry point for changing the UI language. Writes the localStorage
 * cache, lazily pulls the language chunk if it is not loaded yet, and flips
 * i18next (which updates `<html lang>` via the listener above).
 */
export async function setAppLanguage(language: SupportedLanguage) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Non-fatal: the language still applies for this session
  }

  if (!i18n.hasResourceBundle(language, 'common')) {
    const { default: resources } = await loaders[language]();
    Object.entries(resources).forEach(([namespace, bundle]) => {
      i18n.addResourceBundle(language, namespace, bundle, true, true);
    });
  }

  await i18n.changeLanguage(language);
}

export default i18n;
