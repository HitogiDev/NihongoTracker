import { useMemo, type ReactElement } from 'react';

import { renderStructuredContent } from './render';
import type { DiagnosticsCollector } from './diagnostics';
import type { Glossary, LookupRequest, StructuredContentNode } from './types';

/**
 * The class every dictionary stylesheet is scoped to. Both this component and
 * `scopeDictionaryCss` use it, so they cannot drift apart.
 */
export const DICTIONARY_SCOPE_CLASS = 'yomitan-content';

export interface StructuredContentProps {
  /** One glossary: a structured tree, or the plain string some dictionaries use. */
  glossary: Glossary;
  /** Called when a cross-reference is activated. Without it, links are text. */
  onLookup?: (request: LookupRequest) => void;
  diagnostics?: DiagnosticsCollector;
  className?: string;
}

/**
 * Render one glossary of one dictionary entry.
 *
 * The wrapper carries `DICTIONARY_SCOPE_CLASS` because the dictionary's own
 * stylesheet is rewritten to live under it — that is the whole of the isolation
 * between an imported `.zip` and the rest of the page.
 */
export function StructuredContent({
  glossary,
  onLookup,
  diagnostics,
  className,
}: StructuredContentProps): ReactElement {
  const content: StructuredContentNode | undefined =
    typeof glossary === 'string'
      ? glossary
      : (glossary?.content as StructuredContentNode | undefined);

  const rendered = useMemo(
    () => renderStructuredContent(content, { onLookup, diagnostics }),
    [content, onLookup, diagnostics]
  );

  return (
    <div
      className={
        className
          ? `${DICTIONARY_SCOPE_CLASS} text-base-content ${className}`
          : `${DICTIONARY_SCOPE_CLASS} text-base-content`
      }
    >
      {rendered}
    </div>
  );
}
