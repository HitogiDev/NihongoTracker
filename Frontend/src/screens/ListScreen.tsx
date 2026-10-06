import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  getImmersionListFn,
  getUntrackedLogsFn,
  updateUserFn,
  updateMediaCompletionStatusFn,
  removeMediaFromImmersionListFn,
} from '../api/trackerApi';
import React, { useState, useEffect, useTransition } from 'react';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';

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
  Star,
  Plus,
  Filter,
  Trash2,
} from 'lucide-react';

import { convertBBCodeToHtml } from '../utils/utils';
import QuickLog from '../components/QuickLog';
import Button from '../components/ui/Button';
import DropdownSelect from '../components/ui/DropdownSelect';
import Spinner from '../components/ui/Spinner';
import { getMediaTypeColor, MEDIA_TYPE_CLASSES } from '../constants/mediaColors';
import { getLogTypeLabelKey } from '../utils/logTypes';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import MultiSelectDropdown from '../components/ui/MultiSelectDropdown';
import ImmersionListBatchActions from '../components/ImmersionListBatchActions';
import {
  STATUS_FILTERS,
  getMediaStatus,
  mediaSelectionKey,
  parseStatusFilters,
  type StatusFilter,
} from '../utils/immersionList';

type ViewMode = 'grid' | 'list';
type SortOption = 'title' | 'type' | 'recent';

interface MediaSelectionProps {
  selectionMode: boolean;
  selectedKeys: Set<string>;
  onToggleSelection: (media: IMediaDocument) => void;
  batchBusy: boolean;
}

type MediaStatusPayload = {
  mediaId: string;
  type: IMediaDocument['type'];
  status: 'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress';
};

const STATUS_CONFIG: Record<
  'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress',
  {
    labelKey: ParseKeys<'media'>;
    badgeClass: string;
    buttonClass: string;
    icon: React.FC<{ className?: string }>;
  }
> = {
  completed: {
    labelKey: 'list.status.completed',
    badgeClass: 'badge-success',
    buttonClass: 'btn-success',
    icon: CircleCheck,
  },
  dropped: {
    labelKey: 'list.status.dropped',
    badgeClass: 'badge-error',
    buttonClass: 'btn-error',
    icon: Ban,
  },
  paused: {
    labelKey: 'list.status.paused',
    badgeClass: 'badge-warning',
    buttonClass: 'btn-warning',
    icon: Clock,
  },
  planning: {
    labelKey: 'list.status.planning',
    badgeClass: 'badge-info',
    buttonClass: 'btn-info',
    icon: Star,
  },
  in_progress: {
    labelKey: 'list.status.inProgress',
    badgeClass: 'badge-primary',
    buttonClass: 'btn-primary',
    icon: Play,
  },
};

const MEDIA_TYPE_ICONS: Record<string, typeof Play> = {
  anime: Play,
  manga: Book,
  'light-novel': Book,
  vn: Gamepad,
  game: Gamepad,
  video: Video,
  movie: Clapperboard,
  'tv show': MonitorPlay,
  book: Book,
};

