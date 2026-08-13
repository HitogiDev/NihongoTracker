import React, { useEffect, useRef, useState, useCallback } from 'react';
import Field from '../components/ui/Field';
import {
  ICreateLog,
  ILog,
  ILoginResponse,
  IMediaDocument,
  youtubeChannelInfo,
} from '../types';
import {
  createLogFn,
  getMediaFn,
  getUserFn,
  getUserLogsFn,
  searchYouTubePlaylistFn,
  IPlaylistResult,
} from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useSearch from '../hooks/useSearch';
import { DayPicker } from 'react-day-picker';
import { useUserDataStore } from '../store/userData';
import { validateLogData } from '../utils/validation';
import { invalidateLogScreenQueries } from '../utils/logQueryInvalidation.js';
import MediaStats from '../components/MediaStats';
import TagSelector from '../components/TagSelector';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Info,
  Search,
} from 'lucide-react';
import PlaylistSelectorModal, {
  PlaylistVideoWithOverride,
} from '../components/PlaylistSelectorModal';
import type { ValidationKey } from '../utils/validation';
import { useValidationText } from '../hooks/useValidationText';
import { useTranslation } from 'react-i18next';
import { LOG_TYPE_OPTIONS } from '../utils/logTypes';

interface logDataType {
  type: ILog['type'] | null;
  titleNative: string;
  titleRomaji: string;
  titleEnglish: string;
  description: string;
  mediaDescription: {
    description: string;
    language: 'eng' | 'jpn' | 'spa';
  }[];
  mediaName: string;
  mediaId: string;
  episodes: number;
  duration: number;
  customDuration?: number;
  synonyms: string[];
  isAdult: boolean;
  isAdultImage?: boolean;
  watchedEpisodes: number;
  time: number;
  chars: number;
  readChars: number;
  logVolume: number | undefined;
  pages: number;
  readPages: number;
  chapters: undefined | number;
  volumes: undefined | number;
  pageCount?: number;
  authors?: string[];
  publishedDate?: string;
  hours: number;
  minutes: number;
  showTime: boolean;
  showChars: boolean;
  img: undefined | string;
  cover: undefined | string;
  unknownDate: boolean;
  date: Date | undefined;
  runtime?: number;
  youtubeChannelInfo: youtubeChannelInfo | null;
}

const createInitialLogState = (
  type: ILog['type'] | null = null
): logDataType => ({
  type,
  titleNative: '',
  titleRomaji: '',
  titleEnglish: '',
  description: '',
  mediaDescription: [
    {
      description: '',
      language: 'eng',
    },
  ],
  mediaName: '',
  mediaId: '',
  episodes: 0,
  duration: 0,
  customDuration: undefined,
  synonyms: [],
  isAdult: false,
  isAdultImage: false,
  watchedEpisodes: 0,
  time: 0,
  chars: 0,
  readChars: 0,
  logVolume: undefined,
  pages: 0,
  readPages: 0,
  chapters: undefined,
  volumes: undefined,
  pageCount: undefined,
  authors: undefined,
  publishedDate: undefined,
  hours: 0,
  minutes: 0,
  showTime: false,
  showChars: false,
  img: undefined,
  cover: undefined,
  unknownDate: false,
  date: undefined,
  runtime: undefined,
  youtubeChannelInfo: null,
});

const LAST_LOGGED_VOLUME_KEY_PREFIX = 'nt_last_logged_volume';

const getLastLoggedVolumeKey = (type: 'manga' | 'light-novel', mediaId: string) =>
  `${LAST_LOGGED_VOLUME_KEY_PREFIX}:${type}:${mediaId}`;

const readLastLoggedVolume = (
  type: 'manga' | 'light-novel',
  mediaId: string
): number | undefined => {
  const stored = localStorage.getItem(getLastLoggedVolumeKey(type, mediaId));
  if (!stored) return undefined;
  const parsed = Number(stored);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
};

const writeLastLoggedVolume = (
  type: 'manga' | 'light-novel',
  mediaId: string,
  volume: number
) => {
  if (!Number.isFinite(volume) || volume <= 0) return;
  localStorage.setItem(
    getLastLoggedVolumeKey(type, mediaId),
    String(Math.floor(volume))
  );
};

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

