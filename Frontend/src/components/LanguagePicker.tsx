import { useTranslation } from 'react-i18next';
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from '../i18n/languages';
import { useSetLanguage } from '../hooks/useSetLanguage';

/**
 * Language selector for the Settings preferences tab.
 */
export default function LanguagePicker() {
  const { t, i18n } = useTranslation('settings');
  const setLanguage = useSetLanguage();

  return (
    <fieldset className="fieldset w-full p-0">
      <legend className="fieldset-legend font-medium">
        {t('preferences.language.label')}
      </legend>
      <select
        id="language-picker"
        aria-label={t('preferences.language.label')}
        className="select w-full max-w-xs"
        value={i18n.language}
        onChange={(event) =>
          setLanguage(event.target.value as SupportedLanguage)
        }
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {LANGUAGE_LABELS[language]}
          </option>
        ))}
      </select>
      <p className="label text-base-content/60 text-wrap">
        {t('preferences.language.help')}
      </p>
    </fieldset>
  );
}
