import type { LookupRequest } from './types';

/**
 * What to do with an `<a href>` from a dictionary.
 *
 * There is no third option. A dictionary link either asks for another lookup —
 * in which case it stays inside the popup and never navigates — or it is
 * rendered as plain text. No `href` attribute is ever emitted by this package,
 * which is what makes `javascript:`, `data:` and every other scheme a
 * non-question rather than a blocklist to keep up to date.
 */
export type LinkPolicy =
  | { kind: 'lookup'; request: LookupRequest }
  | { kind: 'text'; reason: 'external' | 'malformed' | 'missing-query' | 'oversized' };

/**
 * Yomitan writes internal cross-references as a relative query string:
 *
 *   ?query=%E5%90%8C%E4%B8%8A&wildcards=off&primary_reading=%E3%81%A9%E3%81%86…
 *
 * Anything that does not look exactly like that — an absolute URL, a
 * protocol-relative `//host`, a scheme, a fragment, a path — is text.
 */
const MAX_QUERY_LENGTH = 128;

export function classifyHref(href: unknown): LinkPolicy {
  if (typeof href !== 'string' || href.length === 0) {
    return { kind: 'text', reason: 'malformed' };
  }
  // A leading `?` is the whole of the internal-link contract. Everything else,
  // including `//evil.example`, fails here.
  if (!href.startsWith('?')) {
    return { kind: 'text', reason: 'external' };
  }
  // `?` followed by anything that could start a new URL component.
  if (href.includes('#') || href.includes('\\')) {
    return { kind: 'text', reason: 'malformed' };
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(href.slice(1));
  } catch {
    return { kind: 'text', reason: 'malformed' };
  }

  const query = params.get('query');
  if (query === null || query.trim().length === 0) {
    return { kind: 'text', reason: 'missing-query' };
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return { kind: 'text', reason: 'oversized' };
  }

  const reading = params.get('primary_reading');
  return {
    kind: 'lookup',
    request: {
      query,
      ...(reading && reading.length <= MAX_QUERY_LENGTH ? { reading } : {}),
    },
  };
}
