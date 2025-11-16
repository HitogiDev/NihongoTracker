import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ICreateLog,
  ILog,
  ILoginResponse,
  IMediaDocument,
  youtubeChannelInfo,
} from '../types';
import { createLogFn, getUserFn } from '../api/trackerApi';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useSearch from '../hooks/useSearch';
import { DayPicker } from 'react-day-picker';
import { useUserDataStore } from '../store/userData';
import { validateLogData } from '../utils/validation';
import MediaStats from '../components/MediaStats';
import TagSelector from '../components/TagSelector';
import {
  MdCalendarToday,
  MdCheckCircle,
  MdError,
  MdInfo,
  MdSearch,
} from 'react-icons/md';
import XpAnimation from '../components/XpAnimation';
import LevelUpAnimation from '../components/LevelUpAnimation';

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
  watchedEpisodes: number;
  time: number;
  chars: number;
  readChars: number;
  pages: number;
  readPages: number;
  chapters: undefined | number;
  volumes: undefined | number;
  hours: number;
  minutes: number;
  showTime: boolean;
  showChars: boolean;
  img: undefined | string;
  cover: undefined | string;
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
  watchedEpisodes: 0,
  time: 0,
  chars: 0,
  readChars: 0,
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
  date: undefined,
  runtime: undefined,
  youtubeChannelInfo: null,
});

