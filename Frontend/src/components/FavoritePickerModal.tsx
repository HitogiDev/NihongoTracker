import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Play, Book, Gamepad, Video, Clapperboard, MonitorPlay } from 'lucide-react';
import { multiSearchMediaFn } from '../api/trackerApi';
import { searchAnilist } from '../api/anilistApi';
import { SearchResultType } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { useUserDataStore } from '../store/userData';

const MEDIA_TYPE_CONFIG: Record<
  string,
  { icon: typeof Play; color: string; label: string }
> = {
  anime: { icon: Play, color: 'text-secondary', label: 'Anime' },
  manga: { icon: Book, color: 'text-warning', label: 'Manga' },
  reading: { icon: Book, color: 'text-primary', label: 'Light Novel' },
  vn: { icon: Gamepad, color: 'text-accent', label: 'Visual Novel' },
  game: { icon: Gamepad, color: 'text-neutral', label: 'Video Game' },
  video: { icon: Video, color: 'text-info', label: 'Video' },
  movie: { icon: Clapperboard, color: 'text-error', label: 'Movie' },
  'tv show': { icon: MonitorPlay, color: 'text-success', label: 'TV Show' },
};

function FavoritePickerModal({
  isOpen,
  onClose,
  onSelect,
  existingKeys,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (media: SearchResultType) => void;
  /** Set of `${type}:${contentId}` already in favorites, hidden from results. */
  existingKeys: Set<string>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultType[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useUserDataStore();
  const blurAdult = user?.settings?.blurAdultContent ?? false;

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    async function performSearch() {
      setIsSearching(true);
      try {
        const dbSearchPromise = multiSearchMediaFn({
          search: debouncedQuery,
          perPage: 5,
        }).catch(() => [] as SearchResultType[]);

        const anilistPromises = [
          searchAnilist(debouncedQuery, 'ANIME', 1, 3).catch(
            () => [] as SearchResultType[]
          ),
          searchAnilist(debouncedQuery, 'MANGA', 1, 3, 'MANGA').catch(
            () => [] as SearchResultType[]
          ),
          searchAnilist(debouncedQuery, 'MANGA', 1, 3, 'NOVEL').catch(
            () => [] as SearchResultType[]
          ),
        ];

        const [dbResults, ...anilistResults] = await Promise.all([
          dbSearchPromise,
          ...anilistPromises,
        ]);
        if (controller.signal.aborted) return;

        const allMedia = [...dbResults, ...anilistResults.flat()];
        const seen = new Set<string>();
        const unique = allMedia.filter((item) => {
          const key = `${item.type}:${item.contentId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setResults(unique.slice(0, 20));
      } catch {
        // Silently ignore search errors
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }

    performSearch();
    return () => controller.abort();
  }, [debouncedQuery]);

  const visibleResults = useMemo(
    () =>
      results.filter(
        (media) => !existingKeys.has(`${media.type}:${media.contentId}`)
      ),
    [results, existingKeys]
  );

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasQuery = debouncedQuery.trim().length >= 2;

  return (
    <dialog className="modal modal-open" onClick={onClose}>
      <div
        className="modal-box max-w-2xl p-0 overflow-hidden border border-base-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-base-content/10">
          <Search className="w-5 h-5 text-base-content/40 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-base-content/30"
            placeholder="Search media to add..."
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

        <div className="max-h-[28rem] overflow-y-auto overscroll-contain">
          {!hasQuery && (
            <div className="px-4 py-16 text-center text-base-content/40">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Type at least 2 characters to search</p>
            </div>
          )}

          {hasQuery && !isSearching && visibleResults.length === 0 && (
            <div className="px-4 py-16 text-center text-base-content/40">
              <p className="text-sm">
                No results found for &ldquo;{debouncedQuery}&rdquo;
              </p>
            </div>
          )}

          {visibleResults.length > 0 && (
            <div className="divide-y divide-base-content/5">
              {visibleResults.map((media) => {
                const config =
                  MEDIA_TYPE_CONFIG[media.type] || MEDIA_TYPE_CONFIG.anime;
                const TypeIcon = config.icon;
                const shouldBlur =
                  (media.type === 'vn'
                    ? (media.isAdultImage ?? false)
                    : media.isAdult) && blurAdult;
                return (
                  <button
                    key={`${media.type}-${media.contentId}`}
                    className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 hover:bg-base-content/5"
                    onClick={() => {
                      onSelect(media);
                      onClose();
                    }}
                  >
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
                          <TypeIcon
                            className={`w-4 h-4 ${config.color} opacity-50`}
                          />
                        </div>
                      )}
                    </div>
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
                    <span className="badge badge-sm gap-1 flex-shrink-0 badge-ghost">
                      <TypeIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

export default FavoritePickerModal;
