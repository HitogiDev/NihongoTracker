import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { multiSearchMediaFn, searchUsersFn } from '../../api/trackerApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useUserDataStore } from '../../store/userData';
import {
  buildMediaMention,
  buildUserMention,
  isMentionableMediaType,
  MENTION_MEDIA_TYPE_LABEL_KEYS,
} from '../../utils/markdown';
import { getMediaDisplayTitle } from '../../utils/mediaTitle';
import Modal from '../ui/Modal';
import RowButton from '../ui/RowButton';
import Spinner from '../ui/Spinner';
import UserAvatar from '../UserAvatar';

export type MentionTab = 'users' | 'media';

const MIN_QUERY_LENGTH = 2;

export default function MentionPickerModal({
  open,
  onClose,
  onSelect,
  initialQuery = '',
  initialTab = 'users',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (token: string) => void;
  initialQuery?: string;
  initialTab?: MentionTab;
}) {
  const { t } = useTranslation('common');
  const [tab, setTab] = useState<MentionTab>('users');
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);
  const hasQuery = debouncedQuery.length >= MIN_QUERY_LENGTH;
  const blurAdult = useUserDataStore(
    (state) => state.user?.settings?.blurAdultContent ?? false
  );

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setTab(initialTab);
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open, initialQuery, initialTab]);

  const usersQuery = useQuery({
    queryKey: ['mentionSearch', 'users', debouncedQuery],
    queryFn: () => searchUsersFn(debouncedQuery),
    enabled: open && tab === 'users' && hasQuery,
    staleTime: 60 * 1000,
    meta: { silentError: true },
  });

  const mediaQuery = useQuery({
    queryKey: ['mentionSearch', 'media', debouncedQuery],
    queryFn: () => multiSearchMediaFn({ search: debouncedQuery, perPage: 10 }),
    enabled: open && tab === 'media' && hasQuery,
    staleTime: 60 * 1000,
    meta: { silentError: true },
  });

  const activeQuery = tab === 'users' ? usersQuery : mediaQuery;
  const mediaResults = (mediaQuery.data ?? []).filter((media) =>
    isMentionableMediaType(media.type)
  );
  const resultCount =
    tab === 'users' ? (usersQuery.data?.length ?? 0) : mediaResults.length;

  const selectTab = (next: MentionTab) => {
    setTab(next);
    inputRef.current?.focus();
  };

  const select = (token: string) => {
    onSelect(token);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('mentions.title')}
      size="lg"
    >
      <div className="space-y-3">
        <div role="tablist" className="tabs tabs-box tabs-sm">
          <button
            type="button"
            role="tab"
            className={`tab ${tab === 'users' ? 'tab-active' : ''}`}
            aria-selected={tab === 'users'}
            onClick={() => selectTab('users')}
          >
            {t('mentions.users')}
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${tab === 'media' ? 'tab-active' : ''}`}
            aria-selected={tab === 'media'}
            onClick={() => selectTab('media')}
          >
            {t('mentions.media')}
          </button>
        </div>

        <label className="input w-full focus-within:input-primary">
          <Search className="h-4 w-4 opacity-50" />
          <input
            ref={inputRef}
            type="search"
            className="grow"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === 'users'
                ? t('mentions.searchUsers')
                : t('mentions.searchMedia')
            }
          />
          {activeQuery.isFetching && <Spinner size="sm" />}
        </label>

        <div className="max-h-[24rem] overflow-y-auto overscroll-contain">
          {!hasQuery && (
            <p className="px-4 py-10 text-center text-sm text-base-content/50">
              {t('mentions.typeToSearch')}
            </p>
          )}

          {hasQuery && !activeQuery.isFetching && resultCount === 0 && (
            <p className="px-4 py-10 text-center text-sm text-base-content/50">
              {t('mentions.noResults', { query: debouncedQuery })}
            </p>
          )}

          {hasQuery &&
            tab === 'users' &&
            usersQuery.data?.map((user) => (
              <RowButton
                key={user._id}
                onClick={() => select(buildUserMention(user.username))}
              >
                <UserAvatar
                  username={user.username}
                  avatar={user.avatar}
                  containerClassName="h-9 w-9 shrink-0 rounded-full"
                />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  @{user.username}
                </span>
              </RowButton>
            ))}

          {hasQuery &&
            tab === 'media' &&
            mediaResults.map((media) => {
              const title = getMediaDisplayTitle(media);
              const isAdultImage =
                media.type === 'vn'
                  ? (media.isAdultImage ?? false)
                  : media.isAdult;
              return (
                <RowButton
                  key={`${media.type}-${media.contentId}`}
                  onClick={() =>
                    isMentionableMediaType(media.type) &&
                    select(
                      buildMediaMention(media.type, media.contentId, title)
                    )
                  }
                >
                  {media.contentImage ? (
                    <img
                      src={media.contentImage}
                      alt=""
                      loading="lazy"
                      className={`h-12 w-9 shrink-0 rounded-field object-cover ${
                        isAdultImage && blurAdult ? 'blur-sm' : ''
                      }`}
                    />
                  ) : (
                    <span className="h-12 w-9 shrink-0 rounded-field bg-base-300" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {title}
                    </span>
                    {media.title.contentTitleNative &&
                      media.title.contentTitleNative !== title && (
                        <span className="block truncate text-xs text-base-content/60">
                          {media.title.contentTitleNative}
                        </span>
                      )}
                  </span>
                  <span className="badge badge-ghost badge-sm shrink-0">
                    {isMentionableMediaType(media.type) &&
                      t(MENTION_MEDIA_TYPE_LABEL_KEYS[media.type])}
                  </span>
                </RowButton>
              );
            })}
        </div>
      </div>
    </Modal>
  );
}
