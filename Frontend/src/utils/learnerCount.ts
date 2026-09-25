import type { ParseKeys } from 'i18next';

/**
 * The login and register heroes read "Join <n> learners tracking their
 * immersion…", where the phrase is bucketed rather than an exact number.
 *
 * Returns a key instead of a sentence (see the rule in i18n/GLOSSARY.md): this
 * module is pure, and the wording — including how Spanish inflects it — belongs
 * in `auth.json`.
 */
export function getLearnerCountKey(
  count: number | undefined
): ParseKeys<'auth'> {
  if (!count || count < 100) return 'hero.learners.few';
  if (count < 1000) return 'hero.learners.hundreds';
  if (count < 10000) return 'hero.learners.thousands';
  if (count < 100000) return 'hero.learners.tensOfThousands';
  return 'hero.learners.hundredsOfThousands';
}
