import { Link, useOutletContext } from 'react-router-dom';
import {
  OutletMediaContextType,
  ILog,
  IMediaDocument,
  IMediaReview,
} from '../types';
import ProgressChart from '../components/ProgressChart';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getUserLogsFn,
  compareUserStatsFn,
  IComparisonStats,
  getMediaReviewsFn,
  editMediaReviewFn,
  toggleMediaReviewLikeFn,
  deleteMediaReviewFn,
  updateMediaCompletionStatusFn,
} from '../api/trackerApi';
import { numberWithCommas } from '../utils/utils';
import { effectiveLogMinutes } from '../utils/immersionTime';
import LogCard from '../components/LogCard';
import { useState, useEffect, useRef } from 'react';
import { useUserDataStore } from '../store/userData';
import { DayPicker } from 'react-day-picker';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import {
  Search,
  Funnel,
  Clock4,
  Clock3,
  ChevronDown,
  ListFilter,
  ArrowUp,
  ArrowDown,
  Zap,
  LineChart,
  BarChart3,
  MessageSquareText,
  Pencil,
} from 'lucide-react';
import { useDateFormatting } from '../hooks/useDateFormatting';
import EditReviewModal from '../components/EditReviewModal';
import MediaReviewCard from '../components/MediaReviewCard';
import ReviewRatingSummary from '../components/ReviewRatingSummary';
import { getClubFn, getClubMediaStatsFn } from '../api/clubApi';
import { useTranslation } from 'react-i18next';

const difficultyLevels = [
  ['Beginner', '#4caf50'],
  ['Easy', '#8bc34a'],
  ['Moderate', '#d3b431'],
  ['Hard', '#ff9800'],
  ['Very Hard', '#f44336'],
  ['Expert', '#e91e63'],
];

