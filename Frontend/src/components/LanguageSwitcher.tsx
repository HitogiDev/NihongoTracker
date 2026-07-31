import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from '../i18n/languages';
import { useSetLanguage } from '../hooks/useSetLanguage';

/**
 * Standalone globe dropdown for the header toolbar (logged-out users, next to
 * the theme toggle).
 */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation('nav');
  const setLanguage = useSetLanguage();

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-sm sm:btn-md btn-circle"
        aria-label={t('language.switcherLabel')}
      >
        <Globe className="w-5 h-5" />
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-[50] menu p-2 shadow-sm bg-base-100 text-base-content rounded-xl w-40 border border-base-300"
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <li key={language}>
            <a
              className={`rounded-lg font-medium whitespace-nowrap ${
                i18n.language === language ? 'active text-primary' : ''
              }`}
              onClick={() => setLanguage(language)}
            >
              {LANGUAGE_LABELS[language]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Same control shaped as a DaisyUI menu submenu, for use inside the existing
 * header dropdowns (avatar menu, mobile hamburger).
 */
export function LanguageMenuItem() {
  const { t, i18n } = useTranslation('nav');
  const setLanguage = useSetLanguage();

  const handleSelect = (language: SupportedLanguage) => {
    setLanguage(language);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  return (
    <li>
      <details>
        <summary className="rounded-lg font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 whitespace-nowrap">
          <Globe className="w-4 h-4" />
          {t('language.switcherLabel')}
        </summary>
        <ul>
          {SUPPORTED_LANGUAGES.map((language) => (
            <li key={language}>
              <a
                className={`rounded-lg whitespace-nowrap ${
                  i18n.language === language ? 'active text-primary' : ''
                }`}
                onClick={() => handleSelect(language)}
              >
                {LANGUAGE_LABELS[language]}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
