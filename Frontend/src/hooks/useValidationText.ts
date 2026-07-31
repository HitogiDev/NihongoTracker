import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ValidationKey } from '../utils/validation';

/**
 * Translates the keys returned by `utils/validation`.
 *
 * Validators are pure and language-agnostic, so they hand back keys; this is
 * where they become text. An empty key means "valid" and yields an empty
 * string, which keeps the existing `error && <span>{error}</span>` call sites
 * working unchanged.
 */
export function useValidationText() {
  const { t } = useTranslation('validation');

  return useCallback(
    (key: ValidationKey | null | undefined): string => (key ? t(key) : ''),
    [t]
  );
}
