import { useEffect } from 'react';
import i18n, { setAppLanguage } from '../i18n';
import { isSupportedLanguage } from '../i18n/languages';
import { useUserDataStore } from '../store/userData';

/**
 * Keeps the active i18next language in step with the language stored on the
 * account. Renders nothing.
 *
 * The account value wins whenever it changes — that is what makes login and
 * cross-device sync work. Local switches update the store on mutation success,
 * so they converge here instead of fighting.
 */
export default function LanguageSync() {
  const accountLanguage = useUserDataStore(
    (state) => state.user?.settings?.language
  );

  useEffect(() => {
    if (
      isSupportedLanguage(accountLanguage) &&
      accountLanguage !== i18n.language
    ) {
      void setAppLanguage(accountLanguage);
    }
  }, [accountLanguage]);

  return null;
}
