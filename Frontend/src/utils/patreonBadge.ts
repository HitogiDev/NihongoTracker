import type { CSSProperties } from 'react';

export type PatreonBadgeData = {
  isActive?: boolean;
  tier?: 'donator' | 'enthusiast' | 'consumer' | null;
  customBadgeText?: string;
  badgeColor?: string;
  badgeTextColor?: string;
};

export type PatreonBadgeProps = {
  colorClass: string;
  style: CSSProperties;
  text: string;
};

const DEFAULT_TEXT: Record<'donator' | 'enthusiast' | 'consumer', string> = {
  donator: 'Donator',
  enthusiast: 'Enthusiast',
  consumer: 'Consumer',
};

export function getPatreonBadgeProps(
  patreon?: PatreonBadgeData
): PatreonBadgeProps | null {
  if (!patreon?.isActive || !patreon.tier) {
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

  const text =
    allowCustomText && trimmedCustomText
      ? trimmedCustomText
      : DEFAULT_TEXT[tier];

  return { colorClass, style, text };
}

function resolveTextColor(value?: string, fallback?: string) {
  if (!value || value === 'primary-content' || value === 'secondary-content') {
    return fallback;
  }

  return value;
}
