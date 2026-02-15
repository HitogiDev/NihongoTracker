import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  Play,
  Book,
  Gamepad,
  Video,
  Clapperboard,
  MonitorPlay,
  X,
} from 'lucide-react';
import { searchUsersFn, searchMediaFn } from '../api/trackerApi';
import { SearchResultType } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { useUserDataStore } from '../store/userData';

type SearchTab = 'all' | 'users' | 'media';

interface UserResult {
  _id: string;
  username: string;
  avatar?: string;
  banner?: string;
  stats?: { xp: number };
}

const MEDIA_TYPE_CONFIG: Record<
  string,
  { icon: typeof Play; color: string; label: string }
> = {
  anime: { icon: Play, color: 'text-secondary', label: 'Anime' },
  manga: { icon: Book, color: 'text-warning', label: 'Manga' },
  reading: { icon: Book, color: 'text-primary', label: 'Reading' },
  vn: { icon: Gamepad, color: 'text-accent', label: 'Visual Novel' },
  video: { icon: Video, color: 'text-info', label: 'Video' },
  movie: { icon: Clapperboard, color: 'text-error', label: 'Movie' },
  'tv show': { icon: MonitorPlay, color: 'text-success', label: 'TV Show' },
};

const SEARCH_MEDIA_TYPES = [
  'anime',
  'manga',
  'vn',
  'movie',
  'tv_show',
] as const;

