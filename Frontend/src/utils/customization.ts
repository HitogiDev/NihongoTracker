import type { CSSProperties } from 'react';
import type { ParseKeys } from 'i18next';
import type {
  AvatarFrame,
  BannerEffect,
  ProfileAccent,
  IUserCustomization,
  NameEffect,
  SignatureStat,
} from '../types';

/**
 * Presentation layer for profile cosmetics.
 *
 * The backend decides what a user may equip; this module only knows how each
 * equipped value looks. Every visual lives in a hand-written CSS class (see
 * `index.css`) rather than a Tailwind utility, because the class names are
 * built at runtime and would otherwise be purged from the bundle.
 */

/** Fallback gradient when the user has not picked custom colors. */
const DEFAULT_NAME_COLORS = ['var(--color-primary)', 'var(--color-secondary)'];

export type NameEffectRender = {
  className: string;
  style: CSSProperties;
};

export function getNameEffectRender(
  customization?: IUserCustomization | null
): NameEffectRender {
  const effect: NameEffect = customization?.nameEffect ?? 'none';
  if (effect === 'none') {
    return { className: '', style: {} };
  }

  const color1 = customization?.nameColor1?.trim() || DEFAULT_NAME_COLORS[0];
  const color2 = customization?.nameColor2?.trim() || DEFAULT_NAME_COLORS[1];

  // Custom properties drive the class' gradient/glow so one class covers every
  // color combination.
  const style = {
    '--name-color-1': color1,
    '--name-color-2': color2,
  } as CSSProperties;

  switch (effect) {
    case 'gradient':
      return { className: 'name-effect name-effect--gradient', style };
    case 'glow':
      return { className: 'name-effect name-effect--glow', style };
    case 'shimmer':
      return { className: 'name-effect name-effect--shimmer', style };
    default:
      return { className: '', style: {} };
  }
}

/**
 * `aura` is daisyUI's component rather than one of our hand-drawn rings, so it
 * gets a complete literal class string: Tailwind scans source text and would
 * never generate `aura-rainbow` from an interpolated name. `avatar-frame--aura`
 * only adapts it to a circular avatar (see customization.css).
 *
 * The 2s rotation period is set as `--tw-duration` inside `avatar-frame--aura`
 * rather than with a Tailwind duration utility: those also emit
 * `transition-duration`, and since `transition-property` defaults to `all`, it
 * turned every layout change on the avatar (the image finishing loading) into a
 * two-second glide that pushed the username beside it around.
 */
const AURA_FRAME_CLASS = 'aura aura-rainbow avatar-frame--aura';

export function getAvatarFrameClass(frame?: AvatarFrame | null): string {
  if (!frame || frame === 'none') return '';
  if (frame === 'aura') return AURA_FRAME_CLASS;
  return `avatar-frame avatar-frame--${frame}`;
}

export function hasAvatarFrame(frame?: AvatarFrame | null): boolean {
  return Boolean(frame && frame !== 'none');
}

/**
 * Base color of each accent preset. `default` stays on the DaisyUI theme
 * variable so it keeps following the visitor's light/dark choice.
 */
export const ACCENT_PRESET_COLORS: Record<
  Exclude<ProfileAccent, 'custom'>,
  string
> = {
  default: 'var(--color-primary)',
  sakura: '#e0518e',
  ocean: '#2b83c4',
  forest: '#3f9647',
  retro: '#e08b34',
  mono: '#7c7c7c',
};

/** The accent a profile actually paints with, presets and custom alike. */
export function resolveAccentColor(
  customization?: Pick<
    IUserCustomization,
    'profileAccent' | 'accentColor'
  > | null
): string {
  const accent = customization?.profileAccent ?? 'default';
  if (accent === 'custom') {
    return customization?.accentColor?.trim() || ACCENT_PRESET_COLORS.default;
  }
  return ACCENT_PRESET_COLORS[accent] ?? ACCENT_PRESET_COLORS.default;
}

/**
 * CSS variables that re-tint a profile page.
 *
 * DaisyUI reads `--color-primary` (and friends) from the nearest ancestor that
 * defines them, so overriding the variables on the profile wrapper re-colors
 * every component inside — progress bars, badges, the heatmap — without
 * touching the visitor's own theme.
 */
export function getProfileAccentStyle(
  customization?: Pick<
    IUserCustomization,
    'profileAccent' | 'accentColor'
  > | null
): CSSProperties {
  const accent = customization?.profileAccent ?? 'default';
  if (accent === 'default') return {};

  const color = resolveAccentColor(customization);

  return {
    '--color-primary': color,
    '--color-primary-content': readableTextColor(color),
    // Focus rings and hover states derive from the same hue so the page reads
    // as one palette instead of an accent pasted onto the theme.
    '--color-accent': color,
    '--color-accent-content': readableTextColor(color),
  } as CSSProperties;
}

/**
 * Black or white, whichever stays legible on `color`. Falls back to white for
 * non-hex values (the theme variable), which sit on their own content color.
 */
export function readableTextColor(color: string): string {
  const hex = color.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#ffffff';

  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const channel = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  return luminance > 0.45 ? '#111111' : '#ffffff';
}

/**
 * Heatmap cell colors, darkest last. Index 0 is the "no activity" cell; the
 * rest are the accent at rising strengths, so presets and custom colors share
 * one code path.
 */
export function getHeatmapCellColor(
  customization: Pick<
    IUserCustomization,
    'profileAccent' | 'accentColor'
  > | null | undefined,
  level: number
): string {
  if (level <= 0) return 'var(--color-base-300)';

  const color = resolveAccentColor(customization);
  const strength = [30, 50, 70, 100][Math.min(level, 4) - 1];

  return strength === 100
    ? color
    : `color-mix(in oklab, ${color} ${strength}%, transparent)`;
}

/** Number of floating particles rendered per ambient banner effect. */
export const BANNER_EFFECT_PARTICLES: Record<BannerEffect, number> = {
  none: 0,
  sakura: 14,
  snow: 20,
  stars: 18,
  fireflies: 12,
};

export type SignatureStatValue = {
  /** i18n key under the `profile` namespace for the label. */
  labelKey: ParseKeys<'profile'>;
  value: number;
  /** Whether the number should be rendered with one decimal (hours). */
  decimal: boolean;
};

const SIGNATURE_LABEL_KEYS: Record<
  Exclude<SignatureStat, 'none'>,
  ParseKeys<'profile'>
> = {
  hours: 'signature.hours',
  chars: 'signature.chars',
  streak: 'signature.streak',
  level: 'signature.level',
  xp: 'signature.xp',
  logs: 'signature.logs',
};

/**
 * Hours, characters and log counts are not on the user document, so the API
 * resolves the equipped stat and hands back a plain number. This only maps it
 * to its label and number format.
 */
export function getSignatureStatValue(
  stat: SignatureStat | undefined,
  value: number | undefined | null
): SignatureStatValue | null {
  if (!stat || stat === 'none' || value === undefined || value === null) {
    return null;
  }

  return {
    labelKey: SIGNATURE_LABEL_KEYS[stat],
    value,
    decimal: stat === 'hours',
  };
}
