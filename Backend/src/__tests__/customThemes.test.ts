import { describe, expect, it } from 'vitest';
import {
  getPublicProfileTheme,
  getSavedCustomThemes,
  parseCustomThemes,
} from '../services/customThemes.js';

const theme = {
  id: 'one',
  name: 'Evening',
  background: '#112233',
  foreground: '#ffffff',
  primary: '#aabbcc',
  secondary: '#ddeeff',
  accent: '#123456',
};

describe('custom themes', () => {
  it('accepts up to ten named themes and rejects duplicates or invalid colors', () => {
    expect(parseCustomThemes([theme])).toEqual([theme]);
    expect(
      parseCustomThemes(
        Array.from({ length: 11 }, (_, index) => ({
          ...theme,
          id: `id${index}`,
          name: `Theme ${index}`,
        })),
      ),
    ).toBeNull();
    expect(
      parseCustomThemes([theme, { ...theme, id: 'two', name: 'evening' }]),
    ).toBeNull();
    expect(parseCustomThemes([{ ...theme, accent: 'url(evil)' }])).toBeNull();
  });

  it('exposes only the chosen palette and retains a legacy palette until saved', () => {
    const settings = {
      blurAdultContent: true,
      customThemes: [theme],
      profileThemeId: 'one',
    };
    expect(getPublicProfileTheme(settings)).toEqual({
      background: theme.background,
      foreground: theme.foreground,
      primary: theme.primary,
      secondary: theme.secondary,
      accent: theme.accent,
    });
    expect(
      getPublicProfileTheme({ ...settings, profileThemeId: null }),
    ).toBeUndefined();
    expect(
      getSavedCustomThemes({ blurAdultContent: true, customTheme: theme })[0],
    ).toMatchObject({
      id: 'legacy',
      name: 'My theme',
      background: theme.background,
    });
  });
});
