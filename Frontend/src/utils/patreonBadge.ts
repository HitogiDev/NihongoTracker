import type { ParseKeys } from 'i18next';
import type { CSSProperties } from 'react';

export type PatreonBadgeData = {
  isActive?: boolean;
  tier?: 'donator' | 'enthusiast' | 'consumer' | null;
  customBadgeText?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  /** Supporter opted out of showing the badge publicly. */
  hideBadge?: boolean;
};

export type PatreonBadgeProps = {
  colorClass: string;
  style: CSSProperties;
  /** Supporter-authored badge text. Rendered as-is when present. */
  text: string | null;
  /** Fallback tier label as a translation key, used when `text` is null. */
  tierKey: ParseKeys<'common'>;
};

const TIER_KEYS: Record<
  'donator' | 'enthusiast' | 'consumer',
  ParseKeys<'common'>
> = {
  donator: 'patreonTiers.donator',
  enthusiast: 'patreonTiers.enthusiast',
  consumer: 'patreonTiers.consumer',
};

/**
 * @param options.ignoreHidden render the badge even when the supporter hid it —
 *   used by the settings previews, which have to show what is being edited.
 */
export function getPatreonBadgeProps(
  patreon?: PatreonBadgeData,
  options?: { ignoreHidden?: boolean }
): PatreonBadgeProps | null {
  if (!patreon?.isActive || !patreon.tier) {
    return null;
  }

  if (patreon.hideBadge && !options?.ignoreHidden) {
    return null;
  }

  const tier = patreon.tier;
  const supportsCustomColors = tier === 'consumer' || tier === 'donator';
  const badgeColor = patreon.badgeColor?.trim();

  let colorClass = 'badge-primary';
  let style: CSSProperties = {};

  if (supportsCustomColors && badgeColor) {
    if (badgeColor === 'rainbow') {
      colorClass = 'badge-rainbow';
      style = {
        color: resolveTextColor(patreon.badgeTextColor),
        border: 'none',
      };
    } else if (badgeColor === 'primary') {
      colorClass = 'badge-primary';
      style = {
        color: resolveTextColor(patreon.badgeTextColor),
      };
    } else if (badgeColor === 'secondary') {
      colorClass = 'badge-secondary';
      style = {
        color: resolveTextColor(patreon.badgeTextColor),
      };
    } else {
      colorClass = '';
      style = {
        backgroundColor: badgeColor,
        color: resolveTextColor(patreon.badgeTextColor, '#ffffff'),
        border: 'none',
      };
    }
  } else if (patreon.badgeTextColor) {
    style = {
      color: resolveTextColor(patreon.badgeTextColor),
    };
  }

  const allowCustomText =
    tier === 'consumer' || tier === 'enthusiast' || tier === 'donator';
  const trimmedCustomText = patreon.customBadgeText?.trim();

  const text = allowCustomText && trimmedCustomText ? trimmedCustomText : null;

  return { colorClass, style, text, tierKey: TIER_KEYS[tier] };
}

function resolveTextColor(value?: string, fallback?: string) {
  if (!value || value === 'primary-content' || value === 'secondary-content') {
    return fallback;
  }

  return value;
}
