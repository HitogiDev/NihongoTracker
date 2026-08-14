import { useCallback, useMemo, useState } from 'react';

import type { LookupRequest } from './types';

/**
 * The popup's own back-stack.
 *
 * A cross-reference inside a definition must not navigate the page; it pushes a
 * new lookup onto this stack instead, and the consumer renders a back control
 * when `canGoBack` is true.
 *
 * The label for that control is deliberately not here: every visible string in
 * both consumers goes through their own i18n bundles, and a shared package has
 * no business shipping English.
 */
export interface LookupHistory {
  /** What the popup should be showing. */
  current: LookupRequest | undefined;
  canGoBack: boolean;
  /** How many entries are behind the current one. */
  depth: number;
  push: (request: LookupRequest) => void;
  back: () => void;
  /** Start over at `request`, discarding the stack. */
  reset: (request?: LookupRequest) => void;
}

export function useLookupHistory(initial?: LookupRequest): LookupHistory {
  const [stack, setStack] = useState<LookupRequest[]>(initial ? [initial] : []);

  const push = useCallback((request: LookupRequest) => {
    setStack((previous) => {
      const top = previous[previous.length - 1];
      // Following the same cross-reference twice should not grow the stack.
      if (top && top.query === request.query && top.reading === request.reading) return previous;
      return [...previous, request];
    });
  }, []);

  const back = useCallback(() => {
    setStack((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous));
  }, []);

  const reset = useCallback((request?: LookupRequest) => {
    setStack(request ? [request] : []);
  }, []);

  return useMemo(
    () => ({
      current: stack[stack.length - 1],
      canGoBack: stack.length > 1,
      depth: Math.max(0, stack.length - 1),
      push,
      back,
      reset,
    }),
    [stack, push, back, reset]
  );
}
