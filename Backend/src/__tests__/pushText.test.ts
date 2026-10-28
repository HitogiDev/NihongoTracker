import { describe, expect, it } from 'vitest';
import { localizePushText, normalizeLanguage } from '../services/pushText.js';

describe('localizePushText', () => {
  it('translates a key with the recipient language', () => {
    expect(
      localizePushText(
        {
          title: 'kana followed you',
          titleKey: 'social.followed',
          meta: { username: 'kana' },
        },
        'es'
      ).title
    ).toBe('kana ha empezado a seguirte');
  });

  it('uses plural forms from a string count', () => {
    const source = {
      title: 'kana and 2 others liked your review',
      titleKey: 'review.liked',
      meta: new Map([
        ['username', 'kana'],
        ['count', '2'],
      ]),
    };
    expect(localizePushText(source, 'es').title).toBe(
      'A kana y a 2 personas más les ha gustado tu reseña'
    );
  });

  it('keeps the stored English text when a parameter is missing', () => {
    expect(
      localizePushText(
        { title: 'Achievement unlocked: First', titleKey: 'achievement.unlocked' },
        'es'
      ).title
    ).toBe('Achievement unlocked: First');
  });

  it('prefers custom text for the language and keeps English for en', () => {
    const source = {
      title: 'Maintenance',
      body: 'Tonight',
      titleKey: 'social.followed',
      meta: { title_es: 'Mantenimiento', username: 'kana' },
    };
    expect(localizePushText(source, 'es')).toEqual({
      title: 'Mantenimiento',
      body: 'Tonight',
    });
    expect(localizePushText(source, 'en').title).toBe('Maintenance');
  });

  it('falls back to English for unknown languages', () => {
    expect(normalizeLanguage('fr')).toBe('en');
  });
});
