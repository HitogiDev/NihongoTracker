import type { IUserCustomTheme, IUserSettings } from '../types.js';

const COLOR_KEYS = [
  'background',
  'foreground',
  'primary',
  'secondary',
  'accent',
] as const;

export function getSavedCustomThemes(
  settings?: IUserSettings,
): IUserCustomTheme[] {
  const saved = settings?.customThemes ?? [];
  if (saved.length) {
    return saved.map(
      ({ id, name, background, foreground, primary, secondary, accent }) => ({
        id,
        name,
        background,
        foreground,
        primary,
        secondary,
        accent,
      }),
    );
  }
  const legacy = settings?.customTheme;
  return legacy
    ? [
        {
          id: 'legacy',
          name: 'My theme',
          background: legacy.background,
          foreground: legacy.foreground,
          primary: legacy.primary,
          secondary: legacy.secondary,
          accent: legacy.accent,
        },
      ]
    : [];
}

export function parseCustomThemes(value: unknown): IUserCustomTheme[] | null {
  if (!Array.isArray(value) || value.length > 10) return null;
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const result: IUserCustomTheme[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const data = item as Record<string, unknown>;
    if (
      Object.keys(data).length !== 7 ||
      typeof data.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(data.id) ||
      typeof data.name !== 'string'
    )
      return null;
    const name = data.name.trim();
    if (
      !name ||
      name.length > 40 ||
      seenIds.has(data.id) ||
      seenNames.has(name.toLowerCase()) ||
      !COLOR_KEYS.every(
        (key) =>
          typeof data[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(data[key]),
      )
    )
      return null;
    seenIds.add(data.id);
    seenNames.add(name.toLowerCase());
    result.push({
      id: data.id,
      name,
      background: (data.background as string).toLowerCase(),
      foreground: (data.foreground as string).toLowerCase(),
      primary: (data.primary as string).toLowerCase(),
      secondary: (data.secondary as string).toLowerCase(),
      accent: (data.accent as string).toLowerCase(),
    });
  }
  return result;
}

export function getPublicProfileTheme(settings?: IUserSettings) {
  const theme = getSavedCustomThemes(settings).find(
    (item) => item.id === settings?.profileThemeId,
  );
  if (!theme) return undefined;
  const { background, foreground, primary, secondary, accent } = theme;
  return { background, foreground, primary, secondary, accent };
}