const parseVolumeNumberFromTitle = (
  title: string | null | undefined
): number | null => {
  if (!title) return null;
  const match = title.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getDeckForVolume = (
  subDecks:
    | Array<{
        originalTitle: string;
        romajiTitle: string | null;
        englishTitle: string | null;
        characterCount: number;
      }>
    | undefined,
  volume: number
) => {
  const decks = subDecks ?? [];
  const byTitle = decks.find((deck) => {
    const candidates = [
      deck.originalTitle,
      deck.romajiTitle,
      deck.englishTitle,
    ];
    return candidates.some(
      (candidate) => parseVolumeNumberFromTitle(candidate) === volume
    );
  });

  if (byTitle) return byTitle;
  return decks[volume - 1];
};

function MediaDetails() {
  const { t } = useTranslation(['media', 'common']);
  const { mediaDocument, mediaType, username } =
    useOutletContext<OutletMediaContextType>();
  const { user: currentUser } = useUserDataStore();
  const { getCurrentTime, getDayBounds, formatDateOnly } = useDateFormatting();

  const [visibleLogsCount, setVisibleLogsCount] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<
    'all' | 'today' | 'week' | 'month' | 'year' | 'custom'
  >('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    undefined
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    undefined
  );
  const [sortBy, setSortBy] = useState<
    'date' | 'xp' | 'episodes' | 'chars' | 'pages' | 'time' | 'readingSpeed'
  >('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [chartMetric, setChartMetric] = useState<'xp' | 'hours'>('xp');
  const [chartView, setChartView] = useState<'line' | 'bar'>('line');
  const [editingReview, setEditingReview] = useState<IMediaReview | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const autoCompletionTriggerRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (dateFilter !== 'custom') {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  }, [dateFilter]);

  useEffect(() => {
    setVisibleLogsCount(10);
  }, [
    searchTerm,
    dateFilter,
    customStartDate,
    customEndDate,
    sortBy,
    sortDirection,
  ]);

  // Get user's logs for this media
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: [
      username,
      'logs',
      'media',
      mediaDocument?.contentId,
      mediaDocument?.type,
    ],
    queryFn: () => {
      if (!username || !mediaDocument?.contentId || !mediaDocument?.type) {
        throw new Error('Username, media ID and type are required');
      }
      return getUserLogsFn(username, {
        mediaId: mediaDocument.contentId,
        type: mediaDocument.type,
        limit: 0,
        page: 1,
      });
    },
    enabled: !!username && !!mediaDocument?.contentId && !!mediaDocument?.type,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const isViewingOtherUser = currentUser?.username !== username;

  const { data: myLogs, isLoading: myLogsLoading } = useQuery({
    queryKey: [
      currentUser?.username,
      'logs',
      'media',
      mediaDocument?.contentId,
      mediaDocument?.type,
    ],
    queryFn: () => {
      if (
        !currentUser?.username ||
        !mediaDocument?.contentId ||
        !mediaDocument?.type
      ) {
        throw new Error('Username, media ID and type are required');
      }
      return getUserLogsFn(currentUser.username, {
        mediaId: mediaDocument.contentId,
        type: mediaDocument.type,
        limit: 0,
        page: 1,
      });
    },
    enabled:
      isViewingOtherUser &&
      !!currentUser?.username &&
      !!mediaDocument?.contentId &&
      !!mediaDocument?.type,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const dateRange = (() => {
    switch (dateFilter) {
      case 'today': {
        const now = getCurrentTime();
        const bounds = getDayBounds(now);
        return { startDate: bounds.start, endDate: bounds.end };
      }
      case 'week': {
        const now = getCurrentTime();
        const todayBounds = getDayBounds(now);
        const weekStart = new Date(todayBounds.start);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { startDate: weekStart, endDate: weekEnd };
      }
      case 'month': {
        const now = getCurrentTime();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        return { startDate: monthStart, endDate: monthEnd };
      }
      case 'year': {
        const now = getCurrentTime();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { startDate: yearStart, endDate: yearEnd };
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          const startBounds = getDayBounds(customStartDate);
          const endBounds = getDayBounds(customEndDate);
          return { startDate: startBounds.start, endDate: endBounds.end };
        }
        return null;
      }
      default:
        return null;
    }
  })();

  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: [
      'comparison',
      currentUser?.username,
      username,
      mediaDocument?.contentId,
      mediaDocument?.type,
    ],
    queryFn: () => {
      if (
        !currentUser?.username ||
        !username ||
        !mediaDocument?.contentId ||
        !mediaDocument?.type
      ) {
        throw new Error('Required data for comparison is missing');
      }
      return compareUserStatsFn(
        currentUser.username,
        username,
        mediaDocument.contentId,
        mediaDocument.type
      );
    },
    enabled:
      isViewingOtherUser &&
      !!currentUser?.username &&
      !!username &&
      !!mediaDocument?.contentId &&
      !!mediaDocument?.type,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
  });

  const { data: mediaReviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['mediaReviews', mediaDocument?.contentId, mediaDocument?.type],
    queryFn: () => {
      if (!mediaDocument?.contentId || !mediaDocument?.type) {
        throw new Error('Media ID and type are required');
      }
      return getMediaReviewsFn(mediaDocument.contentId, mediaDocument.type);
    },
    enabled: !!mediaDocument?.contentId && !!mediaDocument?.type,
  });

  const editReviewMutation = useMutation({
    mutationFn: (data: {
      reviewId: string;
      reviewData: {
        summary: string;
        content: string;
        rating?: number;
        hasSpoilers: boolean;
      };
    }) => {
      if (!mediaDocument?.contentId || !mediaDocument?.type) {
        throw new Error('Media ID and type are required');
      }
      return editMediaReviewFn(
        mediaDocument.contentId,
        mediaDocument.type,
        data.reviewId,
        data.reviewData
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'mediaReviews',
          mediaDocument?.contentId,
          mediaDocument?.type,
        ],
      });
      setEditingReview(null);
      toast.success(t('toast.reviewUpdated'));
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Failed to update review';
      toast.error(errorMessage);
    },
  });

  const likeReviewMutation = useMutation({
    mutationFn: (reviewId: string) => {
      if (!mediaDocument?.contentId || !mediaDocument?.type) {
        throw new Error('Media ID and type are required');
      }
      return toggleMediaReviewLikeFn(
        mediaDocument.contentId,
        mediaDocument.type,
        reviewId
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'mediaReviews',
          mediaDocument?.contentId,
          mediaDocument?.type,
        ],
      });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: string) => {
      if (!mediaDocument?.contentId || !mediaDocument?.type) {
        throw new Error('Media ID and type are required');
      }
      return deleteMediaReviewFn(
        mediaDocument.contentId,
        mediaDocument.type,
        reviewId
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'mediaReviews',
          mediaDocument?.contentId,
          mediaDocument?.type,
        ],
      });
      toast.success(t('toast.reviewDeleted'));
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Failed to delete review';
      toast.error(errorMessage);
    },
  });

  const { mutate: autoCompleteMedia } = useMutation({
    mutationFn: (payload: {
      mediaId: string;
      type: IMediaDocument['type'];
      completed: boolean;
      source?: 'manual' | 'auto';
    }) => updateMediaCompletionStatusFn(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'media' &&
          query.queryKey[1] === data.mediaId &&
          query.queryKey[2] === data.type,
      });
      queryClient.invalidateQueries({ queryKey: ['ImmersionList'] });
      if (currentUser?.username) {
        queryClient.invalidateQueries({
          queryKey: ['ImmersionList', currentUser.username],
        });
      }
    },
    onError: () => {
      autoCompletionTriggerRef.current = null;
    },
  });

  // Memoize arrays to prevent recalculation
  const logsArray = Array.isArray(logs) ? (logs as ILog[]) : [];
  const myLogsArray = Array.isArray(myLogs) ? (myLogs as ILog[]) : [];
  const isLoading =
    logsLoading || (isViewingOtherUser && (myLogsLoading || comparisonLoading));

  const startTimestamp = dateRange?.startDate
    ? dateRange.startDate.getTime()
    : undefined;
  const endTimestamp = dateRange?.endDate
    ? dateRange.endDate.getTime()
    : undefined;

  const filteredLogs = (() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const getSortValue = (log: ILog) => {
      switch (sortBy) {
        case 'xp':
          return log.xp ?? 0;
        case 'episodes':
          return log.episodes ?? 0;
        case 'chars':
          return log.chars ?? 0;
        case 'pages':
          return log.pages ?? 0;
        case 'time':
          return log.time ?? 0;
        case 'readingSpeed':
          return log.time && log.time > 0
            ? ((log.chars ?? 0) / log.time) * 60
            : 0;
        case 'date':
        default:
          return new Date(log.date).getTime();
      }
    };

    return [...logsArray]
      .filter((log) => {
        if (normalizedSearch) {
          const tagsText = Array.isArray(log.tags)
            ? (log.tags as Array<string | { name?: string }>)
                .map((tag) =>
                  typeof tag === 'string' ? tag : (tag?.name ?? '')
                )
                .join(' ')
            : '';

          const haystack =
            `${log.description || ''} ${tagsText} ${log.episodes ?? ''} ${log.pages ?? ''} ${log.chars ?? ''} ${log.time ?? ''} ${new Date(log.date).toLocaleDateString()}`.toLowerCase();

          if (!haystack.includes(normalizedSearch)) {
            return false;
          }
        }

        if (startTimestamp || endTimestamp) {
          const logTime = new Date(log.date).getTime();
          if (startTimestamp && logTime < startTimestamp) return false;
          if (endTimestamp && logTime > endTimestamp) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const valueA = getSortValue(a);
        const valueB = getSortValue(b);
        if (valueA === valueB) return 0;
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      });
  })();

  // Memoize heavy calculations to prevent re-computation on every render
  const calculations = (() => {
    // Sort logs by date (most recent first) - moved up to be used in calculations
    const sortedLogs =
      logsArray.length > 0
        ? [...logsArray].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        : [];

    const totalXp = logsArray.reduce((acc, log) => acc + log.xp, 0);
    // Episode-only anime logs carry no `time`; count them at 24 min/episode
    // like every server-side total does.
    const totalTime = logsArray.reduce(
      (acc, log) => acc + effectiveLogMinutes(log),
      0
    );

    // Calculate reading statistics
    const totalCharsRead = logsArray.reduce(
      (acc, log) => acc + (log.chars ?? 0),
      0
    );
    const totalCharCount = mediaDocument?.jiten?.mainDeck.characterCount || 0;
    const totalSeriesVolumes =
      mediaDocument?.volumes ?? mediaDocument?.jiten?.subDecks?.length ?? 0;
    const latestVolumeLog = sortedLogs.find(
      (log) => typeof log.volume === 'number' && log.volume > 0
    );
    const baseVolume = latestVolumeLog?.volume
      ? Math.floor(latestVolumeLog.volume)
      : logsArray.length > 0 &&
          (mediaDocument?.type === 'manga' || mediaDocument?.type === 'reading')
        ? 1
        : null;

    const baseVolumeDeck = baseVolume
      ? getDeckForVolume(mediaDocument?.jiten?.subDecks, baseVolume)
      : undefined;
    const baseVolumeCharsRead = baseVolume
      ? logsArray
          .filter((log) => log.volume === baseVolume)
          .reduce((acc, log) => acc + (log.chars ?? 0), 0)
      : 0;

    const shouldAdvanceVolume =
      !!baseVolume &&
      (baseVolumeDeck?.characterCount ?? 0) > 0 &&
      baseVolumeCharsRead >= (baseVolumeDeck?.characterCount ?? 0) &&
      totalSeriesVolumes > 0 &&
      baseVolume < totalSeriesVolumes;

    const currentVolume = baseVolume
      ? shouldAdvanceVolume
        ? baseVolume + 1
        : baseVolume
      : null;

    const currentVolumeDeck = currentVolume
      ? getDeckForVolume(mediaDocument?.jiten?.subDecks, currentVolume)
      : undefined;

    const currentVolumeCharsRead = currentVolume
      ? logsArray
          .filter((log) => log.volume === currentVolume)
          .reduce((acc, log) => acc + (log.chars ?? 0), 0)
      : 0;
    const currentVolumeCharCount = currentVolumeDeck?.characterCount ?? 0;
    const currentVolumeReadingPercentage =
      currentVolumeCharCount > 0
        ? Math.min((currentVolumeCharsRead / currentVolumeCharCount) * 100, 100)
        : 0;
    const currentVolumeRemainingChars = Math.max(
      currentVolumeCharCount - currentVolumeCharsRead,
      0
    );

    const readingPercentage =
      totalCharCount > 0
        ? Math.min((totalCharsRead / totalCharCount) * 100, 100)
        : 0;

    // Calculate reading speed (chars per hour) and estimated time to finish
    const readingSpeed =
      totalTime && totalTime > 0 ? (totalCharsRead / totalTime) * 60 : 0; // chars per hour

    // Calculate recent reading speed from last 10 logs
    const recentLogs = sortedLogs.slice(0, 10);
    const recentCharsRead = recentLogs.reduce(
      (acc, log) => acc + (log.chars ?? 0),
      0
    );
    const recentTime = recentLogs.reduce(
      (acc, log) => acc + (log.time ?? 0),
      0
    );
    const recentReadingSpeed =
      recentTime && recentTime > 0 ? (recentCharsRead / recentTime) * 60 : 0; // chars per hour

    const remainingChars = Math.max(totalCharCount - totalCharsRead, 0);
    const recentEstimatedTimeToFinish =
      recentReadingSpeed > 0 ? remainingChars / recentReadingSpeed : 0; // in hours
    const recentEstimatedTimeToFinishCurrentVolume =
      recentReadingSpeed > 0
        ? currentVolumeRemainingChars / recentReadingSpeed
        : 0;

    // Calculate my stats for comparison
    const myTotalXp = myLogsArray.reduce((acc, log) => acc + log.xp, 0);
    const myTotalTime = myLogsArray.reduce(
      (acc, log) => acc + (log.time ?? 0),
      0
    );
    const myTotalCharsRead = myLogsArray.reduce(
      (acc, log) => acc + (log.chars ?? 0),
      0
    );
    const myReadingPercentage =
      totalCharCount > 0
        ? Math.min((myTotalCharsRead / totalCharCount) * 100, 100)
        : 0;
    const myReadingSpeed =
      myTotalTime && myTotalTime > 0
        ? (myTotalCharsRead / myTotalTime) * 60
        : 0;

    return {
      sortedLogs,
      totalXp,
      totalTime,
      totalCharsRead,
      totalCharCount,
      totalSeriesVolumes,
      currentVolume,
      currentVolumeCharsRead,
      currentVolumeCharCount,
      currentVolumeReadingPercentage,
      currentVolumeRemainingChars,
      readingPercentage,
      readingSpeed,
      recentLogs,
      recentReadingSpeed,
      recentEstimatedTimeToFinish,
      recentEstimatedTimeToFinishCurrentVolume,
      myTotalXp,
      myTotalTime,
      myTotalCharsRead,
      myReadingPercentage,
      myReadingSpeed,
      remainingChars,
    };
  })();

  // Destructure calculations for easier access
  const {
    totalXp,
    totalTime,
    totalCharsRead,
    totalCharCount,
    totalSeriesVolumes,
    currentVolume,
    currentVolumeCharsRead,
    currentVolumeCharCount,
    currentVolumeReadingPercentage,
    currentVolumeRemainingChars,
    readingPercentage,
    readingSpeed,
    recentLogs,
    recentReadingSpeed,
    recentEstimatedTimeToFinish,
    recentEstimatedTimeToFinishCurrentVolume,
    myTotalXp,
    myTotalTime,
    myTotalCharsRead,
    myReadingPercentage,
    myReadingSpeed,
    remainingChars,
  } = calculations;

  const percentRemaining =
    totalCharCount > 0 ? Math.max(0, 100 - readingPercentage) : 0;

  const isVolumeBasedMedia =
    mediaDocument?.type === 'manga' || mediaDocument?.type === 'reading';
  const isLastVolumeCompleted =
    isVolumeBasedMedia &&
    totalSeriesVolumes > 0 &&
    !!currentVolume &&
    currentVolume >= totalSeriesVolumes &&
    currentVolumeCharCount > 0 &&
    currentVolumeReadingPercentage >= 100;
  const isCharacterProgressCompleted =
    (mediaDocument?.type === 'vn' ||
      mediaDocument?.type === 'game' ||
      mediaDocument?.type === 'manga' ||
      mediaDocument?.type === 'reading' ||
      mediaDocument?.type === 'book') &&
    totalCharCount > 0 &&
    readingPercentage >= 100;
  const isAutoCompleteSuppressed =
    mediaDocument?.autoCompleteSuppressed ?? false;
  const totalEpisodesWatched = logsArray.reduce(
    (acc, log) => acc + (log.episodes ?? 0),
    0
  );
  const totalEpisodeCount = mediaDocument?.episodes ?? 0;
  const isEpisodeProgressCompleted =
    totalEpisodeCount > 0 && totalEpisodesWatched >= totalEpisodeCount;
  const shouldAutoCompleteMedia =
    !mediaDocument?.isCompleted &&
    (!isAutoCompleteSuppressed ||
      mediaDocument?.mediaStatus === 'in_progress') &&
    (isLastVolumeCompleted ||
      isCharacterProgressCompleted ||
      isEpisodeProgressCompleted);
  const effectiveIsCompleted =
    !!mediaDocument?.isCompleted || shouldAutoCompleteMedia;

  // Status badge shown on the Media Details card. Falls back to the presence of
  // logs so untouched media reads "Not started" instead of "In progress".
  const statusBadge: { label: string; className: string } = (() => {
    if (effectiveIsCompleted)
      return { label: 'Completed', className: 'badge-success' };

    switch (mediaDocument?.mediaStatus) {
      case 'dropped':
        return { label: 'Dropped', className: 'badge-error' };
      case 'paused':
        return { label: 'Paused', className: 'badge-warning' };
      case 'planning':
        return { label: 'Planning', className: 'badge-info' };
      case 'in_progress':
        return { label: 'In progress', className: 'badge-outline' };
      default:
        return logsArray.length > 0
          ? { label: 'In progress', className: 'badge-outline' }
          : { label: 'Not started', className: 'badge-ghost' };
    }
  })();
  const isOwnProfile =
    !!currentUser?.username && (!username || currentUser.username === username);
  const useCurrentVolumeProgress =
    isVolumeBasedMedia && currentVolumeCharCount > 0;
  const progressCharsRead = isVolumeBasedMedia
    ? currentVolumeCharsRead
    : totalCharsRead;
  const progressTotalChars = isVolumeBasedMedia
    ? currentVolumeCharCount
    : totalCharCount;
  const progressPercentage = isVolumeBasedMedia
    ? currentVolumeReadingPercentage
    : readingPercentage;
  const progressRemainingChars = isVolumeBasedMedia
    ? currentVolumeRemainingChars
    : remainingChars;
  const progressPercentRemaining = isVolumeBasedMedia
    ? Math.max(0, 100 - currentVolumeReadingPercentage)
    : percentRemaining;
  const progressEstimatedTimeToFinish = isVolumeBasedMedia
    ? recentEstimatedTimeToFinishCurrentVolume
    : recentEstimatedTimeToFinish;

  useEffect(() => {
    if (
      !isOwnProfile ||
      !shouldAutoCompleteMedia ||
      !mediaDocument?.contentId ||
      !mediaDocument?.type
    ) {
      return;
    }

    const mediaKey = `${mediaDocument.type}:${mediaDocument.contentId}`;
    if (autoCompletionTriggerRef.current === mediaKey) {
      return;
    }

    autoCompletionTriggerRef.current = mediaKey;
    autoCompleteMedia({
      mediaId: mediaDocument.contentId,
      type: mediaDocument.type,
      completed: true,
      source: 'auto',
    });
  }, [
    autoCompleteMedia,
    isOwnProfile,
    mediaDocument?.contentId,
    mediaDocument?.type,
    shouldAutoCompleteMedia,
  ]);

  // Get difficulty info
  const difficultyLevel = mediaDocument?.jiten?.mainDeck.difficulty;
  const difficultyInfo =
    difficultyLevel !== undefined &&
    difficultyLevel >= 0 &&
    difficultyLevel < difficultyLevels.length
      ? difficultyLevels[Math.floor(difficultyLevel)]
      : null;

  const visibleLogs = filteredLogs.slice(0, visibleLogsCount);
  const hasMoreLogs = filteredLogs.length > visibleLogsCount;
  const mediaReviews = mediaReviewsData?.reviews || [];
  const userReview = mediaReviews.find(
    (review) => review.user._id === currentUser?._id
  );

  // Club-linked view: parse query params and fetch club data/stats/logs
  const searchParams = new URLSearchParams(window.location.search);
  const clubIdParam = searchParams.get('clubId');
  const clubMediaIdParam = searchParams.get('clubMediaId');

  const { data: clubData } = useQuery({
    queryKey: ['club', clubIdParam],
    queryFn: () => {
      if (!clubIdParam) throw new Error('clubId is required');
      return getClubFn(clubIdParam);
    },
    enabled: !!clubIdParam,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clubMediaStatsData } = useQuery({
    queryKey: ['clubMediaStats', clubIdParam, clubMediaIdParam],
    queryFn: () => {
      if (!clubIdParam || !clubMediaIdParam)
        throw new Error('clubId and clubMediaId are required');
      return getClubMediaStatsFn(clubIdParam, clubMediaIdParam);
    },
    enabled: !!clubIdParam && !!clubMediaIdParam,
  });

  const clubMemberUserIds = new Set<string>(
    clubData?.members?.map((m) => String(m.user?._id)) ?? []
  );

  const isClubLinkedView = !!clubIdParam && !!clubMediaIdParam;

  const clubMediaReviews = isClubLinkedView
    ? mediaReviews.filter((r) => clubMemberUserIds.has(String(r.user._id)))
    : mediaReviews;

  const displayedReviews = clubMediaReviews;
  const mediaBasePath =
    mediaDocument?.type && mediaDocument?.contentId
      ? clubIdParam && clubMediaIdParam
        ? `/${mediaDocument.type}/${mediaDocument.contentId}?clubId=${encodeURIComponent(
            clubIdParam
          )}&clubMediaId=${encodeURIComponent(clubMediaIdParam)}`
        : username
          ? `/${mediaDocument.type}/${mediaDocument.contentId}/${username}`
          : `/${mediaDocument.type}/${mediaDocument.contentId}`
      : '';
  const igdbGameUrl = (() => {
    if (!mediaDocument || mediaDocument.type !== 'game') {
      return null;
    }

    const typedMedia = mediaDocument as IMediaDocument & {
      igdbId?: number;
      igdbSlug?: string;
      igdbUrl?: string;
      url?: string;
    };

    const directUrl = [typedMedia.igdbUrl, typedMedia.url].find(
      (url) => typeof url === 'string' && url.includes('igdb.com')
    );

    if (directUrl) {
      return directUrl;
    }

    if (typedMedia.igdbSlug && typedMedia.igdbSlug.trim()) {
      return `https://www.igdb.com/games/${typedMedia.igdbSlug.trim()}`;
    }

    const rawTitle =
      mediaDocument.title.contentTitleEnglish ||
      mediaDocument.title.contentTitleNative ||
      mediaDocument.title.contentTitleRomaji ||
      '';

    const slugFromTitle = rawTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (slugFromTitle) {
      return `https://www.igdb.com/games/${slugFromTitle}`;
    }

    const fallbackId =
      typeof typedMedia.igdbId === 'number' &&
      Number.isFinite(typedMedia.igdbId)
        ? String(typedMedia.igdbId)
        : mediaDocument.contentId?.startsWith('igdb-')
          ? mediaDocument.contentId.slice(5)
          : '';

    if (fallbackId) {
      return `https://www.igdb.com/search?type=1&q=${encodeURIComponent(fallbackId)}`;
    }

    return null;
  })();

  const episodeProgressPercentage =
    totalEpisodeCount > 0
      ? Math.min((totalEpisodesWatched / totalEpisodeCount) * 100, 100)
      : 0;
  const writeReviewPath = mediaBasePath
    ? `${mediaBasePath}/reviews/write`
    : '#';
  const reviewsTabPath = mediaBasePath ? `${mediaBasePath}/reviews` : '#';

  const handleShowMore = () => {
    setVisibleLogsCount((prev) => Math.min(prev + 10, filteredLogs.length));
  };

  const dateFilterOptions: Array<{
    value: typeof dateFilter;
    label: string;
  }> = [
    { value: 'all', label: 'All time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'year', label: 'This year' },
    { value: 'custom', label: 'Custom range' },
  ];

  const sortOptions: Array<{
    value: typeof sortBy;
    label: string;
  }> = [
    { value: 'date', label: 'Date' },
    { value: 'xp', label: 'XP' },
    { value: 'episodes', label: 'Episodes' },
    { value: 'chars', label: 'Characters' },
    { value: 'pages', label: 'Pages' },
    { value: 'time', label: 'Time' },
    { value: 'readingSpeed', label: 'Reading Speed' },
  ];

  const getDateFilterLabel = () =>
    dateFilterOptions.find((option) => option.value === dateFilter)?.label ||
    'All time';

  const getSortLabel = () =>
    sortOptions.find((option) => option.value === sortBy)?.label || 'Date';

  const getCustomRangeLabel = () => {
    if (!customStartDate && !customEndDate) return 'Select range';
    const startLabel = customStartDate
      ? formatDateOnly(customStartDate)
      : 'Start';
    const endLabel = customEndDate ? formatDateOnly(customEndDate) : 'End';
    return `${startLabel} → ${endLabel}`;
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setDateFilter('all');
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    setSortBy('date');
    setSortDirection('desc');
  };

  const hasActiveFilters =
    !!searchTerm ||
    dateFilter !== 'all' ||
    sortBy !== 'date' ||
    sortDirection !== 'desc';

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
            {/* Left column skeleton - Media Details Card */}
            <div className="space-y-6 min-w-0">
              <div className="card surface">
                <div className="card-body">
                  <div className="skeleton h-6 w-32 mb-4"></div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-4 w-16"></div>
                      <div className="skeleton h-6 w-20 rounded-full"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-4 w-20"></div>
                      <div className="skeleton h-6 w-24 rounded-full"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-4 w-16"></div>
                      <div className="skeleton h-4 w-20"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-4 w-18"></div>
                      <div className="skeleton h-4 w-16"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-4 w-20"></div>
                      <div className="skeleton h-4 w-24"></div>
                    </div>
                    <div className="divider my-4"></div>
                    <div className="skeleton h-4 w-28 mb-3"></div>
                    <div className="flex flex-wrap gap-2">
                      <div className="skeleton h-8 w-16 rounded-lg"></div>
                      <div className="skeleton h-8 w-20 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column skeleton - Progress Chart and Activity Logs */}
            <div className="space-y-6 min-w-0">
              {/* Progress Chart skeleton */}
              <div className="card surface">
                <div className="card-body">
                  <div className="skeleton h-6 w-40 mb-4"></div>
                  <div className="skeleton h-64 w-full rounded-lg"></div>
                </div>
              </div>

              {/* Activity Logs skeleton */}
              <div className="card surface">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-6">
                    <div className="skeleton h-6 w-32"></div>
                    <div className="skeleton h-8 w-24 rounded-lg"></div>
                  </div>
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="card surface-muted">
                        <div className="card-body p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="skeleton h-5 w-48"></div>
                            <div className="skeleton h-4 w-16"></div>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <div className="skeleton h-6 w-16 rounded-full"></div>
                            <div className="skeleton h-6 w-20 rounded-full"></div>
                          </div>
                          <div className="space-y-2">
                            <div className="skeleton h-4 w-full"></div>
                            <div className="skeleton h-4 w-3/4"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Comparison Card Component
  const ComparisonCard = () => {
    if (!isViewingOtherUser) return null;

    // Use efficient comparison data if available, otherwise use calculated data
    const useEfficient =
      comparisonData && comparisonData.user1 && comparisonData.user2;

    // If we don't have comparison data and don't have my logs, don't show
    if (!useEfficient && myLogsArray.length === 0) return null;

    // Get stats from either efficient endpoint or calculated
    const myStats: IComparisonStats = useEfficient
      ? comparisonData.user1.stats
      : {
          totalXp: myTotalXp,
          totalTime: myTotalTime,
          totalChars: myTotalCharsRead,
          readingSpeed: myReadingSpeed,
          totalPages: myLogsArray.reduce(
            (acc, log) => acc + (log.pages ?? 0),
            0
          ),
          totalEpisodes: myLogsArray.reduce(
            (acc, log) => acc + (log.episodes ?? 0),
            0
          ),
          logCount: myLogsArray.length,
          readingPercentage: myReadingPercentage,
        };

    const theirStats: IComparisonStats = useEfficient
      ? comparisonData.user2.stats
      : {
          totalXp,
          totalTime,
          totalChars: totalCharsRead,
          readingSpeed,
          totalPages: logsArray.reduce((acc, log) => acc + (log.pages ?? 0), 0),
          totalEpisodes: logsArray.reduce(
            (acc, log) => acc + (log.episodes ?? 0),
            0
          ),
          logCount: logsArray.length,
          readingPercentage,
        };

    const ComparisonStat = ({
      label,
      myValue,
      theirValue,
      unit = '',
      formatter = (val: number) => numberWithCommas(val),
    }: {
      label: string;
      myValue: number;
      theirValue: number;
      unit?: string;
      formatter?: (val: number) => string;
    }) => {
      const difference = myValue - theirValue;
      const isHigher = difference > 0;
      const isEqual = difference === 0;

      return (
        <div className="stat surface-muted p-3">
          <div className="stat-title text-xs">{label}</div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <div className="stat-value text-sm sm:text-lg text-primary truncate">
              {formatter(myValue)}
              {unit}
            </div>
            <div className="text-xs hidden sm:block">vs</div>
            <div className="stat-value text-sm sm:text-lg text-base-content/60 truncate">
              {formatter(theirValue)}
              {unit}
            </div>
          </div>
          <div
            className={`stat-desc flex items-center gap-1 text-xs ${
              isEqual
                ? 'text-base-content/60'
                : isHigher
                  ? 'text-success'
                  : 'text-error'
            }`}
          >
            {!isEqual && (
              <svg
                className="w-3 h-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isHigher ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                />
              </svg>
            )}
            <span className="truncate">
              {isEqual
                ? 'Same'
                : `${formatter(Math.abs(difference))}${unit} ${isHigher ? 'ahead' : 'behind'}`}
            </span>
          </div>
        </div>
      );
    };

    return (
      <div className="card bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/20 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Comparison: You vs {username}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComparisonStat
              label={t('stats.totalXp')}
              myValue={myStats.totalXp}
              theirValue={theirStats.totalXp}
            />

            <ComparisonStat
              label={t('stats.totalTime')}
              myValue={myStats.totalTime}
              theirValue={theirStats.totalTime}
              unit="m"
              formatter={(val) =>
                val >= 60
                  ? `${Math.floor(val / 60)}h ${val % 60}`
                  : val.toString()
              }
            />

            {(mediaDocument?.type === 'vn' ||
              mediaDocument?.type === 'game' ||
              mediaDocument?.type === 'manga' ||
              mediaDocument?.type === 'reading' ||
              mediaDocument?.type === 'book') &&
              totalCharCount > 0 &&
              myStats.readingPercentage !== null &&
              theirStats.readingPercentage !== null && (
                <>
                  <ComparisonStat
                    label={t('stats.charsRead')}
                    myValue={myStats.totalChars}
                    theirValue={theirStats.totalChars}
                  />

                  <ComparisonStat
                    label={t('stats.completion')}
                    myValue={myStats.readingPercentage}
                    theirValue={theirStats.readingPercentage}
                    unit="%"
                    formatter={(val) => val.toFixed(1)}
                  />

                  {myStats.readingSpeed > 0 && theirStats.readingSpeed > 0 && (
                    <ComparisonStat
                      label={t('stats.readingSpeed')}
                      myValue={myStats.readingSpeed}
                      theirValue={theirStats.readingSpeed}
                      unit=" chars/hr"
                      formatter={(val) => Math.round(val).toString()}
                    />
                  )}
                </>
              )}

            {(mediaDocument?.type === 'anime' ||
              mediaDocument?.type === 'tv show') && (
              <ComparisonStat
                label={t('stats.episodesWatched')}
                myValue={myStats.totalEpisodes}
                theirValue={theirStats.totalEpisodes}
              />
            )}

            {mediaDocument?.type === 'manga' && (
              <ComparisonStat
                label={t('stats.pagesRead')}
                myValue={myStats.totalPages}
                theirValue={theirStats.totalPages}
              />
            )}
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-base-content/70">
              You have{' '}
              <span className="font-semibold text-primary">
                {myStats.logCount}
              </span>{' '}
              log{myStats.logCount !== 1 ? 's' : ''} • {username} has{' '}
              <span className="font-semibold text-secondary">
                {theirStats.logCount}
              </span>{' '}
              log{theirStats.logCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          <div className="space-y-6 min-w-0">
            <div className="card surface">
              <div className="card-body">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <h2 className="card-title text-xl flex items-center gap-2 mb-0">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {t('details.title')}
                  </h2>

                  {mediaDocument && (
                    <div className="flex flex-col gap-1 sm:items-end">
                      <div
                        className={
                          mediaDocument.isCompleted && mediaDocument.completedAt
                            ? 'tooltip tooltip-bottom sm:tooltip-left before:max-w-[calc(100vw-2rem)] before:whitespace-normal before:break-words'
                            : ''
                        }
                        data-tip={
                          mediaDocument.isCompleted && mediaDocument.completedAt
                            ? `Completed at ${formatDateOnly(
                                new Date(mediaDocument.completedAt)
                              )}`
                            : undefined
                        }
                      >
                        <span
                          className={`badge ${statusBadge.className} ${
                            effectiveIsCompleted && mediaDocument.completedAt
                              ? 'cursor-help'
                              : ''
                          }`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-base-content/70 min-w-20">
                      {t('details.type')}
                    </span>
                    <div className="badge badge-primary badge-lg capitalize font-medium">
                      {mediaDocument?.type === 'vn'
                        ? 'visual novel'
                        : mediaDocument?.type === 'game'
                          ? 'video game'
                          : mediaDocument?.type === 'reading'
                            ? 'light novel'
                            : mediaDocument?.type || mediaType}
                    </div>
                  </div>

                  {difficultyInfo && (
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-base-content/70 min-w-20">
                        {t('details.difficulty')}
                      </span>
                      <div
                        className="badge badge-lg gap-2"
                        style={{
                          backgroundColor: difficultyInfo[1],
                          color: 'white',
                        }}
                      >
                        <div className="w-2 h-2 rounded-full bg-white/80"></div>
                        <span>{difficultyInfo[0]}</span>
                      </div>
                    </div>
                  )}

                  {(mediaType === 'anime' || mediaType === 'tv show') && (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-base-content/70 min-w-20">
                          {t('details.episodes')}
                        </span>
                        <span>{mediaDocument?.episodes ?? 'Unknown'}</span>
                      </div>
                      {mediaType === 'anime' && (
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-base-content/70 min-w-20">
                            {t('details.duration')}
                          </span>
                          <span>
                            {mediaDocument?.episodeDuration &&
                            mediaDocument.episodeDuration >= 60
                              ? `${Math.floor(mediaDocument.episodeDuration / 60)}h `
                              : ''}
                            {mediaDocument?.episodeDuration &&
                            mediaDocument.episodeDuration % 60 > 0
                              ? `${mediaDocument.episodeDuration % 60}m`
                              : 'Unknown'}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {mediaType === 'book' && (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-base-content/70 min-w-20">
                          {t('details.pages')}
                        </span>
                        <span>{mediaDocument?.pageCount ?? 'Unknown'}</span>
                      </div>
                      {mediaDocument?.authors &&
                        mediaDocument.authors.length > 0 && (
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-base-content/70 min-w-20">
                              {t('details.authors')}
                            </span>
                            <span>{mediaDocument.authors.join(', ')}</span>
                          </div>
                        )}
                      {mediaDocument?.publishedDate && (
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-base-content/70 min-w-20">
                            {t('details.published')}
                          </span>
                          <span>{mediaDocument.publishedDate}</span>
                        </div>
                      )}
                    </>
                  )}

                  {(mediaType === 'manga' || mediaType === 'reading') && (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-base-content/70 min-w-20">
                          {t('details.volumes')}
                        </span>
                        <span>{mediaDocument?.volumes ?? 'Unknown'}</span>
                      </div>
                      {mediaType === 'manga' && (
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-base-content/70 min-w-20">
                            {t('details.chapters')}
                          </span>
                          <span>{mediaDocument?.chapters ?? 'Unknown'}</span>
                        </div>
                      )}
                    </>
                  )}

                  {mediaDocument?.jiten?.mainDeck.characterCount ? (
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-base-content/70 min-w-20">
                        {t('details.characters')}
                      </span>
                      <span>
                        {numberWithCommas(
                          mediaDocument.jiten.mainDeck.characterCount
                        )}
                      </span>
                    </div>
                  ) : null}

                  <div className="divider my-4"></div>

                  <div>
                    <h3 className="font-semibold text-base-content/70 mb-3 flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.102m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                      {t('details.externalLinks')}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(mediaDocument?.type === 'anime' ||
                        mediaDocument?.type === 'manga' ||
                        mediaDocument?.type === 'reading') && (
                        <a
                          className="btn btn-outline btn-sm gap-2"
                          href={`https://anilist.co/${
                            mediaDocument?.type === 'anime' ? 'anime' : 'manga'
                          }/${mediaDocument?.contentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          AniList
                        </a>
                      )}
                      {mediaDocument?.type === 'vn' && (
                        <a
                          className="btn btn-outline btn-sm gap-2"
                          href={`https://vndb.org/${mediaDocument?.contentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                          </svg>
                          VNDB
                        </a>
                      )}
                      {mediaDocument?.type === 'book' &&
                        mediaDocument?.contentId && (
                          <a
                            className="btn btn-outline btn-sm gap-2"
                            href={`https://books.google.com/books?id=${mediaDocument.contentId.replace(
                              /^gbooks-/,
                              ''
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                              />
                            </svg>
                            Google Books
                          </a>
                        )}
                      {mediaDocument?.type === 'game' && igdbGameUrl && (
                        <a
                          className="btn btn-outline btn-sm gap-2"
                          href={igdbGameUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          IGDB
                        </a>
                      )}
                      {mediaDocument?.type === 'video' && (
                        <a
                          className="btn btn-outline btn-sm gap-2"
                          href={`https://www.youtube.com/channel/${mediaDocument?.contentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                          </svg>
                          YouTube
                        </a>
                      )}
                      {mediaDocument?.jiten?.mainDeck && (
                        <a
                          className="btn btn-outline btn-sm gap-2"
                          href={`https://jiten.moe/decks/media/${mediaDocument.jiten.mainDeck.deckId}/detail`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                            />
                          </svg>
                          Jiten
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ReviewRatingSummary
              reviews={displayedReviews}
              reviewsTabPath={reviewsTabPath}
            />

            {isClubLinkedView && clubData && (
              <div className="card surface my-4">
                <div className="card-body">
                  <h3 className="card-title text-lg">Club: {clubData.name}</h3>
                  {clubData.description && (
                    <p className="text-sm text-base-content/70 mb-2">
                      {clubData.description}
                    </p>
                  )}
                  {clubMediaStatsData?.total && (
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div className="text-sm">
                        Logs: {clubMediaStatsData.total.logs}
                      </div>
                      <div className="text-sm">
                        Members: {clubMediaStatsData.total.members}
                      </div>
                      <div className="text-sm">
                        XP: {numberWithCommas(clubMediaStatsData.total.xp)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card surface">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  {username}'s Stats
                </h2>

                <div className="grid grid-cols-1 gap-4">
                  <div className="card surface hover:shadow-lg transition-shadow">
                    <div className="card-body">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                            {t('stats.totalXp')}
                          </h3>
                          <p className="text-3xl font-bold text-primary mt-1">
                            {numberWithCommas(totalXp || 0)}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-primary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            ></path>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {totalTime > 0 && (
                    <div className="card surface hover:shadow-lg transition-shadow">
                      <div className="card-body">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                              {t('stats.totalTime')}
                            </h3>
                            <p className="text-3xl font-bold text-secondary mt-1">
                              {totalTime >= 60
                                ? `${Math.floor(totalTime / 60)}h `
                                : ''}
                              {totalTime % 60 > 0 ? `${totalTime % 60}m` : ''}
                            </p>
                          </div>
                          <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-secondary"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              ></path>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(mediaDocument?.type === 'anime' ||
                    mediaDocument?.type === 'tv show') &&
                    logsArray.length > 0 &&
                    logsArray.some(
                      (log) => log.episodes && log.episodes > 0
                    ) && (
                      <div className="card surface hover:shadow-lg transition-shadow">
                        <div className="card-body">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                {t('stats.episodesWatched')}
                              </h3>
                              <p className="text-3xl font-bold text-accent mt-1">
                                {totalEpisodesWatched}
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-accent"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2"
                                ></path>
                              </svg>
                            </div>
                          </div>

                          {totalEpisodeCount > 0 && (
                            <div className="mt-3 space-y-2">
                              <progress
                                className="progress progress-accent w-full"
                                value={episodeProgressPercentage}
                                max="100"
                              ></progress>
                              {isEpisodeProgressCompleted ? (
                                <>
                                  <p className="text-xs text-base-content/60">
                                    {t('stats.completed')}
                                  </p>
                                  <p className="text-xs text-base-content/60">
                                    {t('stats.allCaughtUp')}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-base-content/60">
                                  {numberWithCommas(totalEpisodesWatched)} /{' '}
                                  {numberWithCommas(totalEpisodeCount)} episodes
                                  ({episodeProgressPercentage.toFixed(1)}%)
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {mediaDocument?.type === 'manga' &&
                    logsArray.length > 0 &&
                    logsArray.some((log) => log.pages && log.pages > 0) && (
                      <div className="card surface hover:shadow-lg transition-shadow">
                        <div className="card-body">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                {t('stats.pagesRead')}
                              </h3>
                              <p className="text-3xl font-bold text-accent mt-1">
                                {numberWithCommas(
                                  logsArray.reduce(
                                    (acc, log) => acc + (log.pages ?? 0),
                                    0
                                  )
                                )}
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-accent"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2"
                                ></path>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {(mediaDocument?.type === 'manga' ||
                    mediaDocument?.type === 'reading') &&
                    logsArray.length > 0 && (
                      <div className="card surface hover:shadow-lg transition-shadow">
                        <div className="card-body">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                {t('stats.currentVolume')}
                              </h3>
                              <p className="text-3xl font-bold text-accent mt-1">
                                {currentVolume ?? '?'}
                                {totalSeriesVolumes > 0
                                  ? `/${totalSeriesVolumes}`
                                  : ''}
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-accent"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M12 6v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                ></path>
                              </svg>
                            </div>
                          </div>

                          {currentVolumeCharCount > 0 &&
                            !effectiveIsCompleted && (
                              <div className="mt-3 space-y-2">
                                <progress
                                  className="progress progress-accent w-full"
                                  value={currentVolumeReadingPercentage}
                                  max="100"
                                ></progress>
                                <p className="text-xs text-base-content/60">
                                  {numberWithCommas(currentVolumeCharsRead)} /{' '}
                                  {numberWithCommas(currentVolumeCharCount)}{' '}
                                  chars (
                                  {currentVolumeReadingPercentage.toFixed(1)}%)
                                </p>
                              </div>
                            )}
                        </div>
                      </div>
                    )}

                  {(mediaDocument?.type === 'vn' ||
                    mediaDocument?.type === 'game' ||
                    mediaDocument?.type === 'manga' ||
                    mediaDocument?.type === 'reading' ||
                    mediaDocument?.type === 'book') &&
                    totalCharsRead > 0 && (
                      <div className="card surface hover:shadow-lg transition-shadow">
                        <div className="card-body">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                {t('stats.charsRead')}
                              </h3>
                              <p className="text-3xl font-bold text-info mt-1">
                                {numberWithCommas(totalCharsRead)}
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-info"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2"
                                ></path>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {(mediaDocument?.type === 'vn' ||
                    mediaDocument?.type === 'game' ||
                    mediaDocument?.type === 'manga' ||
                    mediaDocument?.type === 'reading' ||
                    mediaDocument?.type === 'book') &&
                    progressTotalChars > 0 &&
                    !effectiveIsCompleted && (
                      <div className="card surface hover:shadow-lg transition-shadow">
                        <div className="card-body">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                {useCurrentVolumeProgress
                                  ? 'Volume Characters Remaining'
                                  : 'Characters Remaining'}
                              </h3>
                              <p className="text-3xl font-bold text-info mt-1">
                                {progressRemainingChars > 0
                                  ? numberWithCommas(progressRemainingChars)
                                  : 'Completed'}
                              </p>
                              <p className="text-xs text-base-content/60">
                                {progressRemainingChars > 0
                                  ? `${progressPercentRemaining.toFixed(1)}% left`
                                  : 'All caught up'}
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-info"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M12 6v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                ></path>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {(mediaDocument?.type === 'vn' ||
                    mediaDocument?.type === 'game' ||
                    mediaDocument?.type === 'manga' ||
                    mediaDocument?.type === 'reading' ||
                    mediaDocument?.type === 'book') &&
                    readingSpeed > 0 && (
                      <div className="card surface hover:shadow-lg transition-shadow">
                        <div className="card-body">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                {t('stats.readingSpeed')}
                              </h3>
                              <p className="text-3xl font-bold text-warning mt-1">
                                {numberWithCommas(Math.round(readingSpeed))}
                              </p>
                              <p className="text-xs text-base-content/60">
                                {t('stats.charsPerHour')}
                              </p>
                            </div>
                            <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-warning"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M13 10V3L4 14h7v7l9-11h-7z"
                                ></path>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                {(mediaDocument?.type === 'vn' ||
                  mediaDocument?.type === 'game' ||
                  mediaDocument?.type === 'manga' ||
                  mediaDocument?.type === 'reading' ||
                  mediaDocument?.type === 'book') &&
                  progressTotalChars > 0 &&
                  !effectiveIsCompleted && (
                    <div className="mt-6 space-y-4">
                      <div className="divider">
                        {useCurrentVolumeProgress
                          ? `Volume ${currentVolume ?? '?'} Progress`
                          : 'Reading Progress'}
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            {t('stats.completion')}
                          </span>
                          <span className="text-sm font-bold">
                            {progressPercentage.toFixed(1)}%
                          </span>
                        </div>
                        <progress
                          className="progress progress-primary w-full"
                          value={progressPercentage}
                          max="100"
                        ></progress>
                        <div className="flex justify-between text-xs text-base-content/60">
                          <span>
                            {numberWithCommas(progressCharsRead)} chars
                          </span>
                          <span>
                            {numberWithCommas(progressTotalChars)} chars
                          </span>
                        </div>
                      </div>

                      {progressTotalChars > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {readingSpeed > 0 &&
                            recentReadingSpeed > 0 &&
                            recentLogs.length > 0 && (
                              <div className="card surface">
                                <div className="card-body">
                                  <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                    {t('stats.recentSpeed')}
                                  </h3>
                                  <p className="text-2xl font-bold mt-1">
                                    {numberWithCommas(
                                      Math.round(recentReadingSpeed)
                                    )}
                                  </p>
                                  <p className="text-xs text-base-content/60">
                                    chars/hour (last {recentLogs.length} logs)
                                  </p>
                                </div>
                              </div>
                            )}

                          {readingSpeed > 0 &&
                            progressEstimatedTimeToFinish > 0 &&
                            progressPercentage < 100 && (
                              <div className="card surface">
                                <div className="card-body">
                                  <h3 className="text-sm font-medium text-base-content/70 uppercase tracking-wide">
                                    {t('stats.timeToFinish')}
                                  </h3>
                                  <p className="text-2xl font-bold mt-1">
                                    {progressEstimatedTimeToFinish >= 1
                                      ? Math.round(
                                          progressEstimatedTimeToFinish
                                        )
                                      : Math.round(
                                          progressEstimatedTimeToFinish * 60
                                        )}
                                  </p>
                                  <p className="text-xs text-base-content/60">
                                    {progressEstimatedTimeToFinish >= 1
                                      ? 'hours'
                                      : 'minutes'}{' '}
                                    (recent pace)
                                  </p>
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="space-y-6 min-w-0">
            <div className="card surface">
              <div className="card-body">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h2 className="card-title text-xl flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    {t('chart.title')}
                  </h2>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-base-content/70">
                        {t('chart.metric')}
                      </span>
                      <div className="join">
                        <button
                          className={`join-item btn btn-sm ${
                            chartMetric === 'xp' ? 'btn-primary' : 'btn-outline'
                          }`}
                          onClick={() => setChartMetric('xp')}
                        >
                          <Zap className="w-4 h-4" />
                          XP
                        </button>
                        <button
                          className={`join-item btn btn-sm ${
                            chartMetric === 'hours'
                              ? 'btn-primary'
                              : 'btn-outline'
                          }`}
                          onClick={() => setChartMetric('hours')}
                        >
                          <Clock3 className="w-4 h-4" />
                          {t('chart.hours')}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-base-content/70">
                        {t('chart.view')}
                      </span>
                      <div className="join">
                        <button
                          className={`join-item btn btn-sm ${
                            chartView === 'line' ? 'btn-primary' : 'btn-outline'
                          }`}
                          onClick={() => setChartView('line')}
                        >
                          <LineChart className="w-4 h-4" />
                          {t('chart.line')}
                        </button>
                        <button
                          className={`join-item btn btn-sm ${
                            chartView === 'bar' ? 'btn-primary' : 'btn-outline'
                          }`}
                          onClick={() => setChartView('bar')}
                        >
                          <BarChart3 className="w-4 h-4" />
                          {t('chart.bar')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <ProgressChart
                  logs={logs as ILog[]}
                  selectedType={mediaDocument?.type}
                  metric={chartMetric}
                  chartType={chartView}
                  showTitle
                />
              </div>
            </div>

            <div className="card surface">
              <div className="card-body">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="card-title text-xl flex items-center gap-2">
                    <MessageSquareText className="w-5 h-5" />
                    {t('reviews.title')}
                  </h2>
                  {currentUser && !userReview && mediaBasePath && (
                    <Link
                      to={writeReviewPath}
                      className="btn btn-outline btn-sm gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      {t('reviews.write')}
                    </Link>
                  )}
                </div>
                {currentUser && userReview && (
                  <p className="text-sm text-base-content/70 mb-4">
                    {t('reviews.alreadyPosted')}
                  </p>
                )}

                {reviewsLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="loading loading-spinner loading-lg"></span>
                  </div>
                ) : mediaReviews.length > 0 ? (
                  <div className="space-y-4">
                    {displayedReviews.map((review) => (
                      <MediaReviewCard
                        key={review._id}
                        review={review}
                        currentUserId={currentUser?._id}
                        onEdit={setEditingReview}
                        onDelete={setDeletingReviewId}
                        onLike={(reviewId) =>
                          likeReviewMutation.mutate(reviewId)
                        }
                        likeDisabled={
                          likeReviewMutation.isPending || !currentUser
                        }
                        ratingColorClass="bg-primary"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-base-content/60">
                    <MessageSquareText className="mx-auto text-4xl mb-3 opacity-50" />
                    <h3 className="text-lg font-semibold mb-1">
                      {t('reviews.emptyTitle')}
                    </h3>
                    <p>{t('reviews.emptyBody')}</p>
                  </div>
                )}
              </div>
            </div>

            <ComparisonCard />

            <div className="card surface">
              <div className="card-body">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="card-title text-xl flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {t('activity.title')}
                  </h2>
                  {logsArray.length > 0 && (
                    <div className="badge badge-neutral">
                      {filteredLogs.length} / {logsArray.length} logs
                    </div>
                  )}
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                    <label className="input flex items-center gap-2 w-full xl:max-w-md">
                      <Search className="w-4 h-4 opacity-70" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('activity.searchPlaceholder')}
                        className="grow"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          aria-label={t('activity.a11y.clearSearch')}
                          className="btn btn-ghost btn-xs"
                          onClick={() => setSearchTerm('')}
                        >
                          ✕
                        </button>
                      )}
                    </label>

                    <div className="flex flex-col sm:flex-row gap-3 w-full xl:justify-end">
                      <div className="dropdown dropdown-bottom w-full sm:w-auto">
                        <div
                          tabIndex={0}
                          role="button"
                          className="btn btn-outline w-full sm:w-56 justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <Funnel className="w-4 h-4" />
                            Date: {getDateFilterLabel()}
                          </span>
                          <ChevronDown className="w-4 h-4 opacity-70" />
                        </div>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu surface-raised z-[1] w-full sm:w-60 p-2"
                        >
                          {dateFilterOptions.map((option) => (
                            <li key={option.value}>
                              <a
                                className={
                                  dateFilter === option.value ? 'active' : ''
                                }
                                onClick={() => setDateFilter(option.value)}
                              >
                                {option.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="dropdown dropdown-bottom w-full sm:w-auto">
                        <div
                          tabIndex={0}
                          role="button"
                          className="btn btn-outline w-full sm:w-56 justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <ListFilter className="w-4 h-4" />
                            Sort: {getSortLabel()}
                          </span>
                          {sortDirection === 'desc' ? (
                            <ArrowDown className="w-3 h-3 opacity-70" />
                          ) : (
                            <ArrowUp className="w-3 h-3 opacity-70" />
                          )}
                          <ChevronDown className="w-4 h-4 opacity-70" />
                        </div>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu surface-raised z-[1] w-full sm:w-64 p-2"
                        >
                          <li className="menu-title">
                            <span>{t('activity.sortField')}</span>
                          </li>
                          {sortOptions.map((option) => (
                            <li key={option.value}>
                              <a
                                className={
                                  sortBy === option.value ? 'active' : ''
                                }
                                onClick={() => setSortBy(option.value)}
                              >
                                {option.label}
                              </a>
                            </li>
                          ))}
                          <div className="divider my-1"></div>
                          <li className="menu-title">
                            <span>{t('activity.direction')}</span>
                          </li>
                          <li>
                            <a
                              className={
                                sortDirection === 'desc' ? 'active' : ''
                              }
                              onClick={() => setSortDirection('desc')}
                            >
                              <ArrowDown className="w-3 h-3" />
                              {t('activity.desc')}
                            </a>
                          </li>
                          <li>
                            <a
                              className={
                                sortDirection === 'asc' ? 'active' : ''
                              }
                              onClick={() => setSortDirection('asc')}
                            >
                              <ArrowUp className="w-3 h-3" />
                              {t('activity.asc')}
                            </a>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {dateFilter === 'custom' && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="dropdown dropdown-bottom flex-1 sm:flex-initial">
                        <div
                          tabIndex={0}
                          role="button"
                          className="btn btn-outline w-full sm:w-auto justify-between"
                        >
                          {customStartDate
                            ? formatDateOnly(customStartDate)
                            : 'Start date'}
                          <Clock4 className="w-4 h-4 opacity-70" />
                        </div>
                        <div
                          tabIndex={0}
                          className="dropdown-content z-[1000] card card-sm w-72 p-3 surface-raised"
                        >
                          <DayPicker
                            className="react-day-picker mx-auto"
                            mode="single"
                            selected={customStartDate}
                            onSelect={(date) => {
                              setCustomStartDate(date ?? undefined);
                              (document.activeElement as HTMLElement)?.blur?.();
                              if (
                                customEndDate &&
                                date &&
                                customEndDate < date
                              ) {
                                setCustomEndDate(undefined);
                              }
                            }}
                            disabled={(date) => date > new Date()}
                          />
                        </div>
                      </div>
                      <span className="hidden sm:flex items-center text-base-content/50">
                        to
                      </span>
                      <div className="dropdown dropdown-bottom flex-1 sm:flex-initial">
                        <div
                          // Not a <button>, so `btn-disabled` is the right class
                          // here — but on its own it only blocks pointer events,
                          // so the tab stop and the ARIA state go with it.
                          tabIndex={customStartDate ? 0 : -1}
                          role="button"
                          aria-disabled={!customStartDate}
                          // eslint-disable-next-line no-restricted-syntax -- not a <button>: the tabIndex and aria-disabled above carry the semantics.
                          className={`btn btn-outline w-full sm:w-auto justify-between ${!customStartDate ? 'btn-disabled' : ''}`}
                        >
                          {customEndDate
                            ? formatDateOnly(customEndDate)
                            : 'End date'}
                          <Clock4 className="w-4 h-4 opacity-70" />
                        </div>
                        {customStartDate && (
                          <div
                            tabIndex={0}
                            className="dropdown-content z-[1000] card card-sm w-72 p-3 surface-raised"
                          >
                            <DayPicker
                              className="react-day-picker mx-auto"
                              mode="single"
                              selected={customEndDate}
                              onSelect={(date) => {
                                setCustomEndDate(date ?? undefined);
                                (
                                  document.activeElement as HTMLElement
                                )?.blur?.();
                              }}
                              disabled={(date) => {
                                const today = new Date();
                                return (
                                  date > today ||
                                  (customStartDate && date < customStartDate)
                                );
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-base-content/60">
                        {t('activity.activeFilters')}
                      </span>

                      {searchTerm && (
                        <div className="badge badge-primary badge-sm gap-1">
                          Search: "{searchTerm}"
                          <button
                            type="button"
                            className="ml-1 hover:bg-primary-focus rounded-full"
                            aria-label={t('activity.a11y.clearSearch')}
                            onClick={() => setSearchTerm('')}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {dateFilter !== 'all' && (
                        <div className="badge badge-secondary badge-sm gap-1">
                          {dateFilter === 'custom'
                            ? getCustomRangeLabel()
                            : getDateFilterLabel()}
                          <button
                            type="button"
                            className="ml-1 hover:bg-secondary-focus rounded-full"
                            aria-label={t('activity.a11y.clearDate')}
                            onClick={() => setDateFilter('all')}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {(sortBy !== 'date' || sortDirection !== 'desc') && (
                        <div className="badge badge-info badge-sm gap-1">
                          Sort: {getSortLabel()} (
                          {sortDirection === 'asc' ? 'Asc' : 'Desc'})
                          <button
                            type="button"
                            className="ml-1 hover:bg-info-focus rounded-full"
                            aria-label={t('activity.a11y.resetSort')}
                            onClick={() => {
                              setSortBy('date');
                              setSortDirection('desc');
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-base-content/60 hover:text-base-content"
                        onClick={handleClearFilters}
                      >
                        {t('activity.clearAll')}
                      </button>
                    </div>
                  )}
                </div>

                {logsArray.length > 0 ? (
                  filteredLogs.length > 0 ? (
                    <div className="space-y-3">
                      {visibleLogs.map((log) => (
                        <LogCard key={log._id} log={log} user={username} />
                      ))}
                      {hasMoreLogs && (
                        <div className="text-center pt-6">
                          <button
                            className="btn btn-outline gap-2"
                            onClick={handleShowMore}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 14l-7 7m0 0l-7-7m7 7V3"
                              />
                            </svg>
                            Show More ({filteredLogs.length - visibleLogsCount}{' '}
                            remaining)
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-base-content/30 mb-6">
                        <svg
                          className="w-20 h-20 mx-auto"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-base-content/70 mb-2">
                        {t('activity.noMatches')}
                      </h3>
                      <p className="text-base-content/50 max-w-md mx-auto">
                        {t('activity.noMatchesBody')}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-12">
                    <div className="text-base-content/30 mb-6">
                      <svg
                        className="w-20 h-20 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-base-content/70 mb-2">
                      {t('activity.empty')}
                    </h3>
                    <p className="text-base-content/50 max-w-md mx-auto">
                      {t('activity.emptyBody')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {editingReview && (
        <EditReviewModal
          isOpen={!!editingReview}
          onClose={() => setEditingReview(null)}
          review={editingReview}
          onSubmit={(reviewData) =>
            editReviewMutation.mutate({
              reviewId: editingReview._id,
              reviewData,
            })
          }
          isLoading={editReviewMutation.isPending}
        />
      )}

      {deletingReviewId && (
        <dialog className="modal modal-bottom sm:modal-middle modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg">{t('reviews.deleteTitle')}</h3>
            <p className="py-4 text-base-content/70">
              {t('reviews.deleteConfirm')}
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setDeletingReviewId(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-error"
                disabled={deleteReviewMutation.isPending}
                onClick={() => {
                  deleteReviewMutation.mutate(deletingReviewId);
                  setDeletingReviewId(null);
                }}
              >
                {deleteReviewMutation.isPending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setDeletingReviewId(null)}
          />
        </dialog>
      )}
    </div>
  );
}

export default MediaDetails;
