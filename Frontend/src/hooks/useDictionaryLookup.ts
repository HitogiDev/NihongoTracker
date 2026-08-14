import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../api/axiosConfig';

export interface DictionaryGlossary {
  dictName: string;
  /** Yomitan structured content, verbatim from the dictionary. */
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
  process: string[];
  expression: string;
  reading: string;
  rules: string;
  frequencies: DictionaryFrequency[];
  glossaries: DictionaryGlossary[];
}

export interface DictionaryStatus {
  available: boolean;
  dictionaries: string[];
}

/** Where the popup should appear, in viewport coordinates. */
export interface LookupAnchor {
  x: number;
  y: number;
}

export interface LookupState {
  anchor: LookupAnchor;
  /** The text handed to the service, from the hovered offset to end of line. */
  query: string;
  matches: DictionaryMatch[] | undefined;
  loading: boolean;
  failed: boolean;
}

/** The cursor has to sit still this long before anything is sent. */
const DEBOUNCE_MS = 60;

/**
 * Shift+hover dictionary lookups for the texthooker.
 *
 * Two things about the shape of this are not preferences:
 *
 * - **One offset per request.** Resolving every offset of a line was measured at
 *   127 ms average and 555 ms p99, against 2.62 ms for the single offset under
 *   the cursor. Nothing here resolves ahead.
 * - **No per-character `<span>`s.** The character under the pointer is found
 *   with the caret APIs instead. Wrapping every character of every line in an
 *   element is what makes a long session crawl.
 */
export function useDictionaryLookup(enabled: boolean) {
  const [state, setState] = useState<LookupState | null>(null);

  // Session cache: the pointer jitters, and re-asking for a (line, offset) pair
  // already answered is pure waste. Keyed by the exact query text, which is what
  // the service actually sees.
  const cache = useRef(new Map<string, DictionaryMatch[]>());
  const inFlight = useRef<AbortController | null>(null);
  const debounce = useRef<number | null>(null);
  /** The query the last request was for, so a stale answer can be discarded. */
  const pending = useRef<string | null>(null);

  const status = useQuery({
    queryKey: ['dictionary-status'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<DictionaryStatus>('dictionary/status');
      return data;
    },
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const available = Boolean(status.data?.available);

  const cancel = useCallback(() => {
    if (debounce.current !== null) {
      window.clearTimeout(debounce.current);
      debounce.current = null;
    }
    inFlight.current?.abort();
    inFlight.current = null;
    pending.current = null;
  }, []);

  const close = useCallback(() => {
    cancel();
    setState(null);
  }, [cancel]);

  const run = useCallback(
    async (query: string, anchor: LookupAnchor) => {
      const cached = cache.current.get(query);
      if (cached) {
        setState({ anchor, query, matches: cached, loading: false, failed: false });
        return;
      }

      const controller = new AbortController();
      inFlight.current = controller;
      pending.current = query;
      setState({ anchor, query, matches: undefined, loading: true, failed: false });

      try {
        const { data } = await axiosInstance.post<{ matches: DictionaryMatch[] }>(
          'dictionary/lookup',
          // The whole remainder of the line goes over, with offset 0: the engine
          // only ever reads the first 16 characters past the offset, and this
          // keeps the cache key and the request body the same thing.
          { text: query, offset: 0 },
          { signal: controller.signal }
        );
        if (pending.current !== query) return; // a newer hover won
        cache.current.set(query, data.matches);
        setState({ anchor, query, matches: data.matches, loading: false, failed: false });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (pending.current !== query) return;
        setState({ anchor, query, matches: [], loading: false, failed: true });
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    },
    []
  );

  /**
   * Ask for whatever is under the pointer. Safe to call on every `pointermove`:
   * it debounces, and it cancels the previous request rather than racing it.
   */
  const hover = useCallback(
    (event: { clientX: number; clientY: number; shiftKey: boolean }) => {
      if (!enabled || !available) return;
      if (!event.shiftKey) {
        close();
        return;
      }

      const hit = characterAtPoint(event.clientX, event.clientY);
      if (!hit) {
        close();
        return;
      }

      const query = hit.text.slice(hit.offset).trim();
      if (query.length === 0 || !hasJapanese(query)) {
        close();
        return;
      }

      // Same character as last time: leave the popup alone rather than
      // reopening it under a pointer that has not really moved.
      if (state?.query === query) return;

      cancel();
      const anchor = { x: event.clientX, y: event.clientY };
      debounce.current = window.setTimeout(() => {
        debounce.current = null;
        void run(query, anchor);
      }, DEBOUNCE_MS);
    },
    [enabled, available, close, cancel, run, state?.query]
  );

  useEffect(() => cancel, [cancel]);

  return useMemo(
    () => ({
      available,
      dictionaries: status.data?.dictionaries ?? [],
      state,
      hover,
      close,
    }),
    [available, status.data?.dictionaries, state, hover, close]
  );
}

/**
 * The text node under a point, and the offset into it.
 *
 * `caretPositionFromPoint` is the standard; `caretRangeFromPoint` is the older
 * WebKit name that Chrome and Safari still ship. Both are supported because
 * neither is universal yet.
 */
function characterAtPoint(x: number, y: number): { text: string; offset: number } | null {
  const document_ = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  let node: Node | null = null;
  let offset = 0;

  if (typeof document_.caretPositionFromPoint === 'function') {
    const position = document_.caretPositionFromPoint(x, y);
    if (position) {
      node = position.offsetNode;
      offset = position.offset;
    }
  } else if (typeof document_.caretRangeFromPoint === 'function') {
    const range = document_.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }

  if (!node || node.nodeType !== Node.TEXT_NODE) return null;

  // Only text inside a rendered line counts; the topbar and the controls do not.
  const element = node.parentElement;
  if (!element?.closest('.th-line-text')) return null;

  const text = node.textContent ?? '';
  if (offset >= text.length) return null;
  return { text, offset };
}

const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/;
function hasJapanese(text: string): boolean {
  return JAPANESE.test(text);
}
