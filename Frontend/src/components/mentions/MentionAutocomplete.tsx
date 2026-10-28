import { useQuery } from '@tanstack/react-query';
import { AtSign, Search } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { multiSearchMediaFn, searchUsersFn } from '../../api/trackerApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useUserDataStore } from '../../store/userData';
import { getTextareaCaretRect } from '../../utils/caretPosition';
import {
  buildMediaMention,
  buildUserMention,
  isMentionableMediaType,
  MENTION_MEDIA_TYPE_LABEL_KEYS,
} from '../../utils/markdown';
import { getMediaDisplayTitle } from '../../utils/mediaTitle';
import Spinner from '../ui/Spinner';
import UserAvatar from '../UserAvatar';
import MentionPickerModal, { type MentionTab } from './MentionPickerModal';
import { useNativeDismiss } from '../../native/useNativeDismiss';

/**
 * Match an @ trigger that ends at the caret.
 * The character before the @ must not continue a word, so email addresses do not open the menu.
 */
const TRIGGER_REGEX = /(^|[^A-Za-z0-9_.+\-`[])@([^\s@[\]|`]{0,30})$/;
const MIN_SEARCH_LENGTH = 2;
const RESULTS_PER_KIND = 5;
const POPOVER_WIDTH = 320;
const POPOVER_MAX_HEIGHT = 320;
const VIEWPORT_GUTTER = 8;

interface Trigger {
  /** Offset of the @ character. */
  start: number;
  query: string;
}

interface Option {
  id: string;
  kind: 'user' | 'media' | 'browse';
  token?: string;
  content: ReactNode;
}

interface MentionAutocompleteProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  maxLength?: number;
}

function detectTrigger(textarea: HTMLTextAreaElement): Trigger | null {
  if (document.activeElement !== textarea) return null;
  const { selectionStart, selectionEnd, value } = textarea;
  if (selectionStart !== selectionEnd) return null;
  const match = TRIGGER_REGEX.exec(value.slice(0, selectionStart));
  if (!match) return null;
  return {
    start: selectionStart - match[2].length - 1,
    query: match[2],
  };
}

/**
 * Show user and work suggestions while the author types `@name` in a textarea.
 * Keyboard: arrows move, Enter or Tab inserts, Escape closes until the next @.
 */
