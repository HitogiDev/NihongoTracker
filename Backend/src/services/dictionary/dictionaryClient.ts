/**
 * Client for the dictionary lookup service.
 *
 * Same shape as `services/meilisearch/meiliClient.ts` with one deliberate
 * difference: this module never throws on a missing or unreachable service.
 * The texthooker has to keep working without a dictionary — losing definitions
 * is a degraded feature, not a reason for the API to fail to boot — so an
 * absent `DICTIONARY_SERVICE_URL` disables lookups and everything else carries
 * on.
 */

const host = process.env.DICTIONARY_SERVICE_URL?.replace(/\/+$/, '');

/** Milliseconds. One lookup is ~2.6 ms of work, so this is all network. */
const TIMEOUT_MS = Number(process.env.DICTIONARY_TIMEOUT_MS ?? 2000);

/** How long a failed service is left alone before being tried again. */
const CIRCUIT_COOLDOWN_MS = Number(process.env.DICTIONARY_COOLDOWN_MS ?? 30_000);

if (host) {
  console.log(`📖 Dictionary service configured at ${host}`);
} else {
  console.log('📖 Dictionary service not configured — texthooker lookups disabled');
}

export interface DictionaryGlossary {
  dictName: string;
  /** Yomitan structured content, verbatim. The client renders it. */
  content: unknown;
}

export interface DictionaryFrequency {
  dictName: string;
  display: string;
  value: number;
}

export interface DictionaryMatch {
  matched: string;
  deinflected: string;
  /** The deinflection chain, in order. */
  process: string[];
  expression: string;
  reading: string;
  rules: string;
  frequencies: DictionaryFrequency[];
  glossaries: DictionaryGlossary[];
}

export interface DictionaryLookupResult {
  query: string;
  offset: number;
  matches: DictionaryMatch[];
}

export interface LoadedDictionary {
  name: string;
  path: string;
}

export interface DictionaryHealth {
  status: string;
  ready: boolean;
  engines: number;
  uptimeSeconds: number;
  dictionaries: LoadedDictionary[];
}

export interface DictionaryLicense {
  name: string;
  license: string;
  url: string | null;
  sources: { name: string; license: string; url: string | null }[];
  attribution: string;
}

/** Thrown for a service that is configured but not answering. */
export class DictionaryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DictionaryUnavailableError';
  }
}

export const isDictionaryConfigured = (): boolean => Boolean(host);

// A service that just failed is very unlikely to work on the next hover, and a
// reader generates a lot of hovers. Without this, every one of them waits for
// the timeout.
let circuitOpenUntil = 0;

function circuitIsOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

function tripCircuit(): void {
  circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!host) {
    throw new DictionaryUnavailableError('Dictionary service is not configured');
  }
  if (circuitIsOpen()) {
    throw new DictionaryUnavailableError('Dictionary service is cooling down after a failure');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${host}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });

    if (!response.ok) {
      // A 4xx is our bug, not the service being down, so it must not trip the
      // circuit for everyone else.
      if (response.status >= 500) tripCircuit();
      throw new DictionaryUnavailableError(
        `Dictionary service answered ${response.status}`
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DictionaryUnavailableError) throw error;
    tripCircuit();
    const reason = error instanceof Error ? error.message : String(error);
    throw new DictionaryUnavailableError(`Dictionary service unreachable: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Look up the text at `offset`.
 *
 * One offset per call, by design: the spike measured 2.62 ms for a single
 * offset against 127 ms for every offset of a line, so the client asks for the
 * character under the cursor and nothing else.
 *
 * `offset` counts UTF-16 code units, which is what the browser's caret APIs
 * report and what `String.prototype.length` counts.
 */
export async function lookup(
  text: string,
  offset: number,
  maxResults?: number
): Promise<DictionaryLookupResult> {
  return request<DictionaryLookupResult>('/lookup', {
    method: 'POST',
    body: JSON.stringify({ text, offset, maxResults }),
  });
}

export async function health(): Promise<DictionaryHealth> {
  return request<DictionaryHealth>('/health');
}

/**
 * Attribution for the loaded dictionaries. Jitendex is CC BY-SA 4.0 over JMdict
 * and Tatoeba; serving it from our own product makes crediting them our
 * obligation, so this is what the UI shows.
 */
export async function licenses(): Promise<DictionaryLicense[]> {
  return request<DictionaryLicense[]>('/licenses');
}

export default { lookup, health, licenses, isDictionaryConfigured };