function ListScreen() {
  const { t } = useTranslation(['media', 'common']);
  const mediaTypeLabel = (type: string) => {
    const key = getLogTypeLabelKey(type);
    return key ? t(key, { ns: 'common' }) : type;
  };
  const { username } = useParams<{ username: string }>();
  const { user, setUser } = useUserDataStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const MEDIA_TYPES = [
    'anime',
    'manga',
    'light-novel',
    'vn',
    'game',
    'video',
    'movie',
    'tv show',
    'book',
  ];
  const sortOptions: SortOption[] = ['title', 'type', 'recent'];
  const viewOptions: ViewMode[] = ['grid', 'list'];

  const initialQuery = searchParams.get('q') ?? '';
  const initialSort = searchParams.get('sort');
  const initialView = searchParams.get('view');
  const initialProgress = searchParams.get('progress');
  const initialGrouped = searchParams.get('grouped');

  const initialFilterStr = searchParams.get('type');
  const initialTypes = initialFilterStr !== null
    ? initialFilterStr.split(',').filter((t) => MEDIA_TYPES.includes(t))
    : MEDIA_TYPES;

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialTypes);
  const [sortBy, setSortBy] = useState<SortOption>(
    sortOptions.includes(initialSort as SortOption)
      ? (initialSort as SortOption)
      : 'title',
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    viewOptions.includes(initialView as ViewMode)
      ? (initialView as ViewMode)
      : 'grid',
  );
  const [selectedStatuses, setSelectedStatuses] = useState<StatusFilter[]>(() =>
    parseStatusFilters(initialProgress),
  );
  const SelectedTypeIcon = selectedTypes.length === 1
    ? MEDIA_TYPE_ICONS[selectedTypes[0]] ?? Filter
    : Filter;
  const SelectedStatusIcon = selectedStatuses.length === 1
    ? selectedStatuses[0] === 'unset'
      ? Circle
      : STATUS_CONFIG[selectedStatuses[0]].icon
    : CircleCheck;
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [grouped, setGrouped] = useState<boolean>(initialGrouped !== 'false');
  const [isPendingGroup, startGroupTransition] = useTransition();
  const [showHideAlertModal, setShowHideAlertModal] = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  const [selectedMediaForLog, setSelectedMediaForLog] =
    useState<IMediaDocument | null>(null);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [mediaToRemove, setMediaToRemove] = useState<IMediaDocument | null>(
    null,
  );
  const [removeWithLogs, setRemoveWithLogs] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();

    if (searchQuery.trim()) {
      params.set('q', searchQuery);
    }
    if (selectedTypes.length !== MEDIA_TYPES.length) {
      params.set('type', selectedTypes.join(','));
    }
    if (sortBy !== 'title') {
      params.set('sort', sortBy);
    }
    if (viewMode !== 'grid') {
      params.set('view', viewMode);
    }
    if (selectedStatuses.length !== STATUS_FILTERS.length) {
      params.set('progress', selectedStatuses.join(','));
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
        `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`,
      );
    }
  }, [
    searchQuery,
    selectedTypes,
    sortBy,
    viewMode,
    selectedStatuses,
    grouped,
    MEDIA_TYPES.length,
  ]);

  const isOwnProfile = user?.username === username;

  useEffect(() => {
    setSelectedKeys(new Set());
    setSelectionMode(false);
  }, [username, user?._id]);

  const onToggleSelection = (media: IMediaDocument) => {
    if (!isOwnProfile || batchBusy) return;
    const key = mediaSelectionKey(media);
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const selectionProps = {
    selectionMode,
    selectedKeys,
    onToggleSelection,
    batchBusy,
  };

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
    newStatus: 'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress',
  ) => {
    if (!isOwnProfile || batchBusy) return;
    updateStatusMutation.mutate({
      mediaId: media.contentId,
      type: media.type,
      status: newStatus,
    });
  };

  const removeMediaMutation = useMutation({
    mutationFn: removeMediaFromImmersionListFn,
    onSuccess: (data) => {
      // Logs were deleted, so XP/streaks/stats change too: refresh broadly
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey.some(
            (key) =>
              key === 'logs' || key === 'user' || key === 'ImmersionList',
          ),
      });
      if (username) {
        void queryClient.invalidateQueries({
          queryKey: ['recentLogs', username],
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });

      toast.success(
        data.deletedLogs > 0
          ? `Removed from your list (${data.deletedLogs} log${
              data.deletedLogs === 1 ? '' : 's'
            } deleted)`
          : 'Removed from your list. Your logs were kept.',
      );
      setMediaToRemove(null);
      setRemoveWithLogs(false);
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof AxiosError
          ? (mutationError.response?.data?.message ??
              'Failed to remove media from your list')
          : 'Failed to remove media from your list',
      );
    },
  });

  const handleRemoveMedia = (media: IMediaDocument) => {
    if (!isOwnProfile || batchBusy) return;
    setRemoveWithLogs(false);
    setMediaToRemove(media);
  };

  const closeRemoveModal = () => {
    setMediaToRemove(null);
    setRemoveWithLogs(false);
  };

  const confirmRemoveMedia = () => {
    if (!mediaToRemove) return;
    removeMediaMutation.mutate({
      mediaId: mediaToRemove.contentId,
      type: mediaToRemove.type,
      deleteLogs: removeWithLogs,
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
      ...immersionList['light-novel'].map((item) => ({
        ...item,
        category: 'light-novel' as const,
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
      ...(immersionList.book || []).map((item) => ({
        ...item,
        category: 'book' as const,
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
            synonym.toLowerCase().includes(query),
          ),
      );
    }

    if (selectedTypes.length !== MEDIA_TYPES.length) {
      filtered = filtered.filter((item) => selectedTypes.includes(item.type));
    }

    if (selectedStatuses.length !== STATUS_FILTERS.length) {
      filtered = filtered.filter((item) =>
        selectedStatuses.includes(getMediaStatus(item)),
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title.contentTitleNative || '').localeCompare(
            b.title.contentTitleNative || '',
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
      'light-novel',
      'vn',
      'game',
      'video',
      'movie',
      'tv show',
      'book',
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

  const selectedMedia = allMedia.filter((media) =>
    selectedKeys.has(mediaSelectionKey(media)),
  );
  const visibleSelectedCount = filteredAndSortedMedia.filter((media) =>
    selectedKeys.has(mediaSelectionKey(media)),
  ).length;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTypes(MEDIA_TYPES);
    setSelectedStatuses([...STATUS_FILTERS]);
  };

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

        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3 pb-2 mb-4 border-b border-base-300">
            <div className="skeleton w-9 h-9 rounded-lg" />
            <div>
              <div className="skeleton h-5 w-20 rounded mb-1" />
              <div className="skeleton h-3 w-14 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 mb-10">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="card surface">
                <div className="skeleton aspect-[3/4] w-full rounded-t-2xl rounded-b-none" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-3 w-2/3 rounded" />
                  <div className="skeleton h-4 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pb-2 mb-4 border-b border-base-300">
            <div className="skeleton w-9 h-9 rounded-lg" />
            <div>
              <div className="skeleton h-5 w-16 rounded mb-1" />
              <div className="skeleton h-3 w-12 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card surface">
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
          <span>{t('list.loadFailed')}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {showHideAlertModal && (
        <dialog className="modal modal-bottom sm:modal-middle modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{t('list.hideAlertTitle')}</h3>
            <div className="py-4">
              <p className="mb-4">{t('list.hideAlertConfirmBody')}</p>
              <p className="text-sm text-base-content/70">
                You can still access the match media page from your{' '}
                <span className="font-semibold">{t('list.settings')}</span>{' '}
                under the{' '}
                <span className="font-semibold">{t('list.logManagement')}</span>{' '}
                section.
              </p>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-warning"
                onClick={handleHideUnmatchedAlert}
              >
                {t('list.hideAlertConfirm')}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowHideAlertModal(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setShowHideAlertModal(false)}
          ></div>
        </dialog>
      )}

      {mediaToRemove && (
        <dialog className="modal modal-bottom sm:modal-middle modal-open">
          <div className="modal-box border border-error/20">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-error/10 text-error shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-lg">{t('header.removeTitle')}</h3>
                <p className="text-sm text-base-content/70 mt-1 break-words">
                  {mediaToRemove.title.contentTitleNative}
                </p>
              </div>
            </div>

            <div className="py-4 space-y-3">
              {mediaToRemove.logCount ? (
                <>
                  <label className="label cursor-pointer justify-start gap-3 py-0">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-error checkbox-sm"
                      checked={removeWithLogs}
                      onChange={(e) => setRemoveWithLogs(e.target.checked)}
                      disabled={removeMediaMutation.isPending}
                    />
                    <span className="text-sm">
                      Also delete my {mediaToRemove.logCount} log
                      {mediaToRemove.logCount === 1 ? '' : 's'} for this media
                    </span>
                  </label>

                  {removeWithLogs ? (
                    <div role="alert" className="alert alert-warning">
                      <TriangleAlert className="h-5 w-5 shrink-0" />
                      <span className="text-sm">
                        This deletes{' '}
                        <span className="font-semibold">
                          {mediaToRemove.logCount} log
                          {mediaToRemove.logCount === 1 ? '' : 's'}
                        </span>
                        {mediaToRemove.totalXp
                          ? ` and ${Math.round(mediaToRemove.totalXp).toLocaleString()} XP`
                          : ''}
                        . Your level and streaks will be recalculated, and it
                        cannot be undone.
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-base-content/70">
                      Your logs and XP are kept; the media just stops showing in
                      your list. Logging it again brings it back.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-base-content/70">
                  {t('header.noLogsNote')}
                </p>
              )}
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={closeRemoveModal}
                disabled={removeMediaMutation.isPending}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-error gap-2"
                onClick={confirmRemoveMedia}
                disabled={removeMediaMutation.isPending}
              >
                {removeMediaMutation.isPending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Remove
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => !removeMediaMutation.isPending && closeRemoveModal()}
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
                className="alert alert-warning shadow-sm alert-vertical sm:alert-horizontal"
              >
                <TriangleAlert className="h-6 w-6 flex-shrink-0" />
                <div>
                  <h3 className="font-bold">{t('list.unmatchedFound')}</h3>
                  <div className="text-sm">
                    You have {untrackedLogs.length} log
                    {untrackedLogs.length !== 1 ? 's' : ''} without media. Match
                    them with the correct media.
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    className="btn btn-outline btn-sm gap-2"
                    onClick={() => navigate('/matchmedia')}
                  >
                    <Link2 className="h-4 w-4" />
                    <span>{t('list.matchLogs')}</span>
                  </button>
                  <button
                    className="btn btn-ghost btn-sm gap-2"
                    onClick={() => setShowHideAlertModal(true)}
                    title={t('list.dontShowAgainTitle')}
                  >
                    <X className="h-4 w-4" />
                    <span>{t('list.dontShowAgain')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        <div className="container mx-auto px-4 mt-4 relative z-50">
          <div className="card surface relative z-50">
            <div className="card-body p-6">
              <div className="flex flex-col gap-4">
                <div className="w-full">
                  <label className="input flex items-center gap-2">
                    <Search className="w-5 h-5 opacity-70" />
                    <input
                      type="text"
                      className="grow"
                      placeholder={t('list.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-center sm:justify-between">
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 flex-1 min-w-0">
                    <MultiSelectDropdown
                      label={
                        <>
                          <SelectedTypeIcon className="w-4 h-4 shrink-0" />
                          {selectedTypes.length === 0
                            ? t('list.noTypes')
                            : selectedTypes.length === MEDIA_TYPES.length
                              ? t('list.allTypes')
                              : selectedTypes.length === 1
                                ? mediaTypeLabel(selectedTypes[0])
                                : t('list.typesCount', {
                                    count: selectedTypes.length,
                                  })}
                        </>
                      }
                      value={selectedTypes}
                      onChange={setSelectedTypes}
                      options={MEDIA_TYPES.map((type) => {
                        const TypeIcon = MEDIA_TYPE_ICONS[type] ?? Bookmark;
                        return {
                          value: type,
                          checkboxColor: getMediaTypeColor(type),
                          label: (
                            <span className="flex items-center gap-3">
                              <TypeIcon
                                aria-hidden="true"
                                className={`w-4 h-4 shrink-0 ${MEDIA_TYPE_CLASSES[type].color}`}
                              />
                              {mediaTypeLabel(type)}
                            </span>
                          ),
                        };
                      })}
                      selectAllLabel={t('list.selectAll')}
                      selectNoneLabel={t('list.selectNone')}
                    />
                    <MultiSelectDropdown
                      label={
                        <>
                          <SelectedStatusIcon className="w-4 h-4 shrink-0" />
                          {t('list.statusLabel', {
                            status:
                              selectedStatuses.length === 0
                                ? t('list.noStatuses')
                                : selectedStatuses.length ===
                                    STATUS_FILTERS.length
                                  ? t('list.status.all')
                                  : selectedStatuses.length === 1
                                    ? selectedStatuses[0] === 'unset'
                                      ? t('list.status.unset')
                                      : t(
                                          STATUS_CONFIG[selectedStatuses[0]]
                                            .labelKey,
                                        )
                                    : t('list.statusesCount', {
                                        count: selectedStatuses.length,
                                      }),
                          })}
                        </>
                      }
                      value={selectedStatuses}
                      onChange={(values) =>
                        setSelectedStatuses(values as StatusFilter[])
                      }
                      options={STATUS_FILTERS.map((value) => {
                        const StatusIcon = value === 'unset'
                          ? Circle
                          : STATUS_CONFIG[value].icon;
                        return {
                          value,
                          label: (
                            <span className="flex items-center gap-3">
                              <StatusIcon aria-hidden="true" className="w-4 h-4 shrink-0" />
                              {value === 'unset'
                                ? t('list.status.unset')
                                : t(STATUS_CONFIG[value].labelKey)}
                            </span>
                          ),
                        };
                      })}
                      selectAllLabel={t('list.selectAll')}
                      selectNoneLabel={t('list.selectNone')}
                    />

                    <div className="dropdown dropdown-end sm:dropdown-start flex-1 sm:flex-none relative z-40 focus-within:z-[60]">
                      <div
                        tabIndex={0}
                        role="button"
                        className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
                      >
                        <ListFilter className="w-4 h-4" />
                        {t('list.sortLabel', {
                          sort:
                            sortBy === 'title'
                              ? t('list.sort.title')
                              : sortBy === 'type'
                                ? t('list.sort.type')
                                : t('list.sort.recent'),
                        })}
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content z-50 menu p-2 surface-raised w-full sm:w-52"
                      >
                        {[
                          { value: 'title', label: t('list.sort.byTitle') },
                          { value: 'type', label: t('list.sort.byType') },
                          {
                            value: 'recent',
                            label: t('list.sort.recentlyLogged'),
                          },
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

                  <div className="flex gap-2 shrink-0">
                    <div className="join flex-1 sm:flex-none">
                      <button
                        className={`join-item btn btn-sm flex-1 sm:flex-none ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`}
                        aria-label={t('list.grid')}
                        aria-pressed={viewMode === 'grid'}
                        onClick={() => setViewMode('grid')}
                      >
                        <LayoutGrid className="w-4 h-4" />
                        <span className="sm:hidden ml-2">{t('list.grid')}</span>
                      </button>
                      <button
                        className={`join-item btn btn-sm flex-1 sm:flex-none ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
                        aria-label={t('list.list')}
                        aria-pressed={viewMode === 'list'}
                        onClick={() => setViewMode('list')}
                      >
                        <LayoutList className="w-4 h-4" />
                        <span className="sm:hidden ml-2">{t('list.list')}</span>
                      </button>
                    </div>
                    <button
                      className={`btn flex-1 sm:flex-none gap-2 ${grouped ? 'btn-active' : 'btn-outline'}`}
                      onClick={() =>
                        startGroupTransition(() => setGrouped((prev) => !prev))
                      }
                      title={grouped ? t('list.ungroupBy') : t('list.groupBy')}
                    >
                      {isPendingGroup ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Layers className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">
                        {grouped ? t('list.grouped') : t('list.ungrouped')}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-base-content/70">
                  {t('list.showing', {
                    shown: stats.filteredCount,
                    total: stats.totalCount,
                  })}
                  {searchQuery && t('list.showingFor', { query: searchQuery })}
                </p>
              </div>
              {isOwnProfile && (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      appearance="outline"
                      size="sm"
                      disabled={
                        batchBusy ||
                        updateStatusMutation.isPending ||
                        removeMediaMutation.isPending
                      }
                      onClick={() => {
                        setSelectionMode((previous) => !previous);
                        setSelectedKeys(new Set());
                      }}
                    >
                      {selectionMode
                        ? t('list.batch.done')
                        : t('list.batch.selectItems')}
                    </Button>
                    {selectionMode && (
                      <>
                        <Button
                          appearance="outline"
                          size="sm"
                          disabled={
                            batchBusy || filteredAndSortedMedia.length === 0
                          }
                          onClick={() =>
                            setSelectedKeys(
                              (previous) =>
                                new Set([
                                  ...previous,
                                  ...filteredAndSortedMedia.map(
                                    mediaSelectionKey,
                                  ),
                                ]),
                            )
                          }
                        >
                          {t('list.batch.selectVisible')}
                        </Button>
                      </>
                    )}
                  </div>
                  {selectionMode && (
                    <ImmersionListBatchActions
                      username={username!}
                      selectedMedia={selectedMedia}
                      hiddenCount={selectedMedia.length - visibleSelectedCount}
                      statusOptions={Object.entries(STATUS_CONFIG).map(
                        ([value, config]) => ({
                          value: value as MediaStatusPayload['status'],
                          label: t(config.labelKey),
                        }),
                      )}
                      onComplete={(keys) =>
                        setSelectedKeys(
                          (previous) =>
                            new Set(
                              [...previous].filter(
                                (key) => !keys.includes(key),
                              ),
                            ),
                        )
                      }
                      onBusyChange={setBatchBusy}
                    />
                  )}
                </div>
              )}
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
                    <h3 className="text-2xl font-bold">{t('list.noMedia')}</h3>
                    <p className="text-base-content/70">
                      {searchQuery
                        ? t('list.emptySearch', { query: searchQuery })
                        : selectedTypes.length !== MEDIA_TYPES.length ||
                            selectedStatuses.length !== STATUS_FILTERS.length
                          ? t('list.emptyFilters')
                          : t('list.emptyLibrary')}
                    </p>
                    {(searchQuery ||
                      selectedTypes.length !== MEDIA_TYPES.length ||
                      selectedStatuses.length !== STATUS_FILTERS.length) && (
                      <button
                        className="btn btn-outline"
                        onClick={clearFilters}
                      >
                        {t('list.clearFilters')}
                      </button>
                    )}
                  </div>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                  {groupedMedia.ungrouped?.map((item) => (
                    <MediaCard
                      key={mediaSelectionKey(item)}
                      media={item}
                      {...selectionProps}
                      isOwnProfile={!!isOwnProfile}
                      onSetStatus={handleSetStatus}
                      pendingToggleId={pendingToggleId}
                      onLogMedia={handleOpenQuickLog}
                      onRemoveMedia={handleRemoveMedia}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedMedia.ungrouped?.map((item) => (
                    <MediaListItem
                      key={mediaSelectionKey(item)}
                      media={item}
                      {...selectionProps}
                      isOwnProfile={!!isOwnProfile}
                      onSetStatus={handleSetStatus}
                      pendingToggleId={pendingToggleId}
                      onLogMedia={handleOpenQuickLog}
                      onRemoveMedia={handleRemoveMedia}
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
                  <h3 className="text-2xl font-bold">{t('list.noMedia')}</h3>
                  <p className="text-base-content/70">
                    {selectedTypes.length !== MEDIA_TYPES.length ||
                    selectedStatuses.length !== STATUS_FILTERS.length
                      ? t('list.emptyFilters')
                      : t('list.emptyLibrary')}
                  </p>
                  {(selectedTypes.length !== MEDIA_TYPES.length ||
                    selectedStatuses.length !== STATUS_FILTERS.length) && (
                    <Button appearance="outline" onClick={clearFilters}>
                      {t('list.clearFilters')}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedMedia).map(([type, mediaList]) => (
                  <MediaGroup
                    key={type}
                    {...selectionProps}
                    type={type}
                    mediaList={mediaList}
                    viewMode={viewMode}
                    count={mediaList.length}
                    isOwnProfile={!!isOwnProfile}
                    onSetStatus={handleSetStatus}
                    pendingToggleId={pendingToggleId}
                    onLogMedia={handleOpenQuickLog}
                    onRemoveMedia={handleRemoveMedia}
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
  onRemoveMedia,
  ...selectionProps
}: MediaSelectionProps & {
  type: string;
  mediaList: (IMediaDocument & { category: string })[];
  viewMode: ViewMode;
  count: number;
  isOwnProfile: boolean;
  onSetStatus: (
    media: IMediaDocument,
    status: 'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress',
  ) => void;
  pendingToggleId: string | null;
  onLogMedia: (media: IMediaDocument) => void;
  onRemoveMedia: (media: IMediaDocument) => void;
}) {
  const { t: tCommon } = useTranslation('common');
  // Colours come from constants/mediaColors so this heading matches the log
  // cards and the charts for the same media type.
  const typeConfig = {
    anime: {
      icon: Play,
      color: MEDIA_TYPE_CLASSES.anime.color,
      label: tCommon('mediaTypeGroups.anime'),
    },
    manga: {
      icon: Book,
      color: MEDIA_TYPE_CLASSES.manga.color,
      label: tCommon('mediaTypeGroups.manga'),
    },
    'light-novel': {
      icon: Book,
      color: MEDIA_TYPE_CLASSES['light-novel'].color,
      label: tCommon('mediaTypeGroups.light-novel'),
    },
    vn: {
      icon: Gamepad,
      color: MEDIA_TYPE_CLASSES.vn.color,
      label: tCommon('mediaTypeGroups.vn'),
    },
    game: {
      icon: Gamepad,
      color: MEDIA_TYPE_CLASSES.game.color,
      label: tCommon('mediaTypeGroups.game'),
    },
    video: {
      icon: Video,
      color: MEDIA_TYPE_CLASSES.video.color,
      label: tCommon('mediaTypeGroups.video'),
    },
    movie: {
      icon: Clapperboard,
      color: MEDIA_TYPE_CLASSES.movie.color,
      label: tCommon('mediaTypeGroups.movie'),
    },
    'tv show': {
      icon: MonitorPlay,
      color: MEDIA_TYPE_CLASSES['tv show'].color,
      label: tCommon('mediaTypeGroups.tvShow'),
    },
    book: {
      icon: Book,
      color: MEDIA_TYPE_CLASSES.book.color,
      label: 'Books',
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
            {tCommon('list.itemsCount', { count, ns: 'media' })}
          </p>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {mediaList.map((item) => (
            <MediaCard
              key={mediaSelectionKey(item)}
              media={item}
              {...selectionProps}
              isOwnProfile={isOwnProfile}
              onSetStatus={onSetStatus}
              pendingToggleId={pendingToggleId}
              onLogMedia={onLogMedia}
              onRemoveMedia={onRemoveMedia}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {mediaList.map((item) => (
            <MediaListItem
              key={mediaSelectionKey(item)}
              media={item}
              {...selectionProps}
              isOwnProfile={isOwnProfile}
              onSetStatus={onSetStatus}
              pendingToggleId={pendingToggleId}
              onLogMedia={onLogMedia}
              onRemoveMedia={onRemoveMedia}
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
  onRemoveMedia,
  selectionMode,
  selectedKeys,
  onToggleSelection,
  batchBusy,
}: MediaSelectionProps & {
  media: IMediaDocument & { category: string };
  isOwnProfile: boolean;
  onSetStatus: (
    media: IMediaDocument,
    status: 'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress',
  ) => void;
  pendingToggleId: string | null;
  onLogMedia: (media: IMediaDocument) => void;
  onRemoveMedia: (media: IMediaDocument) => void;
}) {
  const { t } = useTranslation(['media', 'common']);
  const mediaTypeLabel = (type: string) => {
    const key = getLogTypeLabelKey(type);
    return key ? t(key, { ns: 'common' }) : type;
  };
  const { user } = useUserDataStore();
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (isOwnProfile && selectionMode) {
      onToggleSelection(media);
      return;
    }
    navigate(`/${media.type}/${media.contentId}/${username}`);
  };

  const toggleKey = `${media.type}:${media.contentId}`;
  const isToggling = batchBusy || pendingToggleId === toggleKey;

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
    'light-novel': {
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
    book: {
      icon: Book,
      color: 'text-[#7c6cf0]',
      bg: 'bg-[#7c6cf0]/10',
      border: 'border-[#7c6cf0]/30',
    },
  };

  const config = typeConfig[media.type as keyof typeof typeConfig];
  const TypeIcon = config.icon;
  const currentStatus =
    media.mediaStatus ?? (media.isCompleted ? 'completed' : null);
  const statusCfg = currentStatus ? STATUS_CONFIG[currentStatus] : null;
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

  return (
    <div
      className={`card relative focus-within:z-30 bg-base-100 shadow-sm transition-all duration-300 group cursor-pointer border ${isStatusMenuOpen ? '' : 'hover:shadow-lg'} ${config.border} ${selectionMode && selectedKeys.has(mediaSelectionKey(media)) ? 'ring-2 ring-primary' : ''}`}
      onClick={handleCardClick}
    >
      {isOwnProfile && selectionMode && (
        <label
          className="absolute top-2 left-2 z-40 surface p-2 cursor-pointer"
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={selectedKeys.has(mediaSelectionKey(media))}
            disabled={batchBusy}
            onChange={() => onToggleSelection(media)}
            aria-label={t('list.batch.selectItem', {
              title: media.title.contentTitleNative,
            })}
          />
        </label>
      )}
      {/* Status dropdown button at the top right */}
      {isOwnProfile && !selectionMode && (
        <div
          className="dropdown dropdown-end absolute top-2 right-2 z-40"
          onClick={(e) => e.stopPropagation()}
          onFocusCapture={() => setIsStatusMenuOpen(true)}
          onBlurCapture={(event) => {
            const nextFocusedElement = event.relatedTarget;
            if (
              !(nextFocusedElement instanceof Node) ||
              !event.currentTarget.contains(nextFocusedElement)
            ) {
              setIsStatusMenuOpen(false);
            }
          }}
        >
          <button
            type="button"
            tabIndex={0}
            className={`btn btn-xs btn-circle ${statusCfg ? statusCfg.badgeClass.replace('badge-', 'btn-') : 'btn-ghost bg-base-100/80 border-base-300'}`}
            disabled={isToggling}
            aria-label={t('list.setStatus')}
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
            className="dropdown-content z-50 menu p-1 surface-raised w-36 text-sm"
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
                  {t(cfg.labelKey)}
                </button>
              </li>
            ))}
            <li>
              <div className="divider my-1"></div>
            </li>
            <li>
              <button
                className="gap-2 text-error"
                onClick={() => onRemoveMedia(media)}
              >
                <Trash2 className="w-3 h-3" />
                {t('header.remove')}
              </button>
            </li>
          </ul>
        </div>
      )}

      <figure className="relative aspect-[3/4] overflow-hidden">
        {media.contentImage || media.coverImage ? (
          <img
            src={media.contentImage || media.coverImage}
            alt={media.title.contentTitleNative}
            className={`w-full h-full object-cover transition-transform duration-300 ${isStatusMenuOpen ? '' : 'group-hover:scale-105'} ${(media.type === 'vn' ? (media.isAdultImage ?? false) : media.isAdult) && user?.settings?.blurAdultContent ? 'filter blur-sm' : ''}`}
            loading="lazy"
          />
        ) : (
          <div
            className={`w-full h-full ${config.bg} flex items-center justify-center`}
          >
            <TypeIcon className={`w-12 h-12 ${config.color} opacity-50`} />
          </div>
        )}

        {statusCfg && (
          <div className="absolute bottom-2 left-2">
            <div className={`badge ${statusCfg.badgeClass} badge-sm gap-1`}>
              <statusCfg.icon className="w-3 h-3" /> {t(statusCfg.labelKey)}
            </div>
          </div>
        )}

        {/* {media.isAdult && (
          <div className="absolute top-2 left-2">
            <div className="badge badge-error badge-sm">18+</div>
          </div>
        )} */}

        <div
          className={`absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-300 flex items-center justify-center z-0 pointer-events-none ${isStatusMenuOpen || selectionMode ? '' : 'group-hover:opacity-100'}`}
        >
          <div className="text-white text-center p-4">
            <TrendingUp className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm font-medium">{t('list.viewDetails')}</p>
          </div>
        </div>

        {isOwnProfile && !selectionMode && (
          <button
            type="button"
            className={`btn btn-primary btn-sm btn-circle absolute bottom-2 right-2 z-20 shadow-sm opacity-0 transition-opacity duration-300 ${isStatusMenuOpen ? 'pointer-events-none' : 'group-hover:opacity-100'}`}
            onClick={(e) => {
              e.stopPropagation();
              onLogMedia(media);
            }}
            title={t('list.quickLog')}
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
            {mediaTypeLabel(media.type)}
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
  onRemoveMedia,
  selectionMode,
  selectedKeys,
  onToggleSelection,
  batchBusy,
}: MediaSelectionProps & {
  media: IMediaDocument & { category: string };
  isOwnProfile: boolean;
  onSetStatus: (
    media: IMediaDocument,
    status: 'completed' | 'dropped' | 'paused' | 'planning' | 'in_progress',
  ) => void;
  pendingToggleId: string | null;
  onLogMedia: (media: IMediaDocument) => void;
  onRemoveMedia: (media: IMediaDocument) => void;
}) {
  const { t } = useTranslation(['media', 'common']);
  const mediaTypeLabel = (type: string) => {
    const key = getLogTypeLabelKey(type);
    return key ? t(key, { ns: 'common' }) : type;
  };
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const toggleKey = `${media.type}:${media.contentId}`;
  const isToggling = batchBusy || pendingToggleId === toggleKey;

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
      '$1',
    );

    if (!sourceWithoutQuoteMarkers.trim()) {
      return t('list.noDescription');
    }

    let formattedDescription = sourceWithoutQuoteMarkers;

    if (
      /\[(b|i|u|s|url|img|spoiler|quote|code|list|\*)\b/i.test(
        sourceWithoutQuoteMarkers,
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
    if (isOwnProfile && selectionMode) {
      onToggleSelection(media);
      return;
    }
    navigate(`/${media.type}/${media.contentId}/${username}`);
  };

  const typeConfig = {
    anime: { icon: Play, color: 'text-[#26b2f2]', bg: 'bg-[#26b2f2]/10' },
    manga: { icon: Book, color: 'text-[#ee4466]', bg: 'bg-[#ee4466]/10' },
    'light-novel': {
      icon: Book,
      color: 'text-[#b34ce6]',
      bg: 'bg-[#b34ce6]/10',
    },
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
    book: {
      icon: Book,
      color: 'text-[#7c6cf0]',
      bg: 'bg-[#7c6cf0]/10',
    },
  };

  const config = typeConfig[media.type as keyof typeof typeConfig];
  const TypeIcon = config.icon;
  const currentStatus =
    media.mediaStatus ?? (media.isCompleted ? 'completed' : null);
  const statusCfg = currentStatus ? STATUS_CONFIG[currentStatus] : null;

  return (
    <div
      className={`card surface hover:shadow-lg transition-all duration-200 cursor-pointer ${selectionMode && selectedKeys.has(mediaSelectionKey(media)) ? 'ring-2 ring-primary' : ''}`}
      onClick={handleCardClick}
    >
      <div className="card-body p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start">
          {isOwnProfile && selectionMode && (
            <label
              className="self-start p-2 cursor-pointer"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-primary checkbox-sm"
                checked={selectedKeys.has(mediaSelectionKey(media))}
                disabled={batchBusy}
                onChange={() => onToggleSelection(media)}
                aria-label={t('list.batch.selectItem', {
                  title: media.title.contentTitleNative,
                })}
              />
            </label>
          )}
          <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
            <div className="h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-16">
              {media.contentImage || media.coverImage ? (
                <img
                  src={media.contentImage || media.coverImage}
                  alt={media.title.contentTitleNative}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center ${config.bg}`}
                >
                  <TypeIcon className={`h-6 w-6 ${config.color} opacity-50`} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="min-w-0 break-words text-base font-bold leading-tight sm:text-lg">
                  {media.title.contentTitleNative}
                </h3>
                {statusCfg && (
                  <span
                    className={`badge ${statusCfg.badgeClass} badge-sm shrink-0 gap-1`}
                  >
                    <statusCfg.icon className="h-3 w-3" />{' '}
                    {t(statusCfg.labelKey)}
                  </span>
                )}
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`badge badge-sm gap-1 border-0 ${config.bg} ${config.color}`}
                >
                  <TypeIcon className="h-3 w-3" />
                  {mediaTypeLabel(media.type)}
                </span>
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

              {media.title.contentTitleEnglish && (
                <p className="mb-2 break-words text-sm text-base-content/60">
                  {media.title.contentTitleEnglish}
                </p>
              )}

              {media.title.contentTitleRomaji && (
                <p className="mb-2 break-words text-xs text-base-content/50">
                  {media.title.contentTitleRomaji}
                </p>
              )}

              {descriptionText && (
                <p
                  className="line-clamp-2 break-words text-sm text-base-content/70"
                  title={descriptionText}
                >
                  {descriptionText}
                </p>
              )}
            </div>
          </div>

          {isOwnProfile && !selectionMode && (
            <div
              className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-2 border-t border-base-300 pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] lg:flex lg:w-auto lg:shrink-0 lg:items-center lg:gap-1 lg:border-t-0 lg:pt-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="primary"
                className="h-12 min-h-12 w-full gap-2 lg:btn-sm lg:btn-square lg:h-9 lg:min-h-9 lg:w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogMedia(media);
                }}
                title={t('list.quickLog')}
              >
                <Plus className="h-4 w-4" />
                <span className="lg:sr-only">{t('header.log')}</span>
              </Button>
              <DropdownSelect
                value={currentStatus ?? ''}
                disabled={isToggling}
                aria-label={t('list.setStatus')}
                aria-busy={isToggling}
                className={`h-12 min-h-12 w-full min-w-0 gap-2 lg:btn-sm lg:h-9 lg:min-h-9 lg:w-44 ${statusCfg?.buttonClass ?? ''}`}
                optionClassName="min-h-12 gap-2 lg:min-h-9"
                onChange={(event) =>
                  onSetStatus(
                    media,
                    event.target.value as MediaStatusPayload['status'],
                  )
                }
              >
                <option value="" disabled>
                  <span className="flex items-center gap-2">
                    {isToggling ? (
                      <Spinner size="sm" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0" />
                    )}
                    {t('list.setStatus')}
                  </span>
                </option>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {isToggling && currentStatus === key ? (
                        <Spinner size="sm" />
                      ) : (
                        <cfg.icon className="h-4 w-4 shrink-0" />
                      )}
                      {t(cfg.labelKey)}
                    </span>
                  </option>
                ))}
              </DropdownSelect>
              <Button
                variant="error"
                appearance="ghost"
                className="col-span-2 h-12 min-h-12 w-full gap-2 sm:col-span-1 lg:btn-sm lg:btn-square lg:h-9 lg:min-h-9 lg:w-9"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveMedia(media);
                }}
                title={t('header.removeFromList')}
              >
                <Trash2 className="h-4 w-4" />
                <span className="lg:sr-only">{t('header.remove')}</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ListScreen;
