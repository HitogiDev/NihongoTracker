import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getImmersionListFn,
  getUntrackedLogsFn,
  updateUserFn,
} from '../api/trackerApi';
import { useState, useMemo } from 'react';
import { IMediaDocument, IImmersionList } from '../types';
import { useUserDataStore } from '../store/userData';
import {
  MdSearch,
  MdFilterList,
  MdSort,
  MdViewModule,
  MdViewList,
  MdAutoAwesome,
  MdTrendingUp,
  MdBookmark,
  MdPlayArrow,
  MdBook,
  MdGamepad,
  MdVideoLibrary,
  MdWarning,
  MdLink,
  MdMovie,
  MdOutlineTv,
  MdClose,
} from 'react-icons/md';

type ViewMode = 'grid' | 'list';
type SortOption = 'title' | 'type' | 'recent';
type FilterOption =
  | 'all'
  | 'anime'
  | 'manga'
  | 'reading'
  | 'vn'
  | 'video'
  | 'movie'
  | 'tv show';

function ListScreen() {
  const { username } = useParams<{ username: string }>();
  const { user, setUser } = useUserDataStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('title');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showHideAlertModal, setShowHideAlertModal] = useState(false);

  const {
    data: immersionList,
    isLoading,
    error,
  } = useQuery<IImmersionList>({
    queryKey: ['ImmersionList', username],
    queryFn: () => getImmersionListFn(username!),
    enabled: !!username,
    staleTime: 5 * 60 * 1000,
  });

  const { data: untrackedLogs } = useQuery({
    queryKey: ['untrackedLogs'],
    queryFn: getUntrackedLogsFn,
    enabled: !!user && username === user.username,
    staleTime: 5 * 60 * 1000,
  });

  const { mutate: updateUserSettings } = useMutation({
    mutationFn: updateUserFn,
    onSuccess: (data) => {
      setUser(data);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setShowHideAlertModal(false);
    },
    onError: (error) => {
      console.error('Failed to update settings:', error);
    },
  });

  const allMedia = useMemo(() => {
    if (!immersionList) return [];

    return [
      ...immersionList.anime.map((item) => ({
        ...item,
        category: 'anime' as const,
      })),
      ...immersionList.manga.map((item) => ({
        ...item,
        category: 'manga' as const,
      })),
      ...immersionList.reading.map((item) => ({
        ...item,
        category: 'reading' as const,
      })),
      ...immersionList.vn.map((item) => ({ ...item, category: 'vn' as const })),
      ...immersionList.video.map((item) => ({
        ...item,
        category: 'video' as const,
      })),
      ...(immersionList.movie || []).map((item) => ({
        ...item,
        category: 'movie' as const,
      })),
      ...(immersionList['tv show'] || []).map((item) => ({
        ...item,
        category: 'tv show' as const,
      })),
    ];
  }, [immersionList]);

  const filteredAndSortedMedia = useMemo(() => {
    let filtered = allMedia;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.contentTitleNative?.toLowerCase().includes(query) ||
          item.title.contentTitleEnglish?.toLowerCase().includes(query) ||
          item.title.contentTitleRomaji?.toLowerCase().includes(query) ||
          item.synonyms?.some((synonym) =>
            synonym.toLowerCase().includes(query)
          )
      );
    }

    if (selectedFilter !== 'all') {
      filtered = filtered.filter((item) => item.type === selectedFilter);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title.contentTitleNative || '').localeCompare(
            b.title.contentTitleNative || ''
          );
        case 'type':
          return a.type.localeCompare(b.type);
        case 'recent':
          return (a.title.contentTitleNative || '').localeCompare(
            b.title.contentTitleNative || ''
          );
        default:
          return 0;
      }
    });

    return filtered;
  }, [allMedia, searchQuery, selectedFilter, sortBy]);

  const groupedMedia = useMemo(() => {
    const shouldGroup = selectedFilter === 'all' && !searchQuery.trim();

    if (!shouldGroup) {
      return { ungrouped: filteredAndSortedMedia };
    }

    const groups: Record<string, (IMediaDocument & { category: string })[]> =
      {};
    const typeOrder = [
      'anime',
      'manga',
      'reading',
      'vn',
      'video',
      'movie',
      'tv show',
    ];

    filteredAndSortedMedia.forEach((item) => {
      if (!groups[item.type]) {
        groups[item.type] = [];
      }
      groups[item.type].push(item);
    });

    Object.keys(groups).forEach((type) => {
      groups[type].sort((a, b) =>
        (a.title.contentTitleNative || '').localeCompare(
          b.title.contentTitleNative || ''
        )
      );
    });

    const orderedGroups: Record<
      string,
      (IMediaDocument & { category: string })[]
    > = {};
    typeOrder.forEach((type) => {
      if (groups[type] && groups[type].length > 0) {
        orderedGroups[type] = groups[type];
      }
    });

    return orderedGroups;
  }, [filteredAndSortedMedia, selectedFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalCount = allMedia.length;
    const typeCount = {
      anime: immersionList?.anime.length || 0,
      manga: immersionList?.manga.length || 0,
      reading: immersionList?.reading.length || 0,
      vn: immersionList?.vn.length || 0,
      video: immersionList?.video.length || 0,
      movie: immersionList?.movie?.length || 0,
      'tv show': immersionList?.['tv show']?.length || 0,
    };
    return { totalCount, typeCount };
  }, [allMedia, immersionList]);

  const handleHideUnmatchedAlert = () => {
    const formData = new FormData();
    formData.append('hideUnmatchedLogsAlert', 'true');
    updateUserSettings(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center space-y-4">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-lg">Loading your immersion library...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="alert alert-error max-w-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Failed to load immersion list</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {showHideAlertModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Hide Unmatched Logs Alert</h3>
            <div className="py-4">
              <p className="mb-4">
                Are you sure you want to stop showing alerts about unmatched
                logs?
              </p>
              <p className="text-sm text-base-content/70">
                You can still access the match media page from your{' '}
                <span className="font-semibold">Settings</span> under the{' '}
                <span className="font-semibold">Log Management</span> section.
              </p>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-warning"
                onClick={handleHideUnmatchedAlert}
              >
                Yes, hide alerts
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowHideAlertModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setShowHideAlertModal(false)}
          ></div>
        </dialog>
      )}

      <div className="min-h-screen bg-base-200">
        {untrackedLogs &&
          untrackedLogs.length > 0 &&
          !user?.settings?.hideUnmatchedLogsAlert && (
            <div className="container mx-auto px-4 pt-4">
              <div role="alert" className="alert alert-warning shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center w-full gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <MdWarning className="h-6 w-6 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-bold">Unmatched Logs Found</h3>
                      <div className="text-sm">
                        You have {untrackedLogs.length} log
                        {untrackedLogs.length !== 1 ? 's' : ''} without media.
                        Match them with the correct media.
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                      className="btn btn-sm btn-outline gap-2 flex-1 sm:flex-none"
                      onClick={() => navigate('/matchmedia')}
                    >
                      <MdLink className="h-4 w-4" />
                      <span className="sm:inline">Match Logs</span>
                    </button>
                    <button
                      className="btn btn-sm btn-ghost gap-2 flex-1 sm:flex-none"
                      onClick={() => setShowHideAlertModal(true)}
                      title="Don't show this alert again"
                    >
                      <MdClose className="h-4 w-4" />
                      <span className="sm:inline">Don't show again</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        <div className="container mx-auto px-4 mt-4 relative z-10">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body p-6">
              <div className="flex flex-col gap-4">
                {/* Search Bar */}
                <div className="w-full">
                  <label className="input input-bordered flex items-center gap-2">
                    <MdSearch className="w-5 h-5 opacity-70" />
                    <input
                      type="text"
                      className="grow"
                      placeholder="Search by title, romaji, or english..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </label>
                </div>

                {/* Filters Row */}
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  {/* Filter and Sort Dropdowns */}
                  <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    <div className="dropdown dropdown-end sm:dropdown-start flex-1 sm:flex-none">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                      >
                        <MdFilterList className="w-4 h-4" />
                        Filter:{' '}
                        {selectedFilter === 'all'
                          ? 'All Types'
                          : selectedFilter.charAt(0).toUpperCase() +
                            selectedFilter.slice(1)}
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-full sm:w-52"
                      >
                        {[
                          { value: 'all', label: 'All Types' },
                          { value: 'anime', label: 'Anime' },
                          { value: 'manga', label: 'Manga' },
                          { value: 'reading', label: 'Reading' },
                          { value: 'vn', label: 'Visual Novels' },
                          { value: 'video', label: 'Video' },
                          { value: 'movie', label: 'Movies' },
                          { value: 'tv show', label: 'TV Shows' },
                        ].map((option) => (
                          <li key={option.value}>
                            <button
                              className={
                                selectedFilter === option.value ? 'active' : ''
                              }
                              onClick={() =>
                                setSelectedFilter(option.value as FilterOption)
                              }
                            >
                              {option.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="dropdown dropdown-end sm:dropdown-start flex-1 sm:flex-none">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                      >
                        <MdSort className="w-4 h-4" />
                        Sort:{' '}
                        {sortBy === 'title'
                          ? 'Title'
                          : sortBy === 'type'
                            ? 'Type'
                            : 'Recent'}
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 rounded-box w-full sm:w-52"
                      >
                        {[
                          { value: 'title', label: 'By Title (A-Z)' },
                          { value: 'type', label: 'By Type' },
                          { value: 'recent', label: 'Recently Added' },
                        ].map((option) => (
                          <li key={option.value}>
                            <button
                              className={
                                sortBy === option.value ? 'active' : ''
                              }
                              onClick={() =>
                                setSortBy(option.value as SortOption)
                              }
                            >
                              {option.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="join w-full sm:w-auto">
                    <button
                      className={`btn join-item flex-1 sm:flex-none ${viewMode === 'grid' ? 'btn-active' : 'btn-outline'}`}
                      onClick={() => setViewMode('grid')}
                    >
                      <MdViewModule className="w-4 h-4" />
                      <span className="sm:hidden ml-2">Grid</span>
                    </button>
                    <button
                      className={`btn join-item flex-1 sm:flex-none ${viewMode === 'list' ? 'btn-active' : 'btn-outline'}`}
                      onClick={() => setViewMode('list')}
                    >
                      <MdViewList className="w-4 h-4" />
                      <span className="sm:hidden ml-2">List</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-base-content/70">
                  Showing{' '}
                  {Object.keys(groupedMedia).includes('ungrouped')
                    ? groupedMedia.ungrouped?.length || 0
                    : Object.values(groupedMedia).reduce(
                        (acc, group) => acc + group.length,
                        0
                      )}{' '}
                  of {stats.totalCount} items
                  {searchQuery && ` for "${searchQuery}"`}
                </p>
                {(Object.keys(groupedMedia).includes('ungrouped')
                  ? (groupedMedia.ungrouped?.length || 0) > 0
                  : Object.values(groupedMedia).some(
                      (group) => group.length > 0
                    )) && (
                  <div className="flex items-center gap-2 text-sm text-base-content/70">
                    <MdAutoAwesome className="w-4 h-4" />
                    <span>
                      {username !== user?.username ? username + "'s" : 'Your'}{' '}
                      immersion journey
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-4">
          {Object.keys(groupedMedia).includes('ungrouped') ? (
            groupedMedia.ungrouped && groupedMedia.ungrouped.length === 0 ? (
              <div className="text-center py-20">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-24 h-24 mx-auto bg-base-300 rounded-full flex items-center justify-center">
                    <MdBookmark className="w-12 h-12 text-base-content/40" />
                  </div>
                  <h3 className="text-2xl font-bold">No media found</h3>
                  <p className="text-base-content/70">
                    {searchQuery
                      ? `No media matches your search for "${searchQuery}". Try different keywords or filters.`
                      : selectedFilter !== 'all'
                        ? `No ${selectedFilter} media in your library yet.`
                        : 'Your immersion library is empty. Start logging your Japanese learning activities!'}
                  </p>
                  {(searchQuery || selectedFilter !== 'all') && (
                    <button
                      className="btn btn-outline"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedFilter('all');
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {groupedMedia.ungrouped?.map((item) => (
                  <MediaCard key={item.contentId} media={item} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {groupedMedia.ungrouped?.map((item) => (
                  <MediaListItem key={item.contentId} media={item} />
                ))}
              </div>
            )
          ) : // Grouped view (no filters applied)
          Object.keys(groupedMedia).length === 0 ? (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-24 h-24 mx-auto bg-base-300 rounded-full flex items-center justify-center">
                  <MdBookmark className="w-12 h-12 text-base-content/40" />
                </div>
                <h3 className="text-2xl font-bold">No media found</h3>
                <p className="text-base-content/70">
                  Your immersion library is empty. Start logging your Japanese
                  learning activities!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedMedia).map(([type, mediaList]) => (
                <MediaGroup
                  key={type}
                  type={type}
                  mediaList={mediaList}
                  viewMode={viewMode}
                  count={mediaList.length}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MediaGroup({
  type,
  mediaList,
  viewMode,
  count,
}: {
  type: string;
  mediaList: (IMediaDocument & { category: string })[];
  viewMode: ViewMode;
  count: number;
}) {
  const typeConfig = {
    anime: {
      icon: MdPlayArrow,
      color: 'text-secondary',
      label: 'Anime',
    },
    manga: {
      icon: MdBook,
      color: 'text-warning',
      label: 'Manga',
    },
    reading: {
      icon: MdBook,
      color: 'text-primary',
      label: 'Reading',
    },
    vn: {
      icon: MdGamepad,
      color: 'text-accent',
      label: 'Visual Novels',
    },
    video: {
      icon: MdVideoLibrary,
      color: 'text-info',
      label: 'Video',
    },
    movie: {
      icon: MdMovie,
      color: 'text-error',
      label: 'Movies',
    },
    'tv show': {
      icon: MdOutlineTv,
      color: 'text-success',
      label: 'TV Shows',
    },
  };

  const config = typeConfig[type as keyof typeof typeConfig];
  const TypeIcon = config?.icon || MdBookmark;

  if (!config) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b border-base-300">
        <div className={`p-2 rounded-lg bg-base-200 ${config.color}`}>
          <TypeIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{config.label}</h2>
          <p className="text-sm text-base-content/60">
            {count} {count === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {mediaList.map((item) => (
            <MediaCard key={item.contentId} media={item} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {mediaList.map((item) => (
            <MediaListItem key={item.contentId} media={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({
  media,
}: {
  media: IMediaDocument & { category: string };
}) {
  const { user } = useUserDataStore();
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/${media.type}/${media.contentId}/${username}`);
  };

  const typeConfig = {
    anime: {
      icon: MdPlayArrow,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      border: 'border-secondary/20',
    },
    manga: {
      icon: MdBook,
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/20',
    },
    reading: {
      icon: MdBook,
      color: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary/20',
    },
    vn: {
      icon: MdGamepad,
      color: 'text-accent',
      bg: 'bg-accent/10',
      border: 'border-accent/20',
    },
    video: {
      icon: MdVideoLibrary,
      color: 'text-info',
      bg: 'bg-info/10',
      border: 'border-info/20',
    },
    movie: {
      icon: MdMovie,
      color: 'text-error',
      bg: 'bg-error/10',
      border: 'border-error/20',
    },
    'tv show': {
      icon: MdOutlineTv,
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/20',
    },
  };

  const config = typeConfig[media.type as keyof typeof typeConfig];
  const TypeIcon = config.icon;

  return (
    <div
      className={`card bg-base-100 shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer border ${config.border}`}
      onClick={handleCardClick}
    >
      <figure className="relative aspect-[3/4] overflow-hidden">
        {media.contentImage || media.coverImage ? (
          <img
            src={media.contentImage || media.coverImage}
            alt={media.title.contentTitleNative}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${media.isAdult && user?.settings?.blurAdultContent ? 'filter blur-sm' : ''}`}
            loading="lazy"
          />
        ) : (
          <div
            className={`w-full h-full ${config.bg} flex items-center justify-center`}
          >
            <TypeIcon className={`w-12 h-12 ${config.color} opacity-50`} />
          </div>
        )}

        {media.isAdult && (
          <div className="absolute top-2 right-2">
            <div className="badge badge-error badge-sm">18+</div>
          </div>
        )}

        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="text-white text-center p-4">
            <MdTrendingUp className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm font-medium">View Details</p>
          </div>
        </div>
      </figure>

      <div className="card-body p-3 flex flex-col">
        <div className="flex-1 space-y-1">
          <h3
            className="font-bold text-sm leading-tight line-clamp-2"
            title={media.title.contentTitleNative}
          >
            {media.title.contentTitleNative}
          </h3>

          {media.title.contentTitleEnglish && (
            <p
              className="text-xs text-base-content/60 line-clamp-1"
              title={media.title.contentTitleEnglish}
            >
              {media.title.contentTitleEnglish}
            </p>
          )}
        </div>

        <div className="pt-2 mt-auto">
          <span
            className={`badge ${config.bg} ${config.color} badge-ghost badge-xs border-0`}
          >
            <TypeIcon className="w-3 h-3 mr-1" />
            {media.type === 'vn'
              ? 'VN'
              : media.type === 'tv show'
                ? 'TV Show'
                : media.type.charAt(0).toUpperCase() + media.type.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

function MediaListItem({
  media,
}: {
  media: IMediaDocument & { category: string };
}) {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/${media.type}/${media.contentId}/${username}`);
  };

  const typeConfig = {
    anime: {
      icon: MdPlayArrow,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
    },
    manga: { icon: MdBook, color: 'text-warning', bg: 'bg-warning/10' },
    reading: { icon: MdBook, color: 'text-primary', bg: 'bg-primary/10' },
    vn: { icon: MdGamepad, color: 'text-accent', bg: 'bg-accent/10' },
    video: { icon: MdVideoLibrary, color: 'text-info', bg: 'bg-info/10' },
    movie: { icon: MdMovie, color: 'text-error', bg: 'bg-error/10' },
    'tv show': {
      icon: MdOutlineTv,
      color: 'text-success',
      bg: 'bg-success/10',
    },
  };

  const config = typeConfig[media.type as keyof typeof typeConfig];
  const TypeIcon = config.icon;

  return (
    <div
      className="card bg-base-100 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="card-body p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="w-16 h-20 flex-shrink-0 rounded-lg overflow-hidden">
            {media.contentImage || media.coverImage ? (
              <img
                src={media.contentImage || media.coverImage}
                alt={media.title.contentTitleNative}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className={`w-full h-full ${config.bg} flex items-center justify-center`}
              >
                <TypeIcon className={`w-6 h-6 ${config.color} opacity-50`} />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-lg leading-tight mb-1">
                  {media.title.contentTitleNative}
                </h3>

                {media.title.contentTitleEnglish && (
                  <p className="text-sm text-base-content/60 mb-2">
                    {media.title.contentTitleEnglish}
                  </p>
                )}

                {media.title.contentTitleRomaji && (
                  <p className="text-xs text-base-content/50 mb-2">
                    {media.title.contentTitleRomaji}
                  </p>
                )}

                {media.description && media.description.length > 0 && (
                  <p className="text-sm text-base-content/70 line-clamp-2">
                    {media.description.find((desc) => desc.language === 'eng')
                      ?.description ||
                      media.description[0]?.description ||
                      'No description available'}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                {/* Type Badge */}
                <div
                  className={`badge gap-1 ${config.bg} ${config.color} border-0`}
                >
                  <TypeIcon className="w-3 h-3" />
                  {media.type === 'vn'
                    ? 'Visual Novel'
                    : media.type === 'tv show'
                      ? 'TV Show'
                      : media.type.charAt(0).toUpperCase() +
                        media.type.slice(1)}
                </div>

                {media.isAdult && (
                  <div className="badge badge-error badge-sm">18+</div>
                )}

                <div className="flex flex-wrap gap-1 justify-end">
                  {media.episodes ? (
                    <span className="badge badge-ghost badge-sm">
                      {media.episodes} episodes
                    </span>
                  ) : null}
                  {media.chapters ? (
                    <span className="badge badge-ghost badge-sm">
                      {media.chapters} chapters
                    </span>
                  ) : null}
                  {media.volumes ? (
                    <span className="badge badge-ghost badge-sm">
                      {media.volumes} volumes
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListScreen;
