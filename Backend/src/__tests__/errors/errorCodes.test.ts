import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  apiError,
  isErrorCode,
} from '../../i18n/errorCodes.js';
import { customError } from '../../middlewares/errorMiddleware.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendErrorsPath = path.resolve(
  here,
  '../../../../Frontend/src/i18n/locales'
);

function loadLocale(language: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(frontendErrorsPath, language, 'errors.json'), 'utf-8')
  ) as Record<string, unknown>;
}

function hasPath(source: Record<string, unknown>, dotted: string): boolean {
  return dotted.split('.').reduce<unknown>((node, segment) => {
    if (node && typeof node === 'object' && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source) !== undefined;
}

describe('apiError', () => {
  it('produces a customError carrying the code and params', () => {
    const error = apiError('user.notFound', 404, 'User not found', {
      username: 'hitogi',
    });

    expect(error).toBeInstanceOf(customError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('User not found');
    expect(error.code).toBe('user.notFound');
    expect(error.params).toEqual({ username: 'hitogi' });
  });

  it('leaves code and params unset for plain customError', () => {
    const error = new customError('Legacy', 400);

    expect(error.code).toBeUndefined();
    expect(error.params).toBeUndefined();
  });

  it('recognises catalogued codes only', () => {
    expect(isErrorCode('user.notFound')).toBe(true);
    expect(isErrorCode('user.doesNotExist')).toBe(false);
  });
});

describe('error code catalogue', () => {
  it('has no duplicates', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  // The two packages share no code, so this is the only automated guard
  // against the catalogue and the client's translations drifting apart.
  it.each(['en', 'es'])(
    'has a %s translation for every code',
    (language) => {
      const locale = loadLocale(language);
      const missing = ERROR_CODES.filter((code) => !hasPath(locale, code));

      expect(missing).toEqual([]);
    }
  );
});
