import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { updateUserFn } from '../api/trackerApi';
import { setAppLanguage } from '../i18n';
import { SupportedLanguage } from '../i18n/languages';
import { useUserDataStore } from '../store/userData';
import { ILoginResponse } from '../types';

/**
 * Single entry point for changing the UI language from anywhere.
 *
 * The UI flips immediately (local-first), and the choice is persisted to the
 * account when there is a session so it follows the user across devices.
 * A failed save is non-fatal: localStorage already holds the new language.
 */
export function useSetLanguage() {
  const { t } = useTranslation();
  const user = useUserDataStore((state) => state.user);
  const setUser = useUserDataStore((state) => state.setUser);

  const { mutate: persistLanguage } = useMutation({
    mutationFn: updateUserFn,
    onSuccess: (data) => {
      setUser(data as unknown as ILoginResponse);
    },
    onError: () => {
      toast.error(t('language.saveError'));
    },
  });

  return useCallback(
    (language: SupportedLanguage) => {
      void setAppLanguage(language);

      if (user) {
        const formData = new FormData();
        formData.append('language', language);
        persistLanguage(formData);
      }
    },
    [user, persistLanguage]
  );
}
