import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getImmersionListFn,
  getUntrackedLogsFn,
  updateUserFn,
  updateMediaCompletionStatusFn,
} from '../api/trackerApi';
import React, { useState, useEffect, useTransition } from 'react';

import { IMediaDocument, IImmersionList } from '../types';
import { useUserDataStore } from '../store/userData';
import DOMPurify from 'dompurify';

import {
  Search,
  ListFilter,
  LayoutGrid,
  LayoutList,
  Layers,
  TrendingUp,
  Bookmark,
  Play,
  Book,
  Gamepad,
  Video,
  TriangleAlert,
  Link2,
  Clapperboard,
  MonitorPlay,
  X,
  CircleCheck,
  Circle,
  Clock,
  Ban,
  Sparkles,
  ChevronDown,
  Plus,
  Filter,
  Check,
} from 'lucide-react';

import { convertBBCodeToHtml } from '../utils/utils';
import QuickLog from '../components/QuickLog';
import { getMediaTypeColor } from '../constants/mediaColors';

type ViewMode = 'grid' | 'list';
type SortOption = 'title' | 'type' | 'recent';

type StatusFilter =
  | 'all'
  | 'completed'
  | 'in_progress'
  | 'dropped'
  | 'paused'
  | 'planning';

type MediaStatusPayload = {
  mediaId: string;
  type: IMediaDocument['type'];
  status: 'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress';
};

const STATUS_CONFIG: Record<
  'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress',
  { label: string; badgeClass: string; icon: React.FC<{ className?: string }> }
> = {
  completed: {
    label: 'Completed',
    badgeClass: 'badge-success',
    icon: CircleCheck,
  },
  dropped: { label: 'Dropped', badgeClass: 'badge-error', icon: Ban },
  paused: { label: 'Paused', badgeClass: 'badge-warning', icon: Clock },
  planning: { label: 'Planning', badgeClass: 'badge-info', icon: Sparkles },
  in_progress: {
    label: 'In Progress',
    badgeClass: 'badge-primary',
    icon: Play,
  },
};