function LogScreen() {
  const { t } = useTranslation(['logs', 'common']);
  const { t: tCommon } = useTranslation('common');
  const vt = useValidationText();
  const [logData, setLogData] = useState<logDataType>(() =>
    createInitialLogState()
  );
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isAdvancedOptions, setIsAdvancedOptions] = useState<boolean>(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, ValidationKey>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isFormValid, setIsFormValid] = useState(false);

  // ── Playlist state ────────────────────────────────────────────────────────
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [isFetchingPlaylist, setIsFetchingPlaylist] = useState(false);
  const [playlistResult, setPlaylistResult] = useState<IPlaylistResult | null>(
    null
  );
  const [isBatchLogging, setIsBatchLogging] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  // ─────────────────────────────────────────────────────────────────────────

  const suggestionRef = useRef<HTMLDivElement>(null);
  const pendingVolumeRef = useRef<{
    type: ILog['type'] | null;
    mediaId?: string;
    volume?: number;
  } | null>(null);
  const { user, setUser } = useUserDataStore();

  const resolveNextRememberedVolume = async (
    type: 'manga' | 'light-novel',
    mediaId: string,
    submittedVolume: number
  ): Promise<number> => {
    if (!user?.username) return submittedVolume;

    try {
      const [mediaData, userLogs] = await Promise.all([
        getMediaFn(mediaId, type, user.username),
        getUserLogsFn(user.username, {
          mediaId,
          type,
          limit: 0,
          page: 1,
        }),
      ]);

      const logsArray = Array.isArray(userLogs) ? userLogs : [];
      const subDecks = mediaData?.jiten?.subDecks;
      const currentDeck = getDeckForVolume(subDecks, submittedVolume);
      const currentVolumeCharCount = currentDeck?.characterCount ?? 0;

      if (currentVolumeCharCount <= 0) return submittedVolume;

      const currentVolumeCharsRead = logsArray
        .filter((log) => log.volume === submittedVolume)
        .reduce((acc, log) => acc + (log.chars ?? 0), 0);

      if (currentVolumeCharsRead < currentVolumeCharCount) {
        return submittedVolume;
      }

      const totalVolumes =
        mediaData?.volumes ?? mediaData?.jiten?.subDecks?.length ?? 0;
      const canAdvance = totalVolumes > 0 && submittedVolume < totalVolumes;
      return canAdvance ? submittedVolume + 1 : submittedVolume;
    } catch {
      return submittedVolume;
    }
  };
  // ── Playlist helpers ────────────────────────────────────────────────────────
  // queryClient is declared here so handlePlaylistConfirm can reference it
  const queryClient = useQueryClient();

  const detectPlaylistUrl = useCallback((value: string): string | null => {
    try {
      const parsed = new URL(
        value.startsWith('http://') || value.startsWith('https://')
          ? value
          : `https://${value}`
      );
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const isYouTubeHost = host.endsWith('youtube.com') || host === 'youtu.be';
      if (!isYouTubeHost) return null;
      const list = parsed.searchParams.get('list');
      if (list && list.length > 2) return value; // return original URL
    } catch {
      /* not a URL */
    }
    return null;
  }, []);

  const handlePlaylistPaste = useCallback(
    async (url: string) => {
      setPlaylistResult(null);
      setPlaylistModalOpen(true);
      setIsFetchingPlaylist(true);
      try {
        const result = await searchYouTubePlaylistFn(url);
        setPlaylistResult(result);
      } catch (err) {
        toast.error(
          err instanceof AxiosError
            ? (err.response?.data?.message ?? t('toast.playlistLoadFailed'))
            : t('toast.playlistLoadFailed')
        );
        setPlaylistModalOpen(false);
      } finally {
        setIsFetchingPlaylist(false);
      }
    },
    [t]
  );

  const handlePlaylistConfirm = useCallback(
    async (selected: PlaylistVideoWithOverride[]) => {
      if (!selected.length) return;
      setIsBatchLogging(true);
      setBatchProgress({ current: 0, total: selected.length });
      const playlistBatchId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const playlistBatchTitle =
        playlistResult?.playlistTitle ?? 'YouTube playlist';

      let loggedCount = 0;
      for (const { playlistVideo, override } of selected) {
        const { video, channel } = playlistVideo;
        const totalMinutes = override.durationMinutes;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        try {
          await createLogFn({
            type: 'video',
            description: override.description || video.title.contentTitleNative,
            playlistBatchId,
            playlistBatchTitle,
            mediaId: channel.contentId,
            mediaData: {
              contentId: channel.contentId,
              contentTitleNative: channel.title.contentTitleNative,
              contentTitleEnglish:
                channel.title.contentTitleEnglish ??
                channel.title.contentTitleNative,
              contentImage: channel.contentImage ?? null,
              coverImage: channel.contentImage ?? null,
              description: undefined,
              isAdult: false,
            },
            time: hours * 60 + minutes || undefined,
            date: override.unknownDate ? undefined : override.date,
            unknownDate: override.unknownDate,
            private: false,
            isAdult: false,
          } as ICreateLog);
          loggedCount++;
        } catch (err) {
          console.error(
            'Playlist batch log error for video',
            video.contentId,
            err
          );
        }

        setBatchProgress((prev) =>
          prev ? { ...prev, current: prev.current + 1 } : null
        );
      }

      setIsBatchLogging(false);
      setBatchProgress(null);
      setPlaylistModalOpen(false);
      setPlaylistResult(null);

      void queryClient.invalidateQueries({
        predicate: (q) =>
          ['logs', user?.username, 'user', 'recentLogs', 'dailyGoals'].includes(
            q.queryKey[0] as string
          ),
      });
      void queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
      invalidateLogScreenQueries(queryClient, 'video', user?.username);

      toast.success(
        t('toast.playlistLogged', {
          count: selected.length,
          logged: loggedCount,
        })
      );
    },
    [queryClient, user?.username, playlistResult?.playlistTitle, t]
  );

  // ── End playlist helpers ────────────────────────────────────────────────────

  const {
    data: searchResult,
    error: searchError,
    isLoading: isSearching,
  } = useSearch(
    logData.type ?? '', // Always pass the type
    logData.mediaName, // Always pass the search term
    undefined,
    1,
    5
  );
  const { mutate: createLog, isPending: isLogCreating } = useMutation({
    mutationFn: createLogFn,
    onSuccess: async () => {
      const pendingVolume = pendingVolumeRef.current;
      if (
        pendingVolume?.mediaId &&
        pendingVolume?.volume &&
        pendingVolume.volume > 0 &&
        (pendingVolume.type === 'manga' || pendingVolume.type === 'light-novel')
      ) {
        const nextRememberedVolume = await resolveNextRememberedVolume(
          pendingVolume.type,
          pendingVolume.mediaId,
          pendingVolume.volume
        );

        writeLastLoggedVolume(
          pendingVolume.type,
          pendingVolume.mediaId,
          nextRememberedVolume
        );
      }
      pendingVolumeRef.current = null;

      const currentType = logData.type;
      setLogData({
        type: currentType,
        titleNative: '',
        titleRomaji: '',
        titleEnglish: '',
        description: '',
        mediaDescription: [
          {
            description: '',
            language: 'eng',
          },
        ],
        mediaName: '',
        mediaId: '',
        episodes: 0,
        duration: 0,
        customDuration: undefined,
        synonyms: [],
        isAdult: false,
        watchedEpisodes: 0,
        time: 0,
        chars: 0,
        readChars: 0,
        logVolume: undefined,
        pages: 0,
        readPages: 0,
        chapters: undefined,
        volumes: undefined,
        hours: 0,
        minutes: 0,
        showTime: false,
        showChars: false,
        img: undefined,
        cover: undefined,
        unknownDate: false,
        date: undefined,
        youtubeChannelInfo: null,
      });
      setSelectedTags([]);
      setTouched({});
      void queryClient.invalidateQueries({
        predicate: (query) =>
          ['logs', user?.username, 'user', 'recentLogs'].includes(
            query.queryKey[0] as string
          ),
      });
      void queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
      invalidateLogScreenQueries(queryClient, currentType, user?.username);

      // Refresh the stored user so the rest of the UI (header, profile)
      // reflects the new stats. The celebration overlay itself is driven
      // globally from the createLog response (see LogCelebrationHost).
      if (user?.username) {
        try {
          const updatedUser = await getUserFn(user.username);

          const loginResponse: ILoginResponse = {
            _id: updatedUser._id || user._id,
            username: updatedUser.username || user.username,
            email: updatedUser.email ?? user.email,
            verified: updatedUser.verified ?? user.verified,
            stats: updatedUser.stats || user.stats,
            avatar: updatedUser.avatar ?? user.avatar,
            banner: updatedUser.banner ?? user.banner,
            titles: updatedUser.titles || user.titles,
            roles: updatedUser.roles || user.roles,
            discordId: updatedUser.discordId ?? '',
            patreon: updatedUser.patreon ?? user.patreon,
            settings: updatedUser.settings ?? user.settings,
            about: updatedUser.about ?? user.about,
          };
          setUser(loginResponse);
        } catch (e) {
          console.error('Error fetching user data:', e);
        }
      }
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data.message
          : tCommon('errors.generic');
      toast.error(errorMessage);
    },
  });

  // Real-time validation with touched state
  useEffect(() => {
    const validation = validateLogData(
      {
        type: logData.type,
        mediaName: logData.mediaName,
        watchedEpisodes: logData.watchedEpisodes,
        hours: logData.hours,
        minutes: logData.minutes,
        readChars: logData.readChars,
        readPages: logData.readPages,
      },
      touched
    );

    setErrors(validation.errors);
    setIsFormValid(
      validation.isValid && !!logData.type && !!logData.mediaName.trim()
    );
  }, [logData, touched]);

  const handleInputChange = (
    field: keyof typeof logData,
    value:
      | string
      | number
      | null
      | Date
      | boolean
      | string[]
      | undefined
      | youtubeChannelInfo
      | IMediaDocument['description']
  ) => {
    setLogData((prev) => ({ ...prev, [field]: value }));
  };

  function preventNegativeValues(e: React.InputEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    if (input.valueAsNumber < 0) input.value = '0';
  }

  // Enhanced field change handler with proper types
  const handleFieldChange = (
    field: keyof logDataType,
    value: string | number | boolean | Date | null | undefined
  ) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    handleInputChange(field, value);
  };

  const handleSuggestionClick = (
    group: IMediaDocument & { __youtubeChannelInfo?: youtubeChannelInfo }
  ) => {
    // Handle YouTube video selection
    if (logData.type === 'video' && group.__youtubeChannelInfo) {
      // Set video title as media name/description
      handleInputChange('mediaName', group.title.contentTitleNative);
      handleInputChange('description', group.title.contentTitleNative);
      handleInputChange('titleNative', group.title.contentTitleNative);
      handleInputChange('titleEnglish', group.title.contentTitleEnglish);

      // Use channel ID as the mediaId (for grouping videos by channel)
      handleInputChange('mediaId', group.__youtubeChannelInfo.channelId);
      handleInputChange('img', group.contentImage);
      handleInputChange('cover', group.__youtubeChannelInfo.channelImage);

      // Store channel info for media creation
      handleInputChange('youtubeChannelInfo', {
        channelId: group.__youtubeChannelInfo.channelId,
        channelTitle: group.__youtubeChannelInfo.channelTitle,
        channelImage: group.__youtubeChannelInfo.channelImage,
        channelDescription: group.__youtubeChannelInfo.channelDescription,
      });

      // Auto-fill duration if available
      if (group.episodeDuration) {
        const totalMinutes = group.episodeDuration;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        handleInputChange('hours', hours);
        handleInputChange('minutes', minutes);
      }

      handleInputChange('logVolume', undefined);
    } else {
      // Handle regular AniList content
      handleInputChange('mediaName', group.title.contentTitleNative);
      handleInputChange('titleNative', group.title.contentTitleNative);
      handleInputChange('titleRomaji', group.title.contentTitleRomaji ?? '');
      handleInputChange('titleEnglish', group.title.contentTitleEnglish ?? '');
      handleInputChange('mediaId', group.contentId);
      handleInputChange('img', group.contentImage);
      handleInputChange('cover', group.coverImage);
      handleInputChange('description', group.title.contentTitleNative);
      handleInputChange('isAdult', group.isAdult);
      handleInputChange('isAdultImage', group.isAdultImage ?? false);
      handleInputChange(
        'mediaDescription',
        group.description
          ? group.description
          : [{ description: '', language: 'eng' }]
      );

      // For anime and series, store additional episode information
      if (logData.type === 'anime' || logData.type === 'tv show') {
        if (group.episodes) {
          handleInputChange('episodes', group.episodes);
        }
        if (group.episodeDuration) {
          handleInputChange('duration', group.episodeDuration ?? undefined);
        }
        // Reset custom duration when selecting new media
        handleInputChange('customDuration', undefined);
      }

      // For manga, store chapter/volume information
      if (logData.type === 'manga' || logData.type === 'light-novel') {
        if (group.chapters) {
          handleInputChange('chapters', group.chapters);
        }
        if (group.volumes) {
          handleInputChange('volumes', group.volumes);
        }

        if (group.contentId) {
          handleInputChange(
            'logVolume',
            readLastLoggedVolume(logData.type, group.contentId)
          );
        }
      } else {
        handleInputChange('logVolume', undefined);
      }

      // For books, store Google Books metadata (page count, authors, date)
      if (logData.type === 'book') {
        handleInputChange('pageCount', group.pageCount);
        handleInputChange('authors', group.authors);
        handleInputChange('publishedDate', group.publishedDate);
      }

      // For movies, auto-populate time from runtime
      if (logData.type === 'movie' && group.runtime) {
        const totalMinutes = group.runtime;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        handleInputChange('hours', hours);
        handleInputChange('minutes', minutes);
      }
    }

    setIsSuggestionsOpen(false);
  };

  const logSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Mark all relevant fields as touched for final validation
    const allTouched = {
      type: true,
      mediaName: true,
      episodes: ['anime', 'tv show'].includes(logData.type ?? ''),
      hours: true,
      minutes: true,
      chars: true,
      pages: true,
    };
    setTouched(allTouched);

    const validation = validateLogData(
      {
        type: logData.type,
        mediaName: logData.mediaName,
        watchedEpisodes: logData.watchedEpisodes,
        hours: logData.hours,
        minutes: logData.minutes,
        readChars: logData.readChars,
        readPages: logData.readPages,
      },
      allTouched
    );

    setErrors(validation.errors);

    if (!validation.isValid) {
      toast.error(t('toast.fixValidationAll'));
      return;
    }

    const totalMinutes = logData.hours * 60 + logData.minutes;

    // Prepare media data based on log type
    let mediaData = undefined;

    if (logData.type !== 'video' && logData.type !== 'audio') {
      // Regular AniList content
      mediaData = {
        contentId: logData.mediaId,
        contentTitleNative: logData.titleNative,
        contentTitleRomaji: logData.titleRomaji,
        contentTitleEnglish: logData.titleEnglish,
        contentImage: logData.img,
        coverImage: logData.cover,
        description: logData.mediaDescription,
        episodes: logData.episodes,
        episodeDuration: logData.duration,
        chapters: logData.chapters,
        volumes: logData.volumes,
        pageCount: logData.pageCount,
        authors: logData.authors,
        publishedDate: logData.publishedDate,
        isAdult: logData.isAdult,
        synonyms: logData.synonyms,
      };
    }

    pendingVolumeRef.current = {
      type: logData.type,
      mediaId: logData.mediaId,
      volume:
        (logData.type === 'manga' || logData.type === 'light-novel') &&
        typeof logData.logVolume === 'number' &&
        logData.logVolume > 0
          ? logData.logVolume
          : undefined,
    };

    createLog({
      type: logData.type,
      mediaId: logData.mediaId,
      description: logData.description || logData.mediaName,
      mediaData,
      episodes: logData.watchedEpisodes,
      volume:
        (logData.type === 'manga' || logData.type === 'light-novel') &&
        typeof logData.logVolume === 'number' &&
        logData.logVolume > 0
          ? logData.logVolume
          : undefined,
      time: totalMinutes || undefined,
      chars: logData.readChars || undefined,
      pages: logData.readPages || undefined,
      date: logData.unknownDate ? undefined : logData.date,
      unknownDate: logData.unknownDate,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    } as ICreateLog);
  };

  useEffect(() => {
    if (searchError)
      toast.error(t('toast.searchError', { message: searchError.message }));
  }, [searchError, t]);

  const logTypeOptions = LOG_TYPE_OPTIONS.map(({ value, labelKey }) => ({
    value,
    label: tCommon(labelKey),
  }));

  const isSeriesType = logData.type === 'anime' || logData.type === 'tv show';

  const showEpisodesInMain = isSeriesType;
  const showTimeInMain = [
    'vn',
    'game',
    'video',
    'light-novel',
    'reading',
    'audio',
    'manga',
    'movie',
    'book',
  ].includes(logData.type ?? '');
  const showCharsInMain = [
    'vn',
    'game',
    'light-novel',
    'reading',
    'manga',
    'book',
  ].includes(logData.type ?? '');
  const showPagesInMain = logData.type === 'manga' || logData.type === 'book';

  const autoCalculatedTime = (() => {
    if (!isSeriesType) return null;
    const durationPerEpisode =
      logData.customDuration && logData.customDuration > 0
        ? logData.customDuration
        : logData.duration && logData.duration > 0
          ? logData.duration
          : null;
    if (!durationPerEpisode || !logData.watchedEpisodes) return null;
    const totalMinutes = logData.watchedEpisodes * durationPerEpisode;
    return {
      totalMinutes,
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  })();

  useEffect(() => {
    if (!autoCalculatedTime) return;
    setLogData((prev) => {
      if (
        prev.hours === autoCalculatedTime.hours &&
        prev.minutes === autoCalculatedTime.minutes
      ) {
        return prev;
      }
      return {
        ...prev,
        hours: autoCalculatedTime.hours,
        minutes: autoCalculatedTime.minutes,
      };
    });
  }, [autoCalculatedTime]);

  return (
    <>
      <div className="pt-28 pb-16 px-4 flex justify-center items-start bg-base-200 min-h-screen">
        <div className="w-full max-w-6xl">
          <form onSubmit={logSubmit} className="space-y-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-2">{t('create.title')}</h1>
              <p className="text-base-content/70">{t('create.subtitle')}</p>
            </div>

            {/* Log Type Selection */}
            <div className="card surface">
              <div className="card-body">
                <h2 className="card-title">{t('create.stepType')}</h2>
                <div
                  className={`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 md:gap-4 p-2 rounded-lg ${
                    errors.type ? 'border-2 border-error' : ''
                  }`}
                >
                  {logTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`btn btn-lg h-auto py-4 flex-col gap-2 transition-all duration-200 ${
                        logData.type === option.value
                          ? 'btn-primary scale-105'
                          : 'btn-outline'
                      }`}
                      onClick={() => {
                        const newType = option.value as ILog['type'];
                        setLogData(createInitialLogState(newType));
                        setSelectedTags([]);
                        setTouched({});
                        setErrors({});
                        setIsFormValid(false);
                        setIsSuggestionsOpen(false);
                        setIsAdvancedOptions(false);
                      }}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
                {errors.type && (
                  <div className="text-error text-sm mt-2 flex items-center gap-1">
                    <CircleX /> {vt(errors.type)}
                  </div>
                )}
              </div>
            </div>

            {logData.type && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Left Column: Form Inputs */}
                <div className="lg:col-span-3 space-y-6">
                  <div className="card surface">
                    <div className="card-body">
                      <h2 className="card-title">{t('create.stepDetails')}</h2>
                      {/* Media Name Input */}
                      <Field
                        label={
                          logData.type === 'video'
                            ? t('create.videoUrlLabel')
                            : t('create.mediaName')
                        }
                      >
                        <div className="relative">
                          <input
                            type="text"
                            placeholder={
                              logData.type === 'video'
                                ? t('create.videoPlaceholder')
                                : t('create.mediaPlaceholder')
                            }
                            className={`input w-full pr-10 ${
                              errors.mediaName
                                ? 'input-error'
                                : touched.mediaName &&
                                    logData.mediaName &&
                                    !errors.mediaName
                                  ? 'input-success'
                                  : ''
                            }`}
                            onFocus={() => setIsSuggestionsOpen(true)}
                            onBlur={() => {
                              setTimeout(
                                () => setIsSuggestionsOpen(false),
                                200
                              );
                            }}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (
                                logData.type === 'video' &&
                                detectPlaylistUrl(value)
                              ) {
                                void handlePlaylistPaste(value);
                                // Don't populate the field — keep it clean
                                return;
                              }
                              handleFieldChange('mediaName', value);
                            }}
                            value={logData.mediaName}
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-base-content/50">
                            {isSearching ? (
                              <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                              <Search className="w-6 h-6" />
                            )}
                          </div>
                        </div>
                        {errors.mediaName && (
                          <label className="label">
                            <span className="text-error flex items-center gap-1">
                              <CircleX /> {vt(errors.mediaName)}
                            </span>
                          </label>
                        )}
                        {/* Search Suggestions */}
                        <div ref={suggestionRef} className="relative">
                          {isSuggestionsOpen &&
                            searchResult &&
                            searchResult.length > 0 && (
                              <ul className="menu menu-vertical flex-nowrap surface-raised w-full mt-1 absolute z-50 overflow-y-auto overflow-x-hidden max-h-64">
                                {searchResult.map((group, i) => {
                                  const isYouTubeResult = (
                                    group as IMediaDocument & {
                                      __youtubeChannelInfo: youtubeChannelInfo;
                                    }
                                  ).__youtubeChannelInfo;

                                  return (
                                    <li
                                      key={i}
                                      onClick={() =>
                                        handleSuggestionClick(
                                          group as IMediaDocument & {
                                            __youtubeChannelInfo: youtubeChannelInfo;
                                          }
                                        )
                                      }
                                      className="w-full"
                                    >
                                      <a className="flex flex-nowrap items-center gap-3 w-full min-w-0 whitespace-normal p-3">
                                        {group.contentImage && (
                                          <div className="avatar flex-shrink-0">
                                            <div
                                              className={`${isYouTubeResult ? 'w-16 h-12' : 'w-12 h-12'} rounded-lg`}
                                            >
                                              <img
                                                src={group.contentImage}
                                                alt={
                                                  group.title.contentTitleNative
                                                }
                                                className="object-cover w-full h-full"
                                              />
                                            </div>
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="font-semibold text-sm truncate">
                                            {group.title.contentTitleNative}
                                          </div>
                                          {isYouTubeResult ? (
                                            <>
                                              <div className="text-xs opacity-70 truncate">
                                                Channel:{' '}
                                                {
                                                  (
                                                    group as IMediaDocument & {
                                                      __youtubeChannelInfo: youtubeChannelInfo;
                                                    }
                                                  ).__youtubeChannelInfo
                                                    .channelTitle
                                                }
                                              </div>
                                              {group.episodeDuration && (
                                                <div className="text-xs opacity-70">
                                                  Duration:{' '}
                                                  {group.episodeDuration}{' '}
                                                  minutes
                                                </div>
                                              )}
                                            </>
                                          ) : (
                                            <div className="text-xs opacity-70 truncate">
                                              {group.title.contentTitleRomaji ||
                                                group.title.contentTitleEnglish}
                                            </div>
                                          )}
                                        </div>
                                        {isYouTubeResult && (
                                          <div className="flex items-center">
                                            <span className="badge badge-primary badge-xs">
                                              YouTube
                                            </span>
                                          </div>
                                        )}
                                      </a>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          {isSuggestionsOpen && isSearching && (
                            <div className="alert mt-1">
                              <span className="loading loading-spinner loading-sm"></span>
                              <span>
                                {logData.type === 'video'
                                  ? t('create.searchingYoutube')
                                  : t('create.searching')}
                              </span>
                            </div>
                          )}
                          {isSuggestionsOpen &&
                            !isSearching &&
                            searchResult?.length === 0 &&
                            logData.mediaName && (
                              <div className="alert alert-info mt-1">
                                <Info />
                                <span>
                                  {logData.type === 'video'
                                    ? t('create.noYoutubeResults')
                                    : t('create.noResults')}
                                </span>
                              </div>
                            )}
                        </div>
                      </Field>

                      {/* Dynamic Inputs based on Log Type */}
                      <div className="space-y-4">
                        {isSeriesType && (
                          <Field
                            label={t('create.episodesWatched')}
                            aside={
                              logData.customDuration ? (
                                <span className="text-warning">
                                  {t('create.episodeDurationBadge', {
                                    minutes: logData.customDuration,
                                  })}
                                </span>
                              ) : null
                            }
                          >
                            <input
                              type="number"
                              min="1"
                              max="1000"
                              onInput={preventNegativeValues}
                              placeholder={t('create.episodesPlaceholder')}
                              className={`input w-full ${
                                errors.episodes
                                  ? 'input-error'
                                  : touched.episodes &&
                                      logData.watchedEpisodes > 0 &&
                                      !errors.episodes
                                    ? 'input-success'
                                    : ''
                              }`}
                              onChange={(e) => {
                                const episodes = Number(e.target.value);
                                handleFieldChange('watchedEpisodes', episodes);
                                const effectiveDuration =
                                  logData.customDuration || logData.duration;
                                if (effectiveDuration && episodes > 0) {
                                  const totalMinutes =
                                    episodes * effectiveDuration;
                                  const hours = Math.floor(totalMinutes / 60);
                                  const minutes = totalMinutes % 60;
                                  handleFieldChange('hours', hours);
                                  handleFieldChange('minutes', minutes);
                                } else if (episodes === 0) {
                                  handleFieldChange('hours', 0);
                                  handleFieldChange('minutes', 0);
                                }
                              }}
                              value={logData.watchedEpisodes || ''}
                            />
                            {errors.episodes && (
                              <label className="label">
                                <span className="text-error flex items-center gap-1">
                                  <CircleX /> {vt(errors.episodes)}
                                </span>
                              </label>
                            )}
                            {autoCalculatedTime ? (
                              <div className="alert alert-success mt-2">
                                <CircleCheck />
                                <span>
                                  {t('create.autoCalculatedTime', {
                                    hours: autoCalculatedTime.hours,
                                    minutes: autoCalculatedTime.minutes,
                                    episodes: logData.watchedEpisodes,
                                    duration:
                                      logData.customDuration ||
                                      logData.duration,
                                  })}
                                </span>
                              </div>
                            ) : null}
                            {logData.episodes > 0 && (
                              <div className="alert alert-info mt-2">
                                <Info />
                                <span>
                                  {t('create.totalEpisodes', {
                                    total: logData.episodes,
                                  })}
                                </span>
                              </div>
                            )}
                          </Field>
                        )}

                        {logData.type === 'tv show' && !logData.duration && (
                          <Field
                            label={t('create.episodeDuration')}
                            aside={t('create.durationHint')}
                          >
                            <input
                              type="number"
                              min="1"
                              max="300"
                              placeholder={t('create.durationPlaceholder')}
                              className="input w-full"
                              onChange={(e) => {
                                const customDuration = Number(e.target.value);
                                handleFieldChange(
                                  'customDuration',
                                  customDuration
                                );
                                if (logData.watchedEpisodes > 0) {
                                  const totalMinutes =
                                    logData.watchedEpisodes * customDuration;
                                  const hours = Math.floor(totalMinutes / 60);
                                  const minutes = totalMinutes % 60;
                                  handleFieldChange('hours', hours);
                                  handleFieldChange('minutes', minutes);
                                }
                              }}
                              value={logData.customDuration || ''}
                            />
                          </Field>
                        )}

                        {showTimeInMain && (
                          <Field
                            label={t('create.timeSpent')}
                            aside={
                              ['video', 'audio', 'movie'].includes(
                                logData.type || ''
                              ) && (
                                <span className="text-warning">
                                  {t('create.required')}
                                </span>
                              )
                            }
                          >
                            <div className="flex gap-2">
                              <div className="w-1/2">
                                <input
                                  type="number"
                                  min="0"
                                  max="24"
                                  placeholder={t('create.hoursPlaceholder')}
                                  className={`input w-full ${
                                    errors.hours || errors.time
                                      ? 'input-error'
                                      : ''
                                  }`}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      'hours',
                                      Number(e.target.value)
                                    )
                                  }
                                  value={logData.hours || ''}
                                  onInput={preventNegativeValues}
                                />
                              </div>
                              <div className="w-1/2">
                                <input
                                  type="number"
                                  min="0"
                                  max="1440"
                                  placeholder={t('create.minutesPlaceholder')}
                                  className={`input w-full ${
                                    errors.minutes || errors.time
                                      ? 'input-error'
                                      : ''
                                  }`}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      'minutes',
                                      Number(e.target.value)
                                    )
                                  }
                                  value={logData.minutes || ''}
                                  onInput={preventNegativeValues}
                                />
                              </div>
                            </div>
                            {(errors.time ||
                              errors.hours ||
                              errors.minutes) && (
                              <label className="label">
                                <span className="text-error flex items-center gap-1">
                                  <CircleX />
                                  {errors.time ||
                                    errors.hours ||
                                    errors.minutes}
                                </span>
                              </label>
                            )}
                          </Field>
                        )}

                        {showCharsInMain && (
                          <Field label={t('create.charsRead')}>
                            <input
                              type="number"
                              min="0"
                              max="1000000"
                              onInput={preventNegativeValues}
                              placeholder={t('create.charsPlaceholder')}
                              className={`input w-full ${
                                errors.chars
                                  ? 'input-error'
                                  : touched.chars && logData.readChars > 0
                                    ? 'input-success'
                                    : ''
                              }`}
                              onChange={(e) =>
                                handleFieldChange(
                                  'readChars',
                                  Number(e.target.value)
                                )
                              }
                              value={logData.readChars || ''}
                            />
                            {errors.chars && (
                              <label className="label">
                                <span className="text-error flex items-center gap-1">
                                  <CircleX /> {vt(errors.chars)}
                                </span>
                              </label>
                            )}
                          </Field>
                        )}

                        {(logData.type === 'manga' ||
                          logData.type === 'light-novel') && (
                          <Field label={t('create.volume')}>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max={logData.volumes}
                                placeholder="1"
                                className="input input-sm w-12 px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                onInput={preventNegativeValues}
                                onChange={(e) => {
                                  if (e.target.value === '') {
                                    handleFieldChange('logVolume', undefined);
                                    return;
                                  }

                                  const parsed = Number(e.target.value);
                                  handleFieldChange(
                                    'logVolume',
                                    Number.isFinite(parsed) && parsed > 0
                                      ? parsed
                                      : undefined
                                  );
                                }}
                                value={logData.logVolume ?? ''}
                              />
                              <span className="text-base-content/70 font-medium">
                                /{logData.volumes ?? '?'}
                              </span>
                            </div>
                          </Field>
                        )}

                        {showPagesInMain && (
                          <Field label={t('create.pagesRead')}>
                            <input
                              type="number"
                              min="0"
                              max="10000"
                              onInput={preventNegativeValues}
                              placeholder={t('create.pagesPlaceholder')}
                              className={`input w-full ${
                                errors.pages
                                  ? 'input-error'
                                  : touched.pages && logData.readPages > 0
                                    ? 'input-success'
                                    : ''
                              }`}
                              onChange={(e) =>
                                handleFieldChange(
                                  'readPages',
                                  Number(e.target.value)
                                )
                              }
                              value={logData.readPages || ''}
                            />
                            {errors.pages && (
                              <label className="label">
                                <span className="text-error flex items-center gap-1">
                                  <CircleX /> {vt(errors.pages)}
                                </span>
                              </label>
                            )}
                          </Field>
                        )}
                      </div>

                      {/* Advanced Options */}
                      <div className="collapse collapse-arrow surface-muted overflow-visible">
                        <input
                          type="checkbox"
                          checked={isAdvancedOptions}
                          onChange={() =>
                            setIsAdvancedOptions(!isAdvancedOptions)
                          }
                        />
                        <div className="collapse-title font-medium">
                          {t('create.advancedOptions')}
                        </div>
                        <div className="collapse-content space-y-4">
                          {isAdvancedOptions && isSeriesType && (
                            <Field label={t('create.episodeDuration')}>
                              <input
                                type="number"
                                min="1"
                                max="300"
                                placeholder={
                                  logData.duration
                                    ? `${logData.duration}`
                                    : t('create.episodeDurationPlaceholder')
                                }
                                className="input input-sm"
                                onChange={(e) => {
                                  const customDuration = Number(e.target.value);
                                  handleFieldChange(
                                    'customDuration',
                                    customDuration
                                  );
                                  if (logData.watchedEpisodes > 0) {
                                    const totalMinutes =
                                      logData.watchedEpisodes * customDuration;
                                    const hours = Math.floor(totalMinutes / 60);
                                    const minutes = totalMinutes % 60;
                                    handleFieldChange('hours', hours);
                                    handleFieldChange('minutes', minutes);
                                  }
                                }}
                                value={logData.customDuration || ''}
                              />
                              {logData.duration ? (
                                <p className="label flex flex-col items-start gap-1">
                                  {t('create.defaultDuration', {
                                    minutes: logData.duration,
                                  })}
                                </p>
                              ) : null}
                            </Field>
                          )}
                          {!showEpisodesInMain && (
                            <Field label={t('create.episodesWatchedOptional')}>
                              <input
                                type="number"
                                min="0"
                                onInput={preventNegativeValues}
                                className="input"
                                value={logData.watchedEpisodes || ''}
                                onChange={(e) =>
                                  handleFieldChange(
                                    'watchedEpisodes',
                                    Number(e.target.value)
                                  )
                                }
                              />
                            </Field>
                          )}
                          {!showTimeInMain && (
                            <Field label={t('create.timeSpentOptional')}>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  className="input w-1/2"
                                  placeholder={t('create.hoursPlaceholder')}
                                  value={logData.hours || ''}
                                  onInput={preventNegativeValues}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      'hours',
                                      Number(e.target.value)
                                    )
                                  }
                                />
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  className="input w-1/2"
                                  placeholder={t('create.minutesPlaceholder')}
                                  value={logData.minutes || ''}
                                  onInput={preventNegativeValues}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      'minutes',
                                      Number(e.target.value)
                                    )
                                  }
                                />
                              </div>
                            </Field>
                          )}
                          {!showCharsInMain && (
                            <Field label={t('create.charsReadOptional')}>
                              <input
                                type="number"
                                min="0"
                                className="input"
                                value={logData.readChars || ''}
                                onInput={preventNegativeValues}
                                onChange={(e) =>
                                  handleFieldChange(
                                    'readChars',
                                    Number(e.target.value)
                                  )
                                }
                              />
                            </Field>
                          )}
                          {!showPagesInMain && (
                            <Field label={t('create.pagesReadOptional')}>
                              <input
                                type="number"
                                min="0"
                                className="input"
                                value={logData.readPages || ''}
                                onInput={preventNegativeValues}
                                onChange={(e) =>
                                  handleFieldChange(
                                    'readPages',
                                    Number(e.target.value)
                                  )
                                }
                              />
                            </Field>
                          )}
                          <div>
                            <label className="label cursor-pointer justify-start gap-3">
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={logData.unknownDate}
                                onChange={(e) => {
                                  const isUnknownDate = e.target.checked;
                                  handleInputChange(
                                    'unknownDate',
                                    isUnknownDate
                                  );
                                  if (isUnknownDate) {
                                    handleInputChange('date', undefined);
                                  }
                                }}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {t('create.unknownDate')}
                                </span>
                                <span className="text-base-content/70">
                                  {t('create.excludedFromRanking')}
                                </span>
                              </div>
                            </label>
                          </div>
                          {!logData.unknownDate && (
                            <Field label={t('create.date')}>
                              <div className="dropdown dropdown-top dropdown-end w-full">
                                <div
                                  tabIndex={0}
                                  role="button"
                                  className="input w-full flex items-center justify-between cursor-pointer"
                                >
                                  <span
                                    className={
                                      logData.date
                                        ? 'text-base-content'
                                        : 'text-base-content/50'
                                    }
                                  >
                                    {logData.date instanceof Date
                                      ? logData.date.toLocaleDateString()
                                      : t('create.datePlaceholder')}
                                  </span>
                                  <Calendar className="w-4 h-4" />
                                </div>
                                <div
                                  tabIndex={0}
                                  className="dropdown-content z-[1000] card card-sm w-72 p-2 surface-raised"
                                >
                                  <DayPicker
                                    className="rdp-themed"
                                    components={{
                                      Chevron: ({
                                        orientation,
                                      }: {
                                        orientation?: string;
                                      }) => {
                                        const iconClass =
                                          'w-4 h-4 text-base-content/60';
                                        if (orientation === 'left')
                                          return (
                                            <ChevronLeft
                                              className={iconClass}
                                            />
                                          );
                                        return (
                                          <ChevronRight className={iconClass} />
                                        );
                                      },
                                    }}
                                    mode="single"
                                    selected={logData.date ?? new Date()}
                                    onSelect={(date) => {
                                      handleInputChange(
                                        'date',
                                        date || undefined
                                      );
                                      (
                                        document.activeElement as HTMLElement
                                      )?.blur?.();
                                    }}
                                    endMonth={new Date()}
                                    disabled={(date) => date > new Date()}
                                  />
                                </div>
                              </div>
                            </Field>
                          )}
                          <Field label={t('create.customDescription')}>
                            <textarea
                              className="textarea w-full"
                              placeholder={t('create.notesPlaceholder')}
                              onChange={(e) =>
                                handleInputChange('description', e.target.value)
                              }
                              value={logData.description}
                            ></textarea>
                          </Field>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Media Preview */}
                <div className="lg:col-span-2">
                  <div className="card surface sticky top-24">
                    <div className="card-body">
                      <h2 className="card-title">{t('create.preview')}</h2>
                      <div className="flex flex-col items-center justify-center min-h-[300px] surface-muted p-4">
                        {logData.img ? (
                          <div className="w-full text-center">
                            <img
                              src={logData.img}
                              alt={t('create.selectedMediaAlt')}
                              className={`max-h-64 mx-auto rounded-lg shadow-lg mb-4 ${
                                (logData.type === 'vn'
                                  ? (logData.isAdultImage ?? false)
                                  : logData.isAdult) &&
                                user?.settings?.blurAdultContent
                                  ? 'blur-sm'
                                  : ''
                              }`}
                            />
                            <h3 className="font-bold text-lg">
                              {logData.mediaName}
                            </h3>
                            {logData.titleRomaji && (
                              <p className="text-sm opacity-70">
                                {logData.titleRomaji}
                              </p>
                            )}
                            {logData.mediaId && logData.type && (
                              <div className="mt-4">
                                <MediaStats
                                  mediaId={logData.mediaId}
                                  mediaType={logData.type}
                                  mediaName={logData.mediaName}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center text-base-content/60">
                            <Info className="w-12 h-12 mx-auto mb-4" />
                            <p>
                              {logData.type
                                ? t('create.previewEmpty')
                                : t('create.previewNoType')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tags Selection */}
            {logData.type && (
              <div className="card surface">
                <div className="card-body">
                  <TagSelector
                    selectedTags={selectedTags}
                    onChange={setSelectedTags}
                    label={t('create.tagsLabel')}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            {logData.type && (
              <div className="card surface">
                <div className="card-body items-center text-center">
                  <h2 className="card-title">{t('create.stepReady')}</h2>
                  <p>{t('create.reviewHint')}</p>
                  <div className="card-actions justify-center mt-4">
                    <button
                      className="btn btn-primary btn-lg w-full"
                      type="submit"
                      disabled={isLogCreating || !isFormValid}
                    >
                      {isLogCreating ? (
                        <span className="loading loading-spinner loading-md"></span>
                      ) : (
                        <CircleCheck className="w-6 h-6" />
                      )}
                      {isLogCreating
                        ? t('create.submitting')
                        : t('create.submit')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* ── Playlist selector modal ──────────────────────────────────── */}
        <PlaylistSelectorModal
          isOpen={playlistModalOpen}
          isFetching={isFetchingPlaylist}
          playlistResult={playlistResult}
          onClose={() => {
            if (!isBatchLogging) {
              setPlaylistModalOpen(false);
              setPlaylistResult(null);
            }
          }}
          onConfirm={handlePlaylistConfirm}
          isSubmitting={isBatchLogging}
        />

        {/* ── Batch-logging progress banner ───────────────────────────── */}
        {isBatchLogging && batchProgress && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] surface-raised border border-base-content/20 px-6 py-4 flex items-center gap-4 min-w-72">
            <span className="loading loading-spinner loading-sm text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {t('create.loggingPlaylist')}
              </p>
              <progress
                className="progress progress-primary w-full mt-1"
                value={batchProgress.current}
                max={batchProgress.total}
              />
              <p className="text-xs text-base-content/60 mt-0.5">
                {batchProgress.current} / {batchProgress.total}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default LogScreen;
