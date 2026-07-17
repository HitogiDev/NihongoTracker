import { AchievementRarity } from '../../types';

/**
 * Single flat accent color per rarity. Used sparingly (icons, badges,
 * progress fills) over the theme's base colors so achievements render
 * correctly on every DaisyUI theme.
 */
export const RARITY_COLOR: Record<AchievementRarity, string> = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#a855f7',
  legendary: '#fbbf24',
  secret:    '#7c3aed',
};

/** Rarity color with a hex alpha suffix, e.g. rarityTint('rare', '1a'). */
export function rarityTint(rarity: AchievementRarity, alphaHex: string): string {
  return `${RARITY_COLOR[rarity] ?? RARITY_COLOR.common}${alphaHex}`;
}