export default function MentionAutocomplete({
  textareaRef,
  onChange,
  maxLength,
}: MentionAutocompleteProps) {
  const { t } = useTranslation('common');
  const listboxId = useId();
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [modalQuery, setModalQuery] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<MentionTab>('users');
  const dismissedStartRef = useRef<number | null>(null);
  const modalRangeRef = useRef<{ start: number; end: number } | null>(null);
  const blurAdult = useUserDataStore(
    (state) => state.user?.settings?.blurAdultContent ?? false
  );

  const query = trigger?.query ?? '';
  const debouncedQuery = useDebounce(query, 200);
  const canSearch =
    trigger !== null && debouncedQuery.length >= MIN_SEARCH_LENGTH;

  const usersQuery = useQuery({
    queryKey: ['mentionSearch', 'users', debouncedQuery],
    queryFn: () => searchUsersFn(debouncedQuery),
    enabled: canSearch,
    staleTime: 60 * 1000,
    meta: { silentError: true },
  });
  const mediaQuery = useQuery({
    queryKey: ['mentionSearch', 'media', debouncedQuery, RESULTS_PER_KIND],
    queryFn: () =>
      multiSearchMediaFn({ search: debouncedQuery, perPage: RESULTS_PER_KIND }),
    enabled: canSearch,
    staleTime: 60 * 1000,
    meta: { silentError: true },
  });

  const users = canSearch
    ? (usersQuery.data ?? []).slice(0, RESULTS_PER_KIND)
    : [];
  const works = canSearch
    ? (mediaQuery.data ?? [])
        .filter((media) => isMentionableMediaType(media.type))
        .slice(0, RESULTS_PER_KIND)
    : [];
  const isSearching =
    query.length >= MIN_SEARCH_LENGTH &&
    (query !== debouncedQuery || usersQuery.isFetching || mediaQuery.isFetching);

  const options = useMemo<Option[]>(() => {
    const userOptions: Option[] = users.map((user) => ({
      id: `user-${user._id}`,
      kind: 'user',
      token: buildUserMention(user.username),
      content: (
        <>
          <UserAvatar
            username={user.username}
            avatar={user.avatar}
            containerClassName="h-7 w-7 shrink-0 rounded-full"
            textClassName="text-xs font-semibold"
          />
          <span className="min-w-0 flex-1 truncate font-medium">
            @{user.username}
          </span>
        </>
      ),
    }));
    const mediaOptions: Option[] = works.flatMap((media) => {
      if (!isMentionableMediaType(media.type)) return [];
      const title = getMediaDisplayTitle(media);
      const isAdultImage =
        media.type === 'vn' ? (media.isAdultImage ?? false) : media.isAdult;
      return [
        {
          id: `media-${media.type}-${media.contentId}`,
          kind: 'media' as const,
          token: buildMediaMention(media.type, media.contentId, title),
          content: (
            <>
              {media.contentImage ? (
                <img
                  src={media.contentImage}
                  alt=""
                  loading="lazy"
                  className={`h-9 w-6 shrink-0 rounded-sm object-cover ${
                    isAdultImage && blurAdult ? 'blur-sm' : ''
                  }`}
                />
              ) : (
                <span className="h-9 w-6 shrink-0 rounded-sm bg-base-300" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{title}</span>
                <span className="block truncate text-xs text-base-content/60">
                  {t(MENTION_MEDIA_TYPE_LABEL_KEYS[media.type])}
                </span>
              </span>
            </>
          ),
        },
      ];
    });
    const browse: Option = {
      id: 'browse',
      kind: 'browse',
      content: (
        <>
          <Search className="h-4 w-4 shrink-0 opacity-60" />
          <span className="min-w-0 flex-1 truncate">
            {query.length >= MIN_SEARCH_LENGTH
              ? t('mentions.searchAll', { query })
              : t('mentions.browse')}
          </span>
        </>
      ),
    };
    return [...userOptions, ...mediaOptions, browse];
    // `users` and `works` are new arrays each render. Their source data drives the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersQuery.data, mediaQuery.data, canSearch, query, blurAdult, t]);

  const close = useCallback(() => setTrigger(null), []);
  useNativeDismiss(trigger !== null, close);

  const refresh = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const next = detectTrigger(textarea);
    if (!next || next.start === dismissedStartRef.current) {
      if (!next) dismissedStartRef.current = null;
      setTrigger(null);
      return;
    }
    setTrigger((previous) =>
      previous?.start === next.start && previous.query === next.query
        ? previous
        : next
    );
  }, [textareaRef]);

  const replaceRange = useCallback(
    (start: number, end: number, token: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const { value } = textarea;
      const after = value.slice(end);
      const inserted = after.startsWith(' ') ? token : `${token} `;
      const nextValue = value.slice(0, start) + inserted + after;
      if (maxLength !== undefined && nextValue.length > maxLength) return;
      onChange(nextValue);
      setTrigger(null);
      const cursor = start + inserted.length + (after.startsWith(' ') ? 1 : 0);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      });
    },
    [maxLength, onChange, textareaRef]
  );

  const choose = useCallback(
    (option: Option) => {
      const textarea = textareaRef.current;
      if (!textarea || !trigger) return;
      const end = textarea.selectionStart;
      if (option.kind === 'browse') {
        modalRangeRef.current = { start: trigger.start, end };
        setModalTab(users.length === 0 && works.length > 0 ? 'media' : 'users');
        setModalQuery(trigger.query);
        setTrigger(null);
        return;
      }
      if (option.token) replaceRange(trigger.start, end, option.token);
    },
    [replaceRange, textareaRef, trigger, users.length, works.length]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [trigger?.start, debouncedQuery]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const handleBlur = () => setTrigger(null);
    const events = ['input', 'click', 'keyup', 'focus', 'select'] as const;
    events.forEach((name) => textarea.addEventListener(name, refresh));
    textarea.addEventListener('blur', handleBlur);
    return () => {
      events.forEach((name) => textarea.removeEventListener(name, refresh));
      textarea.removeEventListener('blur', handleBlur);
    };
  }, [refresh, textareaRef]);

  // Handle navigation keys on the element so that they never reach the editor's own shortcuts.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !trigger) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      let handled = true;
      if (event.key === 'ArrowDown') {
        setActiveIndex((index) => (index + 1) % options.length);
      } else if (event.key === 'ArrowUp') {
        setActiveIndex(
          (index) => (index - 1 + options.length) % options.length
        );
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        const option = options[activeIndex];
        if (option.kind === 'browse' && query.length < MIN_SEARCH_LENGTH) {
          handled = event.key === 'Tab';
          if (handled) choose(option);
        } else {
          choose(option);
        }
      } else if (event.key === 'Escape') {
        dismissedStartRef.current = trigger.start;
        close();
      } else {
        handled = false;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    textarea.addEventListener('keydown', handleKeyDown);
    return () => textarea.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, choose, close, options, query, textareaRef, trigger]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (trigger) {
      textarea.setAttribute('aria-autocomplete', 'list');
      textarea.setAttribute('aria-expanded', 'true');
      textarea.setAttribute('aria-controls', listboxId);
      textarea.setAttribute(
        'aria-activedescendant',
        `${listboxId}-${activeIndex}`
      );
    } else {
      textarea.setAttribute('aria-expanded', 'false');
      textarea.removeAttribute('aria-activedescendant');
    }
  }, [activeIndex, listboxId, textareaRef, trigger]);

  // A <dialog> renders in the top layer. Portal into it so that the menu shows above it.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !trigger) {
      setPosition(null);
      return;
    }
    setPortalTarget(textarea.closest('dialog') ?? document.body);

    const place = () => {
      const caret = getTextareaCaretRect(textarea, trigger.start);
      const left = Math.min(
        Math.max(caret.left, VIEWPORT_GUTTER),
        window.innerWidth - POPOVER_WIDTH - VIEWPORT_GUTTER
      );
      const below = caret.top + caret.height + 4;
      const fitsBelow =
        below + POPOVER_MAX_HEIGHT <= window.innerHeight ||
        caret.top < POPOVER_MAX_HEIGHT;
      setPosition(
        fitsBelow
          ? { left: Math.max(left, VIEWPORT_GUTTER), top: below }
          : {
              left: Math.max(left, VIEWPORT_GUTTER),
              bottom: window.innerHeight - caret.top + 4,
            }
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [textareaRef, trigger]);

  useEffect(() => {
    document
      .getElementById(`${listboxId}-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listboxId]);

  const userCount = users.length;
  const mediaCount = works.length;
  const showNoResults =
    canSearch && !isSearching && userCount === 0 && mediaCount === 0;

  const renderOption = (option: Option, index: number) => (
    <li
      key={option.id}
      id={`${listboxId}-${index}`}
      role="option"
      aria-selected={index === activeIndex}
      className={`flex cursor-pointer items-center gap-2.5 rounded-field px-2.5 py-1.5 text-sm ${
        index === activeIndex ? 'bg-base-200' : ''
      }`}
      onMouseEnter={() => setActiveIndex(index)}
      onClick={() => choose(option)}
    >
      {option.content}
    </li>
  );

  const popover =
    trigger && position && portalTarget
      ? createPortal(
          <div
            className="surface-raised fixed z-50 flex flex-col overflow-hidden"
            style={{
              ...position,
              width: POPOVER_WIDTH,
              maxWidth: `calc(100vw - ${VIEWPORT_GUTTER * 2}px)`,
              maxHeight: POPOVER_MAX_HEIGHT,
            }}
            // Keep focus in the textarea while the author clicks an option.
            onMouseDown={(event) => event.preventDefault()}
          >
            <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2 text-xs text-base-content/70">
              <AtSign className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                {query.length < MIN_SEARCH_LENGTH
                  ? t('mentions.autocompleteHint')
                  : t('mentions.autocompleteSearching', { query })}
              </span>
              {isSearching && <Spinner size="xs" />}
            </div>
            <ul
              id={listboxId}
              role="listbox"
              aria-label={t('mentions.title')}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
            >
              {userCount > 0 && (
                <li
                  role="presentation"
                  className="px-2.5 pb-1 pt-1.5 text-xs font-semibold text-base-content/50"
                >
                  {t('mentions.users')}
                </li>
              )}
              {options
                .slice(0, userCount)
                .map((option, index) => renderOption(option, index))}
              {mediaCount > 0 && (
                <li
                  role="presentation"
                  className="px-2.5 pb-1 pt-1.5 text-xs font-semibold text-base-content/50"
                >
                  {t('mentions.media')}
                </li>
              )}
              {options
                .slice(userCount, userCount + mediaCount)
                .map((option, index) =>
                  renderOption(option, userCount + index)
                )}
              {showNoResults && (
                <li
                  role="presentation"
                  className="px-2.5 py-2 text-xs text-base-content/60"
                >
                  {t('mentions.noResults', { query: debouncedQuery })}
                </li>
              )}
              {(userCount > 0 || mediaCount > 0) && (
                <li role="presentation" className="my-1 border-t border-base-300" />
              )}
              {renderOption(options[options.length - 1], options.length - 1)}
            </ul>
            <p className="hidden border-t border-base-300 px-3 py-1.5 text-[0.7rem] text-base-content/50 sm:block">
              {t('mentions.keyboardHint')}
            </p>
          </div>,
          portalTarget
        )
      : null;

  return (
    <>
      {popover}
      {createPortal(
        <MentionPickerModal
          open={modalQuery !== null}
          initialQuery={modalQuery ?? ''}
          initialTab={modalTab}
          onClose={() => setModalQuery(null)}
          onSelect={(token) => {
            const range = modalRangeRef.current;
            if (range) replaceRange(range.start, range.end, token);
          }}
        />,
        document.body
      )}
    </>
  );
}
