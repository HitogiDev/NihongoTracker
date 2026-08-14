import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, X } from 'lucide-react';
import {
  StructuredContent,
  useLookupHistory,
  type Glossary,
} from '@nihongotracker/yomitan-content';

import axiosInstance from '../../api/axiosConfig';
import Button from '../ui/Button';
import type { DictionaryMatch } from '../../hooks/useDictionaryLookup';

export interface DictionaryLicense {
  name: string;
  license: string;
  url: string | null;
  attribution: string;
}

export interface DictionaryPopupProps {
  /** Viewport coordinates of the character that was hovered. */
  anchor: { x: number; y: number };
  /** The term the hover resolved to, already looked up. */
  query: string;
  matches: DictionaryMatch[] | undefined;
  loading: boolean;
  failed: boolean;
  onClose: () => void;
  /** Used for cross-references, which look up a term rather than a line. */
  lookupTerm: (term: string) => Promise<DictionaryMatch[]>;
}

/** Kept away from the viewport edges so the popup never sits flush against one. */
const MARGIN = 12;
const OFFSET = 16;

export default function DictionaryPopup({
  anchor,
  query,
  matches,
  loading,
  failed,
  onClose,
  lookupTerm,
}: DictionaryPopupProps) {
  const { t } = useTranslation('texthooker');
  const history = useLookupHistory({ query });
  const container = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchor.x + OFFSET, top: anchor.y + OFFSET });
  const [active, setActive] = useState(0);

  // The hover already fetched the first term; anything deeper is a
  // cross-reference and gets fetched here.
  const [results, setResults] = useState<Record<string, DictionaryMatch[]>>({});
  // Terms already asked for, so a re-render does not ask again. A ref rather
  // than state on purpose: as state it would be both the guard and a
  // dependency of the effect below, and the re-render it caused would cancel
  // the very request it was guarding.
  const requested = useRef(new Set<string>());

  const current = history.current?.query ?? query;
  const shown = current === query ? matches : results[current];

  useEffect(() => {
    if (current === query || results[current] !== undefined) return;
    if (requested.current.has(current)) return;
    requested.current.add(current);

    lookupTerm(current)
      .then((found) => setResults((previous) => ({ ...previous, [current]: found })))
      // An empty result is how a failure shows up: the popup says it found
      // nothing rather than spinning forever.
      .catch(() => setResults((previous) => ({ ...previous, [current]: [] })));
  }, [current, query, results, lookupTerm]);

  useEffect(() => setActive(0), [current]);

  // Clamp into the viewport once the popup has a size. Flips above the cursor
  // when there is no room below, which is the common case near the bottom of a
  // long texthooker session.
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();

    let left = anchor.x + OFFSET;
    if (left + rect.width > window.innerWidth - MARGIN) {
      left = Math.max(MARGIN, window.innerWidth - rect.width - MARGIN);
    }

    let top = anchor.y + OFFSET;
    if (top + rect.height > window.innerHeight - MARGIN) {
      const above = anchor.y - rect.height - OFFSET;
      top = above >= MARGIN ? above : Math.max(MARGIN, window.innerHeight - rect.height - MARGIN);
    }

    setPosition({ left, top });
  }, [anchor.x, anchor.y, shown, loading]);

  const total = shown?.length ?? 0;

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((index) => (total === 0 ? 0 : (index + 1) % total));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((index) => (total === 0 ? 0 : (index - 1 + total) % total));
        return;
      }
      if ((event.key === 'Backspace' || (event.altKey && event.key === 'ArrowLeft')) && history.canGoBack) {
        event.preventDefault();
        history.back();
      }
    },
    [onClose, total, history]
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // Scroll the focused match into view as the arrows move through them.
  useEffect(() => {
    container.current
      ?.querySelector<HTMLElement>(`[data-match-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const dictionariesShown = useMemo(() => {
    const names = new Set<string>();
    for (const match of shown ?? []) {
      for (const gloss of match.glossaries) names.add(gloss.dictName);
    }
    return [...names];
  }, [shown]);

  // Anything not yet answered is still in flight.
  const busy = current === query ? loading : shown === undefined;

  return (
    <div
      ref={container}
      role="dialog"
      aria-label={t('dictionary.title')}
      className="fixed z-50 w-96 max-w-[calc(100vw-1.5rem)] surface-raised rounded-box shadow-lg overflow-hidden"
      style={{ left: position.left, top: position.top }}
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-base-300">
        {history.canGoBack ? (
          <Button
            appearance="ghost"
            size="sm"
            shape="circle"
            aria-label={t('dictionary.back')}
            onClick={history.back}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        ) : (
          <BookOpen className="w-4 h-4 text-base-content/50" />
        )}
        <span lang="ja" className="min-w-0 flex-1 truncate text-sm font-medium">
          {current}
        </span>
        {total > 1 ? (
          <span className="badge badge-ghost badge-sm">
            {t('dictionary.position', { index: active + 1, total })}
          </span>
        ) : null}
        <Button
          appearance="ghost"
          size="sm"
          shape="circle"
          aria-label={t('dictionary.close')}
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </header>

      <div className="max-h-80 overflow-y-auto p-3 space-y-3">
        {busy ? <p className="text-sm text-base-content/60">{t('dictionary.loading')}</p> : null}

        {!busy && failed ? (
          <p className="text-sm text-warning">{t('dictionary.unavailable')}</p>
        ) : null}

        {!busy && !failed && total === 0 ? (
          <p className="text-sm text-base-content/60">
            {t('dictionary.noResults', { term: current })}
          </p>
        ) : null}

        {shown?.map((match, index) => (
          <article
            key={`${match.expression}-${match.reading}-${index}`}
            data-match-index={index}
            className={
              index === active
                ? 'rounded-box ring-2 ring-primary/40 p-2 -m-2'
                : 'rounded-box p-2 -m-2'
            }
          >
            <h3 lang="ja" className="font-bold">
              {match.expression}
              {match.reading && match.reading !== match.expression ? (
                <span className="text-base-content/60 font-normal ml-1">【{match.reading}】</span>
              ) : null}
            </h3>

            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              {match.process.length > 0 ? (
                <span className="text-xs text-base-content/50">{match.process.join(' → ')}</span>
              ) : null}
              {match.frequencies.slice(0, 2).map((frequency) => (
                <span
                  key={`${frequency.dictName}-${frequency.display}`}
                  className="badge badge-ghost badge-xs"
                  title={frequency.dictName}
                >
                  {frequency.display}
                </span>
              ))}
            </div>

            {match.glossaries.map((gloss, glossIndex) =>
              // One dictionary entry holds a *list* of glossaries — Jitendex
              // splits senses across several — so the array is rendered, not
              // handed over as if it were a single tree.
              (Array.isArray(gloss.content) ? gloss.content : [gloss.content]).map(
                (entry, entryIndex) => (
                  <StructuredContent
                    key={`${gloss.dictName}-${glossIndex}-${entryIndex}`}
                    glossary={entry as Glossary}
                    onLookup={history.push}
                    className="text-sm mt-1"
                  />
                )
              )
            )}
          </article>
        ))}
      </div>

      <Attribution dictionaries={dictionariesShown} />
    </div>
  );
}

/**
 * Credit for whatever produced the definitions on screen.
 *
 * Jitendex is CC BY-SA 4.0 over JMdict and Tatoeba, and serving it from our own
 * product makes the attribution our obligation, not the reader's — so it is in
 * the popup rather than only on a page nobody visits.
 */
function Attribution({ dictionaries }: { dictionaries: string[] }) {
  const { t } = useTranslation('texthooker');

  const { data } = useQuery({
    queryKey: ['dictionary-licenses'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<DictionaryLicense[]>('dictionary/licenses');
      return data;
    },
    staleTime: 60 * 60_000,
    retry: false,
    enabled: dictionaries.length > 0,
  });

  if (dictionaries.length === 0) return null;

  const shown = (data ?? []).filter((entry) => dictionaries.includes(entry.name));
  const summary =
    shown.length > 0
      ? shown.map((entry) => `${shortName(entry.name)} · ${entry.license}`).join(' · ')
      : dictionaries.map(shortName).join(' · ');

  return (
    <footer className="px-3 py-1.5 border-t border-base-300 flex items-center gap-2">
      <span className="text-xs text-base-content/50 truncate" title={summary}>
        {summary}
      </span>
      <Link
        to="/licenses/dictionaries"
        target="_blank"
        rel="noreferrer"
        className="link link-hover text-xs text-base-content/60 shrink-0 ml-auto"
      >
        {t('dictionary.licenses')}
      </Link>
    </footer>
  );
}

/** `Jitendex.org [2026-08-11]` is the folder name, not something to show whole. */
function shortName(name: string): string {
  return name.replace(/\s*\[[^\]]*\]\s*$/, '');
}