function LogScreen() {
  const [logData, setLogData] = useState<logDataType>(() =>
    createInitialLogState()
  );
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isAdvancedOptions, setIsAdvancedOptions] = useState<boolean>(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isFormValid, setIsFormValid] = useState(false);
  const [initialXp, setInitialXp] = useState(0);
  const [finalXp, setFinalXp] = useState(0);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [initialLevel, setInitialLevel] = useState(0);
  const [finalLevel, setFinalLevel] = useState(0);
  const [showLevelUpAnimation, setShowLevelUpAnimation] = useState(false);
  const [xpToCurrentLevel, setXpToCurrentLevel] = useState(0);
  const [xpToNextLevel, setXpToNextLevel] = useState(1);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const { user, setUser } = useUserDataStore();

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

  const queryClient = useQueryClient();
  const datePickerRef = useRef<HTMLDialogElement>(null);

  const openDatePicker = () => {
    datePickerRef.current?.showModal();
  };

  const { mutate: createLog, isPending: isLogCreating } = useMutation({
    mutationFn: createLogFn,
    onSuccess: async () => {
      if (user?.stats?.userLevel) {
        setInitialLevel(user.stats.userLevel);
      }
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
        date: undefined,
        youtubeChannelInfo: null,
      });
      setSelectedTags([]);
      setTouched({});
      void queryClient.invalidateQueries({
        predicate: (query) =>
          ['logs', user?.username, 'user'].includes(
            query.queryKey[0] as string
          ),
      });
      void queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });

      if (user?.username) {
        try {
          const updatedUser = await getUserFn(user.username);

          if (updatedUser.stats?.userXp) {
            setFinalXp(updatedUser.stats.userXp);
          }
          // cache thresholds for the new level to avoid stale store reads
          if (updatedUser.stats) {
            setXpToCurrentLevel(updatedUser.stats.userXpToCurrentLevel ?? 0);
            setXpToNextLevel(updatedUser.stats.userXpToNextLevel ?? 1);
          }

          // Determine if user leveled up
          const newLevel = updatedUser.stats?.userLevel ?? initialLevel;
          setFinalLevel(newLevel);
          if (newLevel > (user?.stats?.userLevel ?? 0)) {
            setShowLevelUpAnimation(true);
          } else if (updatedUser.stats?.userXp) {
            setShowXpAnimation(true);
          }

          const loginResponse: ILoginResponse = {
            _id: updatedUser._id,
            username: updatedUser.username,
            stats: updatedUser.stats,
            avatar: updatedUser.avatar,
            titles: updatedUser.titles,
            roles: updatedUser.roles,
            discordId: updatedUser.discordId,
            settings: updatedUser.settings,
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
          : 'An error occurred';
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

  const preventNegativeValues = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.valueAsNumber < 0) e.target.value = '0';
  };

  // Enhanced field change handler with proper types
  const handleFieldChange = (
    field: keyof logDataType,
    value: string | number | boolean | Date | null
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
      if (logData.type === 'manga') {
        if (group.chapters) {
          handleInputChange('chapters', group.chapters);
        }
        if (group.volumes) {
          handleInputChange('volumes', group.volumes);
        }
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

  const logSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      toast.error('Please fix all validation errors before submitting');
      return;
    }

    const totalMinutes = logData.hours * 60 + logData.minutes;

    // Prepare media data based on log type
    let mediaData = undefined;

    if (logData.type === 'video' && logData.youtubeChannelInfo) {
      // YouTube video logging
      mediaData = {
        channelId: logData.youtubeChannelInfo.channelId,
        channelTitle: logData.youtubeChannelInfo.channelTitle,
        channelImage: logData.youtubeChannelInfo.channelImage,
        channelDescription: logData.youtubeChannelInfo.channelDescription,
      };
    } else if (logData.type !== 'video' && logData.type !== 'audio') {
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
        isAdult: logData.isAdult,
        synonyms: logData.synonyms,
      };
    }

    // Ensure initial XP baseline is fresh (handles cases after deletions)
    if (user?.username) {
      try {
        const baseline = await getUserFn(user.username);
        if (baseline.stats?.userXp != null) setInitialXp(baseline.stats.userXp);
      } catch (err) {
        // fallback to store if fetch fails; no-op
        if (user?.stats?.userXp != null) setInitialXp(user.stats.userXp);
      }
    }

    createLog({
      type: logData.type,
      mediaId: logData.mediaId,
      description: logData.description || logData.mediaName,
      mediaData,
      episodes: logData.watchedEpisodes,
      time: totalMinutes || undefined,
      chars: logData.readChars || undefined,
      pages: logData.readPages,
      date: logData.date,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    } as ICreateLog);
  };

  useEffect(() => {
    if (searchError) toast.error(`Error: ${searchError.message}`);
  }, [searchError]);

  const logTypeOptions = [
    { value: 'anime', label: 'Anime' },
    { value: 'manga', label: 'Manga' },
    { value: 'vn', label: 'Visual Novel' },
    { value: 'video', label: 'Video' },
    { value: 'tv show', label: 'TV Show' },
    { value: 'movie', label: 'Movie' },
    { value: 'reading', label: 'Reading' },
    { value: 'audio', label: 'Audio' },
  ];

  const isSeriesType = logData.type === 'anime' || logData.type === 'tv show';

  const showEpisodesInMain = isSeriesType;
  const showTimeInMain = [
    'vn',
    'video',
    'reading',
    'audio',
    'manga',
    'movie',
  ].includes(logData.type ?? '');
  const showCharsInMain = ['vn', 'reading', 'manga'].includes(
    logData.type ?? ''
  );
  const showPagesInMain = logData.type === 'manga';

  const autoCalculatedTime = useMemo(() => {
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
  }, [
    isSeriesType,
    logData.customDuration,
    logData.duration,
    logData.watchedEpisodes,
  ]);

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
    <div className="pt-24 pb-16 px-4 flex justify-center items-start bg-base-200 min-h-screen">
      <div className="w-full max-w-6xl">
        <form onSubmit={logSubmit} className="space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">Log Your Immersion</h1>
            <p className="text-base-content/70">
              Track your progress and stay motivated on your language learning
              journey.
            </p>
          </div>

          {/* Log Type Selection */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">1. What did you immerse in today?</h2>
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
                  <MdError /> {errors.type}
                </div>
              )}
            </div>
          </div>

          {logData.type && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Left Column: Form Inputs */}
              <div className="lg:col-span-3 space-y-6">
                <div className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    <h2 className="card-title">2. Fill in the details</h2>
                    {/* Media Name Input */}
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">
                          {logData.type === 'video'
                            ? 'YouTube URL or Video Title'
                            : 'Media Name'}
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={
                            logData.type === 'video'
                              ? 'https://youtube.com/watch?v=... or video title'
                              : 'Search for media...'
                          }
                          className={`input input-bordered w-full pr-10 ${
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
                            setTimeout(() => setIsSuggestionsOpen(false), 200);
                          }}
                          onChange={(e) =>
                            handleFieldChange('mediaName', e.target.value)
                          }
                          value={logData.mediaName}
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-base-content/50">
                          {isSearching ? (
                            <span className="loading loading-spinner loading-sm"></span>
                          ) : (
                            <MdSearch className="w-6 h-6" />
                          )}
                        </div>
                      </div>
                      {errors.mediaName && (
                        <label className="label">
                          <span className="label-text-alt text-error flex items-center gap-1">
                            <MdError /> {errors.mediaName}
                          </span>
                        </label>
                      )}
                      {/* Search Suggestions */}
                      <div ref={suggestionRef} className="relative">
                        {isSuggestionsOpen &&
                          searchResult &&
                          searchResult.length > 0 && (
                            <ul className="menu menu-vertical bg-base-200 rounded-box w-full shadow-lg mt-1 absolute z-50 overflow-y-auto max-h-64">
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
                                    <a className="flex items-center gap-3 w-full whitespace-normal p-3">
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
                                                {group.episodeDuration} minutes
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
                                ? 'Searching YouTube...'
                                : 'Searching...'}
                            </span>
                          </div>
                        )}
                        {isSuggestionsOpen &&
                          !isSearching &&
                          searchResult?.length === 0 &&
                          logData.mediaName && (
                            <div className="alert alert-info mt-1">
                              <MdInfo />
                              <span>
                                {logData.type === 'video'
                                  ? 'No YouTube video found. Make sure you entered a valid YouTube URL.'
                                  : 'No results found. You can still create a log with this name.'}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Dynamic Inputs based on Log Type */}
                    <div className="space-y-4">
                      {isSeriesType && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Episodes Watched
                            </span>
                            {logData.customDuration ? (
                              <span className="label-text-alt text-sm text-warning">
                                Episode Duration: {logData.customDuration} min
                              </span>
                            ) : null}
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            onInput={preventNegativeValues}
                            placeholder="Number of episodes"
                            className={`input input-bordered w-full ${
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
                              <span className="label-text-alt text-error flex items-center gap-1">
                                <MdError /> {errors.episodes}
                              </span>
                            </label>
                          )}
                          {autoCalculatedTime ? (
                            <div className="alert alert-success mt-2">
                              <MdCheckCircle />
                              <span>
                                Auto-calculated time: {autoCalculatedTime.hours}
                                h {autoCalculatedTime.minutes}m (
                                {logData.watchedEpisodes} ×{' '}
                                {logData.customDuration || logData.duration}{' '}
                                min)
                              </span>
                            </div>
                          ) : null}
                          {logData.episodes > 0 && (
                            <div className="alert alert-info mt-2">
                              <MdInfo />
                              <span>Total episodes: {logData.episodes}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {showTimeInMain && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Time Spent
                            </span>
                            {['video', 'audio', 'movie'].includes(
                              logData.type || ''
                            ) && (
                              <span className="label-text-alt text-warning">
                                Required
                              </span>
                            )}
                          </label>
                          <div className="flex gap-2">
                            <div className="form-control w-1/2">
                              <input
                                type="number"
                                min="0"
                                max="24"
                                placeholder="Hours"
                                className={`input input-bordered w-full ${
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
                              <label className="label">
                                <span className="label-text-alt">
                                  Hours (0-24)
                                </span>
                              </label>
                            </div>
                            <div className="form-control w-1/2">
                              <input
                                type="number"
                                min="0"
                                max="59"
                                placeholder="Minutes"
                                className={`input input-bordered w-full ${
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
                              <label className="label">
                                <span className="label-text-alt">
                                  Minutes (0-59)
                                </span>
                              </label>
                            </div>
                          </div>
                          {(errors.time || errors.hours || errors.minutes) && (
                            <label className="label">
                              <span className="label-text-alt text-error flex items-center gap-1">
                                <MdError />
                                {errors.time || errors.hours || errors.minutes}
                              </span>
                            </label>
                          )}
                        </div>
                      )}

                      {showCharsInMain && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Characters Read
                            </span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="1000000"
                            onInput={preventNegativeValues}
                            placeholder="Number of characters"
                            className={`input input-bordered w-full ${
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
                              <span className="label-text-alt text-error flex items-center gap-1">
                                <MdError /> {errors.chars}
                              </span>
                            </label>
                          )}
                        </div>
                      )}

                      {showPagesInMain && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Pages Read
                            </span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="10000"
                            onInput={preventNegativeValues}
                            placeholder="Number of pages"
                            className={`input input-bordered w-full ${
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
                              <span className="label-text-alt text-error flex items-center gap-1">
                                <MdError /> {errors.pages}
                              </span>
                            </label>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Advanced Options */}
                    <div className="collapse collapse-arrow border border-base-300 bg-base-200 rounded-box">
                      <input
                        type="checkbox"
                        checked={isAdvancedOptions}
                        onChange={() =>
                          setIsAdvancedOptions(!isAdvancedOptions)
                        }
                      />
                      <div className="collapse-title font-medium">
                        Advanced Options
                      </div>
                      <div className="collapse-content space-y-4">
                        {isAdvancedOptions && isSeriesType && (
                          <div className="form-control">
                            <label className="label flex flex-col items-start gap-1">
                              <span className="label-text">
                                Episode Duration (minutes)
                              </span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="300"
                              placeholder={
                                logData.duration
                                  ? `${logData.duration}`
                                  : 'Episode duration'
                              }
                              className="input input-bordered input-sm"
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
                                Default: {logData.duration} min
                              </p>
                            ) : null}
                          </div>
                        )}
                        {!showEpisodesInMain && (
                          <div className="form-control">
                            <label className="label flex flex-col items-start gap-1">
                              <span className="label-text">
                                Episodes Watched (optional)
                              </span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              onInput={preventNegativeValues}
                              className="input input-bordered"
                              value={logData.watchedEpisodes || ''}
                              onChange={(e) =>
                                handleFieldChange(
                                  'watchedEpisodes',
                                  Number(e.target.value)
                                )
                              }
                            />
                          </div>
                        )}
                        {!showTimeInMain && (
                          <div className="form-control">
                            <label className="label flex flex-col items-start gap-1">
                              <span className="label-text">
                                Time Spent (optional)
                              </span>
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="0"
                                className="input input-bordered w-1/2"
                                placeholder="Hours"
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
                                className="input input-bordered w-1/2"
                                placeholder="Minutes"
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
                          </div>
                        )}
                        {!showCharsInMain && (
                          <div className="form-control">
                            <label className="label flex flex-col items-start gap-1">
                              <span className="label-text">
                                Characters Read (optional)
                              </span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="input input-bordered"
                              value={logData.readChars || ''}
                              onInput={preventNegativeValues}
                              onChange={(e) =>
                                handleFieldChange(
                                  'readChars',
                                  Number(e.target.value)
                                )
                              }
                            />
                          </div>
                        )}
                        {!showPagesInMain && (
                          <div className="form-control">
                            <label className="label flex flex-col items-start gap-1">
                              <span className="label-text">
                                Pages Read (optional)
                              </span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="input input-bordered"
                              value={logData.readPages || ''}
                              onInput={preventNegativeValues}
                              onChange={(e) =>
                                handleFieldChange(
                                  'readPages',
                                  Number(e.target.value)
                                )
                              }
                            />
                          </div>
                        )}
                        <div className="form-control">
                          <label className="label flex flex-col items-start gap-1">
                            <span className="label-text">Date</span>
                          </label>
                          <button
                            type="button"
                            onClick={openDatePicker}
                            className="btn btn-outline w-full justify-start"
                          >
                            <MdCalendarToday />
                            {logData.date instanceof Date
                              ? logData.date.toLocaleDateString()
                              : 'Select date (defaults to today)'}
                          </button>
                        </div>
                        <div className="form-control">
                          <label className="label flex flex-col items-start gap-1">
                            <span className="label-text">
                              Custom Description (Optional)
                            </span>
                          </label>
                          <textarea
                            className="textarea textarea-bordered w-full"
                            placeholder="Add your own notes about this log"
                            onChange={(e) =>
                              handleInputChange('description', e.target.value)
                            }
                            value={logData.description}
                          ></textarea>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Media Preview */}
              <div className="lg:col-span-2">
                <div className="card bg-base-100 shadow-xl sticky top-24">
                  <div className="card-body">
                    <h2 className="card-title">Preview</h2>
                    <div className="flex flex-col items-center justify-center min-h-[300px] bg-base-200 rounded-lg p-4">
                      {logData.img ? (
                        <div className="w-full text-center">
                          <img
                            src={logData.img}
                            alt="Selected Media"
                            className={`max-h-64 mx-auto rounded-lg shadow-lg mb-4 ${
                              logData.isAdult &&
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
                          <MdInfo className="w-12 h-12 mx-auto mb-4" />
                          <p>
                            {logData.type
                              ? 'Search for media to see a preview'
                              : 'Select a log type to get started'}
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
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <TagSelector
                  selectedTags={selectedTags}
                  onChange={setSelectedTags}
                  label="Tags (Optional)"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          {logData.type && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <h2 className="card-title">3. Ready to log?</h2>
                <p>Review your details above and click the button to save.</p>
                <div className="card-actions justify-center mt-4">
                  <button
                    className={`btn btn-primary btn-lg w-64 ${!isFormValid ? 'btn-disabled' : ''}`}
                    type="submit"
                    disabled={isLogCreating || !isFormValid}
                  >
                    {isLogCreating ? (
                      <span className="loading loading-spinner"></span>
                    ) : (
                      <MdCheckCircle className="w-6 h-6" />
                    )}
                    {isLogCreating ? 'Logging...' : 'Create Log'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Date Picker Modal */}
      <dialog
        ref={datePickerRef}
        className="modal modal-bottom sm:modal-middle"
      >
        <div className="modal-box">
          <DayPicker
            className="react-day-picker mx-auto"
            mode="single"
            selected={logData.date || undefined}
            onSelect={(date) => {
              handleInputChange('date', date || undefined);
              datePickerRef.current?.close();
            }}
            endMonth={new Date()}
            hidden={[{ after: new Date() }]}
          />
          <div className="modal-action">
            <form method="dialog">
              <button className="btn">Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Level Up Animation Overlay */}
      {showLevelUpAnimation && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in"
          onClick={() => setShowLevelUpAnimation(false)}
        >
          <LevelUpAnimation
            initialLevel={initialLevel}
            finalLevel={finalLevel}
            xpCurrentLevel={xpToCurrentLevel}
            xpNextLevel={xpToNextLevel}
            finalXp={finalXp}
          />
        </div>
      )}

      {/* XP Animation Overlay */}
      {showXpAnimation && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in"
          onClick={() => setShowXpAnimation(false)}
        >
          <XpAnimation initialXp={initialXp} finalXp={finalXp} />
        </div>
      )}
    </div>
  );
}

export default LogScreen;
