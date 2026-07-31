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
    <div className="form-control w-full">
      <label className="label" htmlFor="language-picker">
        <span className="label-text font-medium">
          {t('preferences.language.label')}
        </span>
      </label>
      <select
        id="language-picker"
        className="select select-bordered w-full max-w-xs"
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
      <label className="label" htmlFor="language-picker">
        <span className="label-text-alt text-base-content/60">
          {t('preferences.language.help')}
        </span>
      </label>
    </div>
  );
}
