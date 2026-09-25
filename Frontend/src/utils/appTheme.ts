import type { ICustomTheme, ISavedCustomTheme, IUser } from '../types';
import type { CSSProperties } from 'react';

export const DEFAULT_CUSTOM_THEME: ICustomTheme = {
  background: '#1d232a',
  foreground: '#f2f2f2',
  primary: '#7480ff',
  secondary: '#ff7ac8',
  accent: '#00cdb7',
};

export function getSavedCustomThemes(
  settings?: IUser['settings'],
): ISavedCustomTheme[] {
  if (settings?.customThemes?.length) return settings.customThemes;
  return settings?.customTheme
    ? [{ id: 'legacy', name: 'My theme', ...settings.customTheme }]
    : [];
}

export function getSelectedCustomTheme(
  settings?: IUser['settings'],
): ISavedCustomTheme | undefined {
  const themes = getSavedCustomThemes(settings);
  const selectedId = localStorage.getItem('customThemeId');
  return themes.find((theme) => theme.id === selectedId) ?? themes[0];
}

const keys = [
  'background',
  'foreground',
  'primary',
  'secondary',
  'accent',
] as const;
const customVariables = [
  '--color-base-100',
  '--color-base-200',
  '--color-base-300',
  '--color-base-content',
  '--color-primary',
  '--color-primary-content',
  '--color-secondary',
  '--color-secondary-content',
  '--color-accent',
  '--color-accent-content',
  '--color-neutral',
  '--color-neutral-content',
];

export function isCustomTheme(value: unknown): value is ICustomTheme {
  return (
    !!value &&
    typeof value === 'object' &&
    keys.every(
      (key) =>
        typeof (value as Record<string, unknown>)[key] === 'string' &&
        /^#[0-9a-fA-F]{6}$/.test((value as Record<string, string>)[key]),
    )
  );
}

function readableText(hex: string): string {
  const rgb = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179
    ? '#000000'
    : '#ffffff';
}

function mixHex(background: string, foreground: string, weight: number): string {
  const channels = [1, 3, 5].map((index) => {
    const base = parseInt(background.slice(index, index + 2), 16);
    const text = parseInt(foreground.slice(index, index + 2), 16);
    return Math.round(base * (1 - weight) + text * weight)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

export function getCustomThemeStyle(customTheme: ICustomTheme): CSSProperties {
  if (!isCustomTheme(customTheme)) return {};
  const neutral = mixHex(customTheme.background, customTheme.foreground, 0.15);
  const style: Record<string, string> = {
    colorScheme:
      readableText(customTheme.background) === '#000000' ? 'light' : 'dark',
    '--color-base-100': customTheme.background,
    '--color-base-200': `color-mix(in srgb, ${customTheme.background}, ${customTheme.foreground} 7%)`,
    '--color-base-300': `color-mix(in srgb, ${customTheme.background}, ${customTheme.foreground} 14%)`,
    '--color-base-content': customTheme.foreground,
    '--color-neutral': neutral,
    '--color-neutral-content': readableText(neutral),
  };
  for (const key of ['primary', 'secondary', 'accent'] as const) {
    style[`--color-${key}`] = customTheme[key];
    style[`--color-${key}-content`] = readableText(customTheme[key]);
  }
  return style as CSSProperties;
}

export function applyAppTheme(theme: string, customTheme?: ICustomTheme) {
  const root = document.documentElement;
  customVariables.forEach((name) => root.style.removeProperty(name));
  root.style.removeProperty('color-scheme');
  if (theme === 'custom' && isCustomTheme(customTheme)) {
    root.setAttribute('data-theme', 'dark');
    for (const [name, value] of Object.entries(
      getCustomThemeStyle(customTheme),
    )) {
      root.style.setProperty(name === 'colorScheme' ? 'color-scheme' : name, value);
    }
    return;
  }
  root.setAttribute(
    'data-theme',
    theme === 'system' || theme === 'custom'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme,
  );
}