function MediaResultRow({
  media,
  isSelected,
  onSelect,
  blurAdult,
}: {
  media: SearchResultType;
  isSelected: boolean;
  onSelect: () => void;
  blurAdult: boolean;
}) {
  const config = MEDIA_TYPE_CONFIG[media.type] || MEDIA_TYPE_CONFIG.anime;
  const TypeIcon = config.icon;
  const shouldBlur = media.isAdult && blurAdult;

  return (
    <button
      data-selected={isSelected}
      className={`group/row relative w-full flex items-center gap-3 px-4 py-3 overflow-hidden cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-primary/15 border-l-3 border-primary pl-3.5'
          : 'hover:bg-base-content/5'
      }`}
      onClick={onSelect}
    >
      {/* Background banner image (coverImage preferred, contentImage fallback) */}
      {(media.coverImage || media.contentImage) && (
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={media.coverImage || media.contentImage}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover ${shouldBlur ? 'blur-lg' : ''}`}
          />
          <div
            className={`absolute inset-0 bg-gradient-to-r ${
              isSelected
                ? 'from-primary/30 via-base-100/70 to-base-100/50'
                : 'from-base-100/95 via-base-100/80 to-base-100/60'
            }`}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex items-center gap-3 w-full">
        {/* Poster thumbnail */}
        <div className="w-9 h-12 rounded-md overflow-hidden flex-shrink-0 ring-1 ring-base-content/10">
          {media.contentImage ? (
            <img
              src={media.contentImage}
              alt={media.title.contentTitleNative}
              className={`w-full h-full object-cover ${shouldBlur ? 'blur-sm' : ''}`}
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-base-300">
              <TypeIcon className={`w-4 h-4 ${config.color} opacity-50`} />
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 text-left min-w-0">
          <p className="font-semibold text-sm truncate leading-tight">
            {media.title.contentTitleNative ||
              media.title.contentTitleEnglish ||
              media.title.contentTitleRomaji}
          </p>
          {media.title.contentTitleEnglish &&
            media.title.contentTitleNative && (
              <p className="text-xs text-base-content/50 truncate mt-0.5">
                {media.title.contentTitleEnglish}
              </p>
            )}
        </div>

        {/* Type badge */}
        <span
          className={`badge badge-sm gap-1 flex-shrink-0 ${
            isSelected ? 'badge-primary' : 'badge-ghost'
          }`}
        >
          <TypeIcon className="w-3 h-3" />
          {config.label}
        </span>
      </div>
    </button>
  );
}

function UserResultRow({
  user,
  isSelected,
  onSelect,
}: {
  user: UserResult;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      data-selected={isSelected}
      className={`group/row relative w-full flex items-center gap-3 px-4 py-3 overflow-hidden cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-primary/15 border-l-3 border-primary pl-3.5'
          : 'hover:bg-base-content/5'
      }`}
      onClick={onSelect}
    >
      {/* Background from banner (preferred) or avatar */}
      {(user.banner || user.avatar) && (
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={user.banner || user.avatar}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className={`absolute inset-0 bg-gradient-to-r ${
              isSelected
                ? 'from-primary/30 via-base-100/70 to-base-100/50'
                : 'from-base-100/95 via-base-100/80 to-base-100/60'
            }`}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex items-center gap-3 w-full">
        <div className="avatar">
          <div className="w-9 h-9 rounded-full ring-1 ring-base-content/10">
            {user.avatar ? (
              <img src={user.avatar} alt={user.username} loading="lazy" />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-base-300">
                <User className="w-4 h-4 text-base-content/40" />
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="font-semibold text-sm truncate">{user.username}</p>
          {user.stats?.xp != null && (
            <p className="text-xs text-base-content/50">
              {user.stats.xp.toLocaleString()} XP
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function SearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [mediaResults, setMediaResults] = useState<SearchResultType[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useUserDataStore();
  const blurAdult = user?.settings?.blurAdultContent ?? false;

  const debouncedQuery = useDebounce(query, 300);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setUserResults([]);
      setMediaResults([]);
      setSelectedIndex(0);
      setActiveTab('all');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search logic
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setUserResults([]);
      setMediaResults([]);
      return;
    }

    const controller = new AbortController();

    async function performSearch() {
      setIsSearching(true);
      try {
        const promises: Promise<void>[] = [];

        if (activeTab === 'all' || activeTab === 'users') {
          promises.push(
            searchUsersFn(debouncedQuery).then((users) => {
              if (!controller.signal.aborted) setUserResults(users);
            })
          );
        }

        if (activeTab === 'all' || activeTab === 'media') {
          const mediaPromises = SEARCH_MEDIA_TYPES.map((type) =>
            searchMediaFn({
              type,
              search: debouncedQuery,
              perPage: 3,
            }).catch(() => [] as SearchResultType[])
          );

          promises.push(
            Promise.all(mediaPromises).then((results) => {
              if (!controller.signal.aborted) {
                const allMedia = results.flat();
                const seen = new Set<string>();
                const unique = allMedia.filter((item) => {
                  if (seen.has(item.contentId)) return false;
                  seen.add(item.contentId);
                  return true;
                });
                setMediaResults(unique.slice(0, 10));
              }
            })
          );
        }

        await Promise.all(promises);
      } catch {
        // Silently ignore search errors
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }

    performSearch();
    return () => controller.abort();
  }, [debouncedQuery, activeTab]);

  // Build combined results list for keyboard navigation
  const allResults: Array<{
    type: 'user' | 'media';
    data: UserResult | SearchResultType;
  }> = [];

  if (activeTab === 'all' || activeTab === 'users') {
    userResults.forEach((user) =>
      allResults.push({ type: 'user', data: user })
    );
  }
  if (activeTab === 'all' || activeTab === 'media') {
    mediaResults.forEach((media) =>
      allResults.push({ type: 'media', data: media })
    );
  }

  const allResultsRef = useRef(allResults);
  allResultsRef.current = allResults;

  const handleSelect = useCallback(
    (result: (typeof allResults)[number]) => {
      if (result.type === 'user') {
        const user = result.data as UserResult;
        navigate(`/user/${user.username}`);
      } else {
        const media = result.data as SearchResultType;
        navigate(`/${media.type}/${media.contentId}`);
      }
      onClose();
    },
    [navigate, onClose]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      const results = allResultsRef.current;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, handleSelect, onClose]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [userResults, mediaResults]);

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const selected = resultsRef.current.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const hasResults = allResults.length > 0;
  const hasQuery = debouncedQuery.trim().length >= 2;

  return (
    <dialog className="modal modal-open" onClick={onClose}>
      <div
        className="modal-box max-w-2xl p-0 overflow-hidden border border-base-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-base-content/10">
          <Search className="w-5 h-5 text-base-content/40 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-base-content/30"
            placeholder="Search users or media..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isSearching && (
            <span className="loading loading-spinner loading-sm text-primary" />
          )}
          <button className="btn btn-ghost btn-xs btn-circle" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-base-content/10">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'users', label: 'Users' },
              { id: 'media', label: 'Media' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              className={`btn btn-xs ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setActiveTab(tab.id);
                inputRef.current?.focus();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[28rem] overflow-y-auto overscroll-contain"
        >
          {!hasQuery && (
            <div className="px-4 py-16 text-center text-base-content/40">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Type at least 2 characters to search</p>
              <p className="text-xs mt-1 text-base-content/25">
                Search across users and media
              </p>
            </div>
          )}

          {hasQuery && !isSearching && !hasResults && (
            <div className="px-4 py-16 text-center text-base-content/40">
              <p className="text-sm">
                No results found for &ldquo;{debouncedQuery}&rdquo;
              </p>
            </div>
          )}

          {hasResults && (
            <div className="divide-y divide-base-content/5">
              {/* User Results */}
              {(activeTab === 'all' || activeTab === 'users') &&
                userResults.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[11px] font-bold text-base-content/40 uppercase tracking-widest">
                        Users
                      </span>
                    </div>
                    {userResults.map((user) => {
                      const idx = allResults.findIndex(
                        (r) =>
                          r.type === 'user' &&
                          (r.data as UserResult)._id === user._id
                      );
                      return (
                        <UserResultRow
                          key={user._id}
                          user={user}
                          isSelected={idx === selectedIndex}
                          onSelect={() =>
                            handleSelect({ type: 'user', data: user })
                          }
                        />
                      );
                    })}
                  </div>
                )}

              {/* Media Results */}
              {(activeTab === 'all' || activeTab === 'media') &&
                mediaResults.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[11px] font-bold text-base-content/40 uppercase tracking-widest">
                        Media
                      </span>
                    </div>
                    {mediaResults.map((media) => {
                      const idx = allResults.findIndex(
                        (r) =>
                          r.type === 'media' &&
                          (r.data as SearchResultType).contentId ===
                            media.contentId
                      );
                      return (
                        <MediaResultRow
                          key={`${media.type}-${media.contentId}`}
                          media={media}
                          isSelected={idx === selectedIndex}
                          blurAdult={blurAdult}
                          onSelect={() =>
                            handleSelect({ type: 'media', data: media })
                          }
                        />
                      );
                    })}
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-base-content/10 text-[11px] text-base-content/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="kbd kbd-xs">↑</kbd>
              <kbd className="kbd kbd-xs">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd kbd-xs">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd kbd-xs">esc</kbd>
              close
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="kbd kbd-xs">
              {/Mac|iPod|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'}
            </kbd>
            <kbd className="kbd kbd-xs">K</kbd>
          </span>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

export default SearchModal;
