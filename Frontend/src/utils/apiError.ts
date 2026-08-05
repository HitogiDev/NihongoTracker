import { AxiosError } from 'axios';
import type { ParseKeys } from 'i18next';
import i18n from '../i18n';

interface ApiErrorBody {
  message?: string;
  code?: string;
  params?: Record<string, string | number>;
}

/**
 * Turns any thrown value from an API call into a message to show the user.
 *
 * Order matters:
 *  1. a `code` the client knows about wins, translated into the active language;
 *  2. otherwise the server's English `message` is shown verbatim — this is the
 *     behaviour the app had before i18n, so an unmigrated endpoint or an older
 *     client against a newer server degrades to exactly what it did before;
 *  3. finally a generic fallback.
 *
 * Reads the i18next singleton rather than a hook so it can be used inside
 * mutation `onError` callbacks and other non-component code.
 */
export function getApiErrorMessage(
  error: unknown,
  fallbackKey: ParseKeys<'errors'> = 'common.unexpected'
): string {
  const body =
    error instanceof AxiosError
      ? (error.response?.data as ApiErrorBody | undefined)
      : undefined;

  // Error codes are runtime strings from the server, so the typed `t` signature
  // cannot apply here; the catalogue is kept in sync by a backend test instead.
  const translate = i18n.t.bind(i18n) as unknown as (
    key: string,
    params?: Record<string, string | number>
  ) => string;

  if (body?.code) {
    const key = `errors:${body.code}`;
    if (i18n.exists(key)) {
      return translate(key, body.params);
    }
  }

  if (body?.message) {
    return body.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return translate(`errors:${fallbackKey}`);
}
