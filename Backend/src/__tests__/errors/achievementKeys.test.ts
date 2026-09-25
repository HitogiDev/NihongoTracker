import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(here, '../../scripts/seedAchievements.ts');
const localesPath = path.resolve(here, '../../../../Frontend/src/i18n/locales');

function seededKeys(): string[] {
  const source = readFileSync(seedPath, 'utf-8');
  return [...source.matchAll(/^\s*key: '([^']+)',/gm)].map((m) => m[1]);
}

function translatedItems(language: string): Record<string, unknown> {
  const file = readFileSync(
    path.join(localesPath, language, 'achievements.json'),
    'utf-8'
  );
  const parsed = JSON.parse(file) as { items?: Record<string, unknown> };
  return parsed.items ?? {};
}

/**
 * Achievement text is stored in English in MongoDB and translated client-side
 * from the stable `key`. Nothing at runtime notices when a newly seeded
 * achievement has no translation — it silently falls back to English — so this
 * is the guard that catches it.
 */
describe('achievement translations', () => {
  const keys = seededKeys();

  it('finds the seeded achievements', () => {
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(['en', 'es'])('has %s text for every seeded achievement', (language) => {
    const items = translatedItems(language);
    const missing = keys.filter((key) => {
      const entry = items[key] as { name?: string; description?: string } | undefined;
      return !entry?.name || !entry?.description;
    });

    expect(missing).toEqual([]);
  });

  it('has no translations for achievements that no longer exist', () => {
    const seeded = new Set(keys);
    const orphans = Object.keys(translatedItems('en')).filter(
      (key) => !seeded.has(key)
    );

    expect(orphans).toEqual([]);
  });
});