function ListScreen() {
  const { username } = useParams<{ username: string }>();
  const { user, setUser } = useUserDataStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const MEDIA_TYPES = [
    'anime',
    'manga',
    'reading',
    'vn',
    'game',
    'video',
    'movie',
    'tv show',
  ];
  const sortOptions: SortOption[] = ['title', 'type', 'recent'];
  const viewOptions: ViewMode[] = ['grid', 'list'];
  const statusOptions: StatusFilter[] = [
    'all',
    'completed',
    'in_progress',
    'planning',
    'paused',
    'dropped',
  ];

  const initialQuery = searchParams.get('q') ?? '';
  const initialSort = searchParams.get('sort');
  const initialView = searchParams.get('view');
  const initialProgress = searchParams.get('progress');
  const initialGrouped = searchParams.get('grouped');

  const initialFilterStr = searchParams.get('type');
  const initialTypes = initialFilterStr
    ? initialFilterStr.split(',').filter((t) => MEDIA_TYPES.includes(t))
    : MEDIA_TYPES;

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialTypes);
  const [sortBy, setSortBy] = useState<SortOption>(
    sortOptions.includes(initialSort as SortOption)
      ? (initialSort as SortOption)
      : 'title'
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    viewOptions.includes(initialView as ViewMode)
      ? (initialView as ViewMode)
      : 'grid'
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    statusOptions.includes(initialProgress as StatusFilter)
      ? (initialProgress as StatusFilter)
      : 'all'
  );
  const [grouped, setGrouped] = useState<boolean>(initialGrouped !== 'false');
  const [isPendingGroup, startGroupTransition] = useTransition();
  const [showHideAlertModal, setShowHideAlertModal] = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  const [selectedMediaForLog, setSelectedMediaForLog] =
    useState<IMediaDocument | null>(null);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();

    if (searchQuery.trim()) {
      params.set('q', searchQuery);
    }
    if (
      selectedTypes.length > 0 &&
      selectedTypes.length !== MEDIA_TYPES.length
    ) {
      params.set('type', selectedTypes.join(','));
    }
    if (sortBy !== 'title') {
      params.set('sort', sortBy);
    }
    if (viewMode !== 'grid') {
      params.set('view', viewMode);
    }
    if (statusFilter !== 'all') {
      params.set('progress', statusFilter);
    }
    if (!grouped) {
      params.set('grouped', 'false');
    }

    const newSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, '');
    if (newSearch !== currentSearch) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`
      );
    }
  }, [searchQuery, selectedTypes, sortBy, viewMode, statusFilter, grouped]);

  const isOwnProfile = user?.username === username;

  const {
    data: immersionList,
    isLoading,
    error,
  } = useQuery<IImmersionList>({
    queryKey: ['ImmersionList', username],
    queryFn: () => getImmersionListFn(username!),
    enabled: !!username,
    staleTime: 30 * 1000,
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

  const updateStatusMutation = useMutation({
    mutationFn: updateMediaCompletionStatusFn,
    onMutate: ({ mediaId, type }: MediaStatusPayload) => {
      setPendingToggleId(`${type}:${mediaId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ImmersionList'] });
      if (username) {
        queryClient.invalidateQueries({ queryKey: ['recentLogs', username] });
      }
    },
    onError: (mutationError) => {
      console.error('Failed to update media status:', mutationError);
    },
    onSettled: () => {
      setPendingToggleId(null);
    },
  });

  const handleSetStatus = (
    media: IMediaDocument,
    newStatus: 'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress'
  ) => {
    if (!isOwnProfile) return;
    updateStatusMutation.mutate({
      mediaId: media.contentId,
      type: media.type,
      status: newStatus,
    });
  };

  const allMedia = (() => {
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
      ...immersionList.game.map((item) => ({
        ...item,
        category: 'game' as const,
      })),
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
  })();

  const filteredAndSortedMedia = (() => {
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

    if (selectedTypes.length !== MEDIA_TYPES.length) {
      filtered = filtered.filter((item) => selectedTypes.includes(item.type));
    }

    // Client-side status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((item) => {
        const ms = item.mediaStatus;
        if (statusFilter === 'completed') return item.isCompleted === true;
        return ms === statusFilter;
      });
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title.contentTitleNative || '').localeCompare(
            b.title.contentTitleNative || ''
          );
        case 'type':
          return a.type.localeCompare(b.type);
        case 'recent': {
          const dateA = a.lastLogDate ? new Date(a.lastLogDate).getTime() : 0;
          const dateB = b.lastLogDate ? new Date(b.lastLogDate).getTime() : 0;
          return dateB - dateA;
        }
        default:
          return 0;
      }
    });

    return filtered;
  })();

  const groupedMedia = (() => {
    // Ungrouped: user toggled off, or a search filter is active
    const shouldGroup = grouped && !searchQuery.trim();

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
      'game',
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
  })();

  const stats = (() => {
    const totalCount = allMedia.length;
    const filteredCount = filteredAndSortedMedia.length;
    return { totalCount, filteredCount };
  })();

  const handleHideUnmatchedAlert = () => {
    const formData = new FormData();
    formData.append('hideUnmatchedLogsAlert', 'true');
    updateUserSettings(formData);
  };

  const handleOpenQuickLog = (media: IMediaDocument) => {
    setSelectedMediaForLog(media);
    setIsQuickLogOpen(true);
  };

  const handleCloseQuickLog = () => {
    setIsQuickLogOpen(false);
    setSelectedMediaForLog(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        {/* Skeleton header area */}
        <div className="bg-base-100 border-b border-base-300 sticky top-0 z-30">
          <div className="container mx-auto px-4 py-4">
            <div className="skeleton h-8 w-48 mb-3 rounded-lg" />
            <div className="flex gap-2">
              <div className="skeleton h-10 flex-1 rounded-lg" />
              <div className="skeleton h-10 w-24 rounded-lg" />
              <div className="skeleton h-10 w-24 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Skeleton grid */}
        <div className="container mx-auto px-4 py-6">
          {/* Group header skeleton */}
          <div className="flex items-center gap-3 pb-2 mb-4 border-b border-base-300">
            <div className="skeleton w-9 h-9 rounded-lg" />
            <div>
              <div className="skeleton h-5 w-20 rounded mb-1" />
              <div className="skeleton h-3 w-14 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 mb-10">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="card bg-base-100 shadow-sm border border-base-300"
              >
                <div className="skeleton aspect-[3/4] w-full rounded-t-2xl rounded-b-none" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-3 w-2/3 rounded" />
                  <div className="skeleton h-4 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          {/* Second group skeleton */}
          <div className="flex items-center gap-3 pb-2 mb-4 border-b border-base-300">
            <div className="skeleton w-9 h-9 rounded-lg" />
            <div>
              <div className="skeleton h-5 w-16 rounded mb-1" />
              <div className="skeleton h-3 w-12 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="card bg-base-100 shadow-sm border border-base-300"
              >
                <div className="skeleton aspect-[3/4] w-full rounded-t-2xl rounded-b-none" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                  <div className="skeleton h-4 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
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

      {selectedMediaForLog && (
        <QuickLog
          open={isQuickLogOpen}
          onClose={handleCloseQuickLog}
          media={selectedMediaForLog}
          onLogged={() => {
            queryClient.invalidateQueries({
              queryKey: ['recentLogs', username],
            });
            queryClient.invalidateQueries({
              queryKey: ['ImmersionList', username],
            });
          }}
        />
      )}

      <div className="min-h-screen bg-base-200">
        {untrackedLogs &&
          untrackedLogs.length > 0 &&
          !user?.settings?.hideUnmatchedLogsAlert &&
          user?.username === username && (
            <div className="container mx-auto px-4 pt-4">
              <div
                role="alert"
                className="alert alert-warning shadow-lg alert-vertical sm:alert-horizontal"
              >
                <TriangleAlert className="h-6 w-6 flex-shrink-0" />
                <div>
                  <h3 className="font-bold">Unmatched Logs Found</h3>
                  <div className="text-sm">
                    You have {untrackedLogs.length} log
                    {untrackedLogs.length !== 1 ? 's' : ''} without media. Match
                    them with the correct media.
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    className="btn btn-sm btn-outline gap-2"
                    onClick={() => navigate('/matchmedia')}
                  >
                    <Link2 className="h-4 w-4" />
                    <span>Match Logs</span>
                  </button>
                  <button
                    className="btn btn-sm btn-ghost gap-2"
                    onClick={() => setShowHideAlertModal(true)}
                    title="Don't show this alert again"
                  >
                    <X className="h-4 w-4" />
                    <span>Don't show again</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        <div className="container mx-auto px-4 mt-4 relative z-50">
          <div className="card bg-base-100 shadow-sm relative z-50">
            <div className="card-body p-6">
              <div className="flex flex-col gap-4">
                {/* Search Bar */}
                <div className="w-full">
                  <label className="input input-bordered flex items-center gap-2">
                    <Search className="w-5 h-5 opacity-70" />
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
                    <div className="dropdown dropdown-end sm:dropdown-start flex-1 sm:flex-none relative z-40">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                      >
                        <Filter className="w-4 h-4" />
                        {selectedTypes.length === 0
                          ? 'No Types'
                          : selectedTypes.length === MEDIA_TYPES.length
                            ? 'All Types'
                            : selectedTypes.length === 1
                              ? selectedTypes[0] === 'vn'
                                ? 'Visual Novel'
                                : selectedTypes[0] === 'game'
                                  ? 'Video Game'
                                  : selectedTypes[0] === 'tv show'
                                    ? 'TV Show'
                                    : selectedTypes[0].charAt(0).toUpperCase() +
                                      selectedTypes[0].slice(1)
                              : `${selectedTypes.length} Types`}
                        <ChevronDown className="w-4 h-4 ml-1 hidden sm:block" />
                      </div>
                      <div
                        tabIndex={0}
                        className="dropdown-content p-3 shadow-lg bg-base-100 rounded-box w-64 border border-base-300 z-50 mt-1"
                      >
                        <div className="flex gap-2 pb-3">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline flex-1 h-9 min-h-9"
                            onClick={() => setSelectedTypes(MEDIA_TYPES)}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline flex-1 h-9 min-h-9"
                            onClick={() => setSelectedTypes([])}
                          >
                            Select None
                          </button>
                        </div>
                        <div className="divider my-1"></div>
                        <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1">
                          {MEDIA_TYPES.map((type) => {
                            const selected = selectedTypes.includes(type);
                            const color = getMediaTypeColor(type);
                            const label =
                              type === 'vn'
                                ? 'Visual Novel'
                                : type === 'game'
                                  ? 'Video Game'
                                  : type === 'tv show'
                                    ? 'TV Show'
                                    : type.charAt(0).toUpperCase() +
                                      type.slice(1);

                            return (
                              <button
                                type="button"
                                key={type}
                                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                                  selected
                                    ? 'bg-base-200 font-medium'
                                    : 'hover:bg-base-200/50'
                                }`}
                                onClick={() =>
                                  setSelectedTypes((prev) =>
                                    prev.includes(type)
                                      ? prev.filter((t) => t !== type)
                                      : [...prev, type]
                                  )
                                }
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="text-sm">{label}</span>
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                    selected
                                      ? 'border-transparent'
                                      : 'border-base-content/20'
                                  }`}
                                  style={
                                    selected
                                      ? { backgroundColor: color }
                                      : undefined
                                  }
                                >
                                  {selected && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="dropdown dropdown-end sm:dropdown-start flex-1 sm:flex-none relative z-40">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                      >
                        <CircleCheck className="w-4 h-4" />
                        Status:{' '}
                        {statusFilter === 'all'
                          ? 'All'
                          : statusFilter === 'in_progress'
                            ? 'In Progress'
                            : statusFilter.charAt(0).toUpperCase() +
                              statusFilter.slice(1)}
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-full sm:w-60"
                      >
                        {[
                          {
                            value: 'all',
                            label: 'All statuses',
                            icon: undefined,
                          },
                          {
                            value: 'completed',
                            label: 'Completed',
                            icon: CircleCheck,
                          },
                          {
                            value: 'in_progress',
                            label: 'In Progress',
                            icon: Play,
                          },
                          {
                            value: 'planning',
                            label: 'Planning',
                            icon: Sparkles,
                          },
                          { value: 'paused', label: 'Paused', icon: Clock },
                          { value: 'dropped', label: 'Dropped', icon: Ban },
                        ].map((option) => (
                          <li key={option.value}>
                            <button
                              className={
                                statusFilter === option.value ? 'active' : ''
                              }
                              onClick={() =>
                                setStatusFilter(option.value as StatusFilter)
                              }
                            >
                              {option.icon && (
                                <option.icon className="w-4 h-4 mr-1" />
                              )}
                              {option.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="dropdown dropdown-end sm:dropdown-start flex-1 sm:flex-none relative z-40">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                      >
                        <ListFilter className="w-4 h-4" />
                        Sort:{' '}
                        {sortBy === 'title'
                          ? 'Title'
                          : sortBy === 'type'
                            ? 'Type'
                            : 'Recent'}
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-full sm:w-52"
                      >
                        {[
                          { value: 'title', label: 'By Title (A-Z)' },
                          { value: 'type', label: 'By Type' },
                          { value: 'recent', label: 'Recently Logged' },
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

                  {/* View Mode + Group Toggle */}
                  <div className="flex gap-2">
                    <div className="join flex-1 sm:flex-none">
                      <button
                        className={`btn join-item flex-1 sm:flex-none ${viewMode === 'grid' ? 'btn-active' : 'btn-outline'}`}
                        onClick={() => setViewMode('grid')}
                      >
                        <LayoutGrid className="w-4 h-4" />
                        <span className="sm:hidden ml-2">Grid</span>
                      </button>
                      <button
                        className={`btn join-item flex-1 sm:flex-none ${viewMode === 'list' ? 'btn-active' : 'btn-outline'}`}
                        onClick={() => setViewMode('list')}
                      >
                        <LayoutList className="w-4 h-4" />
                        <span className="sm:hidden ml-2">List</span>
                      </button>
                    </div>
                    <button
                      className={`btn flex-1 sm:flex-none gap-2 ${grouped ? 'btn-active' : 'btn-outline'}`}
                      onClick={() =>
                        startGroupTransition(() => setGrouped((prev) => !prev))
                      }
                      title={grouped ? 'Ungroup by type' : 'Group by type'}
                    >
                      {isPendingGroup ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Layers className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">
                        {grouped ? 'Grouped' : 'Ungrouped'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-base-content/70">
                  Showing {stats.filteredCount} of {stats.totalCount} items
                  {searchQuery && ` for "${searchQuery}"`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-4">
          <div
            className={`relative transition-opacity duration-200 ${isPendingGroup ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {isPendingGroup && (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <span className="loading loading-spinner loading-md text-primary" />
              </div>
            )}
            {Object.keys(groupedMedia).includes('ungrouped') ? (
              groupedMedia.ungrouped && groupedMedia.ungrouped.length === 0 ? (
                <div className="text-center py-20">
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="w-24 h-24 mx-auto bg-base-300 rounded-full flex items-center justify-center">
                      <Bookmark className="w-12 h-12 text-base-content/40" />
                    </div>
                    <h3 className="text-2xl font-bold">No media found</h3>
                    <p className="text-base-content/70">
                      {searchQuery
                        ? `No media matches your search for "${searchQuery}". Try different keywords or filters.`
                        : selectedTypes.length !== MEDIA_TYPES.length
                          ? `No media matches the selected types.`
                          : 'Your immersion library is empty. Start logging your Japanese learning activities!'}
                    </p>
                    {(searchQuery ||
                      selectedTypes.length !== MEDIA_TYPES.length) && (
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedTypes(MEDIA_TYPES);
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
                    <MediaCard
                      key={item.contentId}
                      media={item}
                      isOwnProfile={!!isOwnProfile}
                      onSetStatus={handleSetStatus}
                      pendingToggleId={pendingToggleId}
                      onLogMedia={handleOpenQuickLog}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedMedia.ungrouped?.map((item) => (
                    <MediaListItem
                      key={item.contentId}
                      media={item}
                      isOwnProfile={!!isOwnProfile}
                      onSetStatus={handleSetStatus}
                      pendingToggleId={pendingToggleId}
                      onLogMedia={handleOpenQuickLog}
                    />
                  ))}
                </div>
              )
            ) : // Grouped view
            Object.keys(groupedMedia).length === 0 ? (
              <div className="text-center py-20">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-24 h-24 mx-auto bg-base-300 rounded-full flex items-center justify-center">
                    <Bookmark className="w-12 h-12 text-base-content/40" />
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
                    isOwnProfile={!!isOwnProfile}
                    onSetStatus={handleSetStatus}
                    pendingToggleId={pendingToggleId}
                    onLogMedia={handleOpenQuickLog}
                  />
                ))}
              </div>
            )}
          </div>
          {/* end pending overlay wrapper */}
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
  isOwnProfile,
  onSetStatus,
  pendingToggleId,
  onLogMedia,
}: {
  type: string;
  mediaList: (IMediaDocument & { category: string })[];
  viewMode: ViewMode;
  count: number;
  isOwnProfile: boolean;
  onSetStatus: (
    media: IMediaDocument,
    status: 'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress'
  ) => void;
  pendingToggleId: string | null;
  onLogMedia: (media: IMediaDocument) => void;
}) {
  const typeConfig = {
    anime: {
      icon: Play,
      color: 'text-[#26b2f2]',
      label: 'Anime',
    },
    manga: {
      icon: Book,
      color: 'text-[#ee4466]',
      label: 'Manga',
    },
    reading: {
      icon: Book,
      color: 'text-[#b34ce6]',
      label: 'Reading',
    },
    vn: {
      icon: Gamepad,
      color: 'text-[#3a70e4]',
      label: 'Visual Novels',
    },
    game: {
      icon: Gamepad,
      color: 'text-[#59c94e]',
      label: 'Video Games',
    },
    video: {
      icon: Video,
      color: 'text-[#2cc9a4]',
      label: 'Video',
    },
    movie: {
      icon: Clapperboard,
      color: 'text-[#f77118]',
      label: 'Movies',
    },
    'tv show': {
      icon: MonitorPlay,
      color: 'text-[#f8b420]',
      label: 'TV Shows',
    },
  };

  const config = typeConfig[type as keyof typeof typeConfig];
  const TypeIcon = config?.icon || Bookmark;

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
            <MediaCard
              key={item.contentId}
              media={item}
              isOwnProfile={isOwnProfile}
              onSetStatus={onSetStatus}
              pendingToggleId={pendingToggleId}
              onLogMedia={onLogMedia}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {mediaList.map((item) => (
            <MediaListItem
              key={item.contentId}
              media={item}
              isOwnProfile={isOwnProfile}
              onSetStatus={onSetStatus}
              pendingToggleId={pendingToggleId}
              onLogMedia={onLogMedia}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({
  media,
  isOwnProfile,
  onSetStatus,
  pendingToggleId,
  onLogMedia,
}: {
  media: IMediaDocument & { category: string };
  isOwnProfile: boolean;
  onSetStatus: (
    media: IMediaDocument,
    status: 'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress'
  ) => void;
  pendingToggleId: string | null;
  onLogMedia: (media: IMediaDocument) => void;
}) {
  const { user } = useUserDataStore();
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/${media.type}/${media.contentId}/${username}`);
  };

  const toggleKey = `${media.type}:${media.contentId}`;
  const isToggling = pendingToggleId === toggleKey;

  const typeConfig = {
    anime: {
      icon: Play,
      color: 'text-[#26b2f2]',
      bg: 'bg-[#26b2f2]/10',
      border: 'border-[#26b2f2]/30',
    },
    manga: {
      icon: Book,
      color: 'text-[#ee4466]',
      bg: 'bg-[#ee4466]/10',
      border: 'border-[#ee4466]/30',
    },
    reading: {
      icon: Book,
      color: 'text-[#b34ce6]',
      bg: 'bg-[#b34ce6]/10',
      border: 'border-[#b34ce6]/30',
    },
    vn: {
      icon: Gamepad,
      color: 'text-[#3a70e4]',
      bg: 'bg-[#3a70e4]/10',
      border: 'border-[#3a70e4]/30',
    },
    game: {
      icon: Gamepad,
      color: 'text-[#59c94e]',
      bg: 'bg-[#59c94e]/10',
      border: 'border-[#59c94e]/30',
    },
    video: {
      icon: Video,
      color: 'text-[#2cc9a4]',
      bg: 'bg-[#2cc9a4]/10',
      border: 'border-[#2cc9a4]/30',
    },
    movie: {
      icon: Clapperboard,
      color: 'text-[#f77118]',
      bg: 'bg-[#f77118]/10',
      border: 'border-[#f77118]/30',
    },
    'tv show': {
      icon: MonitorPlay,
      color: 'text-[#f8b420]',
      bg: 'bg-[#f8b420]/10',
      border: 'border-[#f8b420]/30',
    },
  };

  const config = typeConfig[media.type as keyof typeof typeConfig];
  const TypeIcon = config.icon;
  const currentStatus =
    media.mediaStatus ?? (media.isCompleted ? 'completed' : null);
  const statusCfg = currentStatus ? STATUS_CONFIG[currentStatus] : null;

  return (
    <div
      className={`card bg-base-100 shadow-sm hover:shadow-md transition-all duration-300 group cursor-pointer border ${config.border}`}
      onClick={handleCardClick}
    >
      <figure className="relative aspect-[3/4] overflow-hidden">
        {/* Status dropdown button — top right */}
        {isOwnProfile && (
          <div
            className="dropdown dropdown-end absolute top-2 right-2 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              tabIndex={0}
              className={`btn btn-circle btn-xs ${statusCfg ? statusCfg.badgeClass.replace('badge-', 'btn-') : 'btn-ghost bg-base-100/80 border-base-300'}`}
              disabled={isToggling}
              aria-label="Set status"
            >
              {isToggling ? (
                <span className="loading loading-spinner loading-xs" />
              ) : statusCfg ? (
                <statusCfg.icon className="w-4 h-4" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content z-50 menu p-1 shadow-lg bg-base-100 rounded-box w-36 text-sm"
            >
              {(
                Object.entries(STATUS_CONFIG) as [
                  keyof typeof STATUS_CONFIG,
                  (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG],
                ][]
              ).map(([key, cfg]) => (
                <li key={key}>
                  <button
                    className={`gap-2 ${currentStatus === key ? 'active' : ''}`}
                    onClick={() => onSetStatus(media, key)}
                  >
                    <cfg.icon className="w-3 h-3" />
                    {cfg.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

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

        {/* Status badge — bottom left */}
        {statusCfg && (
          <div className="absolute bottom-2 left-2">
            <div className={`badge ${statusCfg.badgeClass} badge-sm gap-1`}>
              <statusCfg.icon className="w-3 h-3" /> {statusCfg.label}
            </div>
          </div>
        )}

        {media.isAdult && (
          <div className="absolute top-2 left-2">
            <div className="badge badge-error badge-sm">18+</div>
          </div>
        )}

        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-0 pointer-events-none">
          <div className="text-white text-center p-4">
            <TrendingUp className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm font-medium">View Details</p>
          </div>
        </div>

        {isOwnProfile && (
          <button
            type="button"
            className="btn btn-circle btn-sm btn-primary absolute bottom-2 right-2 z-20 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            onClick={(e) => {
              e.stopPropagation();
              onLogMedia(media);
            }}
            title="Quick Log"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
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
              : media.type === 'game'
                ? 'Game'
                : media.type === 'tv show'
                  ? 'TV Show'
                  : media.type === 'reading'
                    ? 'Light Novel'
                    : media.type.charAt(0).toUpperCase() + media.type.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

function MediaListItem({
  media,
  isOwnProfile,
  onSetStatus,
  pendingToggleId,
  onLogMedia,
}: {
  media: IMediaDocument & { category: string };
  isOwnProfile: boolean;
  onSetStatus: (
    media: IMediaDocument,
    status: 'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress'
  ) => void;
  pendingToggleId: string | null;
  onLogMedia: (media: IMediaDocument) => void;
}) {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const toggleKey = `${media.type}:${media.contentId}`;
  const isToggling = pendingToggleId === toggleKey;

  const descriptionText = (() => {
    if (!media.description || media.description.length === 0) {
      return '';
    }

    const rawDescription =
      media.description.find((desc) => desc.language === 'eng')?.description ??
      media.description[0]?.description ??
      '';

    const normalizedSource = rawDescription
      .replace(/\r\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, ' ')
      .replace(/\u00a0/gi, ' ');

    const sourceWithoutQuoteMarkers = normalizedSource.replace(
      /(^|\n)\s*>+\s?/g,
      '$1'
    );

    if (!sourceWithoutQuoteMarkers.trim()) {
      return 'No description available';
    }

    let formattedDescription = sourceWithoutQuoteMarkers;

    if (
      /\[(b|i|u|s|url|img|spoiler|quote|code|list|\*)\b/i.test(
        sourceWithoutQuoteMarkers
      )
    ) {
      formattedDescription = convertBBCodeToHtml(sourceWithoutQuoteMarkers);
    } else if (!/<[a-z][\s\S]*>/i.test(sourceWithoutQuoteMarkers)) {
      formattedDescription = sourceWithoutQuoteMarkers.replace(/\n+/g, '\n');
    }

    const normalizedDescription = formattedDescription
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/?(div|li)>/gi, '\n')
      .replace(/<\/?h[1-6][^>]*>/gi, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n');

    const plainDescription = DOMPurify.sanitize(normalizedDescription, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });

    const withoutQuoteMarkers = plainDescription
      .replace(/(^|\n)\s*>+\s?/g, '$1')
      .replace(/(^|\n)\s*&gt;\s?/gi, '$1');

    return withoutQuoteMarkers
      .replace(/\\n/g, ' ')
      .replace(/[\s\u00A0]+/g, ' ')
      .trim();
  })();

  const handleCardClick = () => {
    navigate(`/${media.type}/${media.contentId}/${username}`);
  };

  const typeConfig = {
    anime: { icon: Play, color: 'text-[#26b2f2]', bg: 'bg-[#26b2f2]/10' },
    manga: { icon: Book, color: 'text-[#ee4466]', bg: 'bg-[#ee4466]/10' },
    reading: { icon: Book, color: 'text-[#b34ce6]', bg: 'bg-[#b34ce6]/10' },
    vn: { icon: Gamepad, color: 'text-[#3a70e4]', bg: 'bg-[#3a70e4]/10' },
    game: { icon: Gamepad, color: 'text-[#59c94e]', bg: 'bg-[#59c94e]/10' },
    video: { icon: Video, color: 'text-[#2cc9a4]', bg: 'bg-[#2cc9a4]/10' },
    movie: {
      icon: Clapperboard,
      color: 'text-[#f77118]',
      bg: 'bg-[#f77118]/10',
    },
    'tv show': {
      icon: MonitorPlay,
      color: 'text-[#f8b420]',
      bg: 'bg-[#f8b420]/10',
    },
  };

  const config = typeConfig[media.type as keyof typeof typeConfig];
  const TypeIcon = config.icon;
  const currentStatus =
    media.mediaStatus ?? (media.isCompleted ? 'completed' : null);
  const statusCfg = currentStatus ? STATUS_CONFIG[currentStatus] : null;

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
                <div className="flex items-start gap-2 mb-1">
                  <h3 className="font-bold text-lg leading-tight">
                    {media.title.contentTitleNative}
                  </h3>
                  {statusCfg && (
                    <span
                      className={`badge ${statusCfg.badgeClass} badge-sm gap-1 shrink-0`}
                    >
                      <statusCfg.icon className="w-3 h-3" /> {statusCfg.label}
                    </span>
                  )}
                </div>

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

                {descriptionText && (
                  <p
                    className="text-sm text-base-content/70 line-clamp-2"
                    title={descriptionText}
                  >
                    {descriptionText}
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
                    : media.type === 'game'
                      ? 'Video Game'
                      : media.type === 'tv show'
                        ? 'TV Show'
                        : media.type === 'reading'
                          ? 'Light Novel'
                          : media.type.charAt(0).toUpperCase() +
                            media.type.slice(1)}
                </div>

                {media.isAdult && (
                  <div className="badge badge-error badge-sm">18+</div>
                )}

                {isOwnProfile && (
                  <div
                    className="flex flex-col gap-1 items-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn btn-xs btn-primary gap-1 w-36 justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLogMedia(media);
                      }}
                      title="Quick Log"
                    >
                      <Plus className="w-3 h-3" /> Log
                    </button>
                    {/* Status dropdown */}
                    <div className="dropdown dropdown-end">
                      <button
                        type="button"
                        tabIndex={0}
                        disabled={isToggling}
                        className={`btn btn-xs w-36 justify-between gap-1 ${statusCfg ? statusCfg.badgeClass.replace('badge-', 'btn-') : 'btn-outline'}`}
                      >
                        {isToggling ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : statusCfg ? (
                          <>
                            <statusCfg.icon className="w-3 h-3" />{' '}
                            {statusCfg.label}
                          </>
                        ) : (
                          <>
                            <Circle className="w-3 h-3" /> Set status
                          </>
                        )}
                        <ChevronDown className="w-3 h-3 ml-auto" />
                      </button>
                      <ul
                        tabIndex={0}
                        className="dropdown-content z-50 menu p-1 shadow-lg bg-base-100 rounded-box w-36 text-sm"
                      >
                        {(
                          Object.entries(STATUS_CONFIG) as [
                            keyof typeof STATUS_CONFIG,
                            (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG],
                          ][]
                        ).map(([key, cfg]) => (
                          <li key={key}>
                            <button
                              className={`gap-2 ${currentStatus === key ? 'active' : ''}`}
                              onClick={() => onSetStatus(media, key)}
                            >
                              <cfg.icon className="w-3 h-3" />
                              {cfg.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
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
