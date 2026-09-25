import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { PatreonBadgeProps } from '../utils/patreonBadge';

/**
 * Resolves the text shown on a Patreon badge.
 *
 * Supporter-authored text is rendered verbatim in whatever language they wrote
 * it; only the default tier label is translated.
 */
export function usePatreonBadgeText() {
  const { t } = useTranslation('common');

  return useCallback(
    (badge: Pick<PatreonBadgeProps, 'text' | 'tierKey'>): string =>
      badge.text ?? t(badge.tierKey),
    [t]
  );
}
