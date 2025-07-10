import React, { useEffect, useRef, useState } from 'react';
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

interface logDataType {
  type: ILog['type'] | null;
  titleNative: string;
  titleRomaji: string;
  titleEnglish: string;
  description: string;
  mediaDescription: string;
  mediaName: string;
  mediaId: string;
  episodes: number;
  duration: number;
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
  // Movie specific fields
  runtime?: number;
  // YouTube specific fields
  youtubeChannelInfo: youtubeChannelInfo | null;
}

function LogScreen() {
  const [logData, setLogData] = useState<logDataType>({
    type: null,
    titleNative: '',
    titleRomaji: '',
    titleEnglish: '',
    description: '',
    mediaDescription: '',
    mediaName: '',
    mediaId: '',
    episodes: 0,
    duration: 0,
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

  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isAdvancedOptions, setIsAdvancedOptions] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isFormValid, setIsFormValid] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const { user, setUser } = useUserDataStore();

  // Use search hook for all types (it will handle YouTube vs AniList internally)
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
      setLogData({
        type: null,
        titleNative: '',
        titleRomaji: '',
        titleEnglish: '',
        description: '',
        mediaDescription: '',
        mediaName: '',
        mediaId: '',
        episodes: 0,
        duration: 0,
        synonyms: [],
        isAdult: false,
        watchedEpisodes: 0,
        time: 0,
        chars: 0,
        readChars: 0,
        pages: 0,
        readPages: 0,
        chapters: 0,
        volumes: 0,
        hours: 0,
        minutes: 0,
        showTime: false,
        showChars: false,
        img: undefined,
        cover: undefined,
        date: undefined,
        youtubeChannelInfo: null,
      });
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

          const loginResponse: ILoginResponse = {
            _id: updatedUser._id,
            username: updatedUser.username,
            stats: updatedUser.stats,
            avatar: updatedUser.avatar,
            titles: updatedUser.titles,
            roles: updatedUser.roles,
            discordId: updatedUser.discordId,
          };
          setUser(loginResponse);
        } catch (e) {
          console.error('Error fetching user data:', e);
        }
      }
      toast.success('Log created successfully!');
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
    }

    setIsSuggestionsOpen(false);
  };

  const logSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Mark all relevant fields as touched for final validation
    const allTouched = {
      type: true,
      mediaName: true,
      episodes: logData.type === 'anime',
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
    } as ICreateLog);
  };

  useEffect(() => {
    if (searchError) toast.error(`Error: ${searchError.message}`);
  }, [searchError]);

  return (
    <div className="pt-24 pb-16 px-4 flex justify-center items-start bg-base-200 min-h-screen">
      <div className="card w-full max-w-3xl bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-2xl mb-6">Create New Log</h1>

          <form onSubmit={logSubmit} className="space-y-6">
            {/* Log Type Selection with Validation */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Log Type</span>
              </label>
              <select
                className={`select select-bordered w-full ${
                  errors.type
                    ? 'select-error'
                    : touched.type && logData.type
                      ? 'select-success'
                      : ''
                }`}
                onChange={(e) => {
                  handleFieldChange('type', e.target.value as ILog['type']);
                  // Reset YouTube data when changing log type
                  if (e.target.value !== 'video') {
                    handleInputChange('youtubeChannelInfo', null);
                  }
                }}
                value={logData.type || 'Log type'}
              >
                <option disabled value="Log type">
                  Select a log type
                </option>
                <option value="anime">Anime</option>
                <option value="manga">Manga</option>
                <option value="vn">Visual Novel</option>
                <option value="video">Video</option>
                <option value="movie">Movie</option>
                <option value="reading">Reading</option>
                <option value="audio">Audio</option>
              </select>
              {errors.type && (
                <label className="label">
                  <span className="label-text-alt text-error flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {errors.type}
                  </span>
                </label>
              )}
            </div>

            {logData.type && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  {/* Media Name Input with Enhanced Validation */}
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
                        className={`input input-bordered w-full ${
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
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <span className="loading loading-spinner loading-sm"></span>
                        </div>
                      )}
                    </div>
                    {errors.mediaName && (
                      <label className="label">
                        <span className="label-text-alt text-error flex items-center gap-1">
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {errors.mediaName}
                        </span>
                      </label>
                    )}

                    {/* Unified Search Suggestions */}
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
                                          className={`${isYouTubeResult ? 'w-16 h-12' : 'w-8 h-8'} rounded`}
                                        >
                                          <img
                                            src={group.contentImage}
                                            alt={group.title.contentTitleNative}
                                            className="object-cover"
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
                                              Duration: {group.episodeDuration}{' '}
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
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              className="stroke-current shrink-0 w-6 h-6"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span>
                              {logData.type === 'video'
                                ? 'No YouTube video found. Make sure you entered a valid YouTube URL.'
                                : 'No results found. You can still create a log with this name.'}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Episodes Input for Anime */}
                  {logData.type === 'anime' && (
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">
                          Episodes Watched
                        </span>
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
                        onChange={(e) =>
                          handleFieldChange(
                            'watchedEpisodes',
                            Number(e.target.value)
                          )
                        }
                        value={logData.watchedEpisodes || ''}
                      />
                      {errors.episodes && (
                        <label className="label">
                          <span className="label-text-alt text-error flex items-center gap-1">
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {errors.episodes}
                          </span>
                        </label>
                      )}
                      {logData.episodes > 0 && (
                        <label className="label">
                          <span className="label-text-alt text-info">
                            Total episodes: {logData.episodes}
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* Time Spent Input - Outside advanced options for certain types */}
                  {['vn', 'video', 'reading', 'audio', 'manga'].includes(
                    logData.type || ''
                  ) && (
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-medium">
                          Time Spent
                        </span>
                        {['video', 'audio'].includes(logData.type || '') && (
                          <span className="label-text-alt text-warning">
                            Required
                          </span>
                        )}
                      </label>
                      <div className="join">
                        <div className="form-control join-item w-1/2">
                          <input
                            type="number"
                            min="0"
                            max="24"
                            placeholder="Hours"
                            className={`input input-bordered ${
                              errors.hours || errors.time ? 'input-error' : ''
                            }`}
                            onChange={(e) =>
                              handleFieldChange('hours', Number(e.target.value))
                            }
                            value={logData.hours || ''}
                            onInput={preventNegativeValues}
                          />
                          <label className="label">
                            <span className="label-text-alt">Hours (0-24)</span>
                          </label>
                        </div>
                        <div className="form-control join-item w-1/2">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            placeholder="Minutes"
                            className={`input input-bordered ${
                              errors.minutes || errors.time ? 'input-error' : ''
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
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {errors.time || errors.hours || errors.minutes}
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                  {/* Characters Read Input - Outside advanced options for certain types */}
                  {['vn', 'reading', 'manga'].includes(logData.type || '') && (
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
                          handleFieldChange('readChars', Number(e.target.value))
                        }
                        value={logData.readChars || ''}
                      />
                      {errors.chars && (
                        <label className="label">
                          <span className="label-text-alt text-error flex items-center gap-1">
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {errors.chars}
                          </span>
                        </label>
                      )}
                      <label className="label">
                        <span className="label-text-alt">
                          Max: 1,000,000 characters
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Pages Read Input - Outside advanced options for manga */}
                  {logData.type === 'manga' && (
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
                          handleFieldChange('readPages', Number(e.target.value))
                        }
                        value={logData.readPages || ''}
                      />
                      {errors.pages && (
                        <label className="label">
                          <span className="label-text-alt text-error flex items-center gap-1">
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {errors.pages}
                          </span>
                        </label>
                      )}
                      <label className="label">
                        <span className="label-text-alt">
                          Max: 10,000 pages
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Advanced Options Toggle */}
                  <div className="collapse collapse-arrow border border-base-300 bg-base-200 rounded-box">
                    <input
                      type="checkbox"
                      checked={isAdvancedOptions}
                      onChange={() => setIsAdvancedOptions(!isAdvancedOptions)}
                    />
                    <div className="collapse-title font-medium">
                      Advanced Options
                      {Object.keys(errors).some((key) =>
                        [
                          'hours',
                          'minutes',
                          'time',
                          'chars',
                          'pages',
                          'activity',
                        ].includes(key)
                      ) && (
                        <span className="badge badge-error badge-sm ml-2">
                          Has Errors
                        </span>
                      )}
                    </div>
                    <div className="collapse-content space-y-4">
                      {/* Time Spent Input with Enhanced Validation - Only show in advanced if not already shown */}
                      {isAdvancedOptions &&
                        !['vn', 'video', 'reading', 'audio', 'manga'].includes(
                          logData.type || ''
                        ) && (
                          <div className="form-control">
                            <label className="label">
                              <span className="label-text font-medium">
                                Time Spent
                              </span>
                            </label>
                            <div className="join">
                              <div className="form-control join-item w-1/2">
                                <input
                                  type="number"
                                  min="0"
                                  max="24"
                                  placeholder="Hours"
                                  className={`input input-bordered ${
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
                              <div className="form-control join-item w-1/2">
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  placeholder="Minutes"
                                  className={`input input-bordered ${
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
                            {(errors.time ||
                              errors.hours ||
                              errors.minutes) && (
                              <label className="label">
                                <span className="label-text-alt text-error flex items-center gap-1">
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  {errors.time ||
                                    errors.hours ||
                                    errors.minutes}
                                </span>
                              </label>
                            )}
                          </div>
                        )}

                      {/* Characters Read Input with Enhanced Validation - Only show in advanced if not already shown */}
                      {isAdvancedOptions &&
                        !['vn', 'reading', 'manga'].includes(
                          logData.type || ''
                        ) && (
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
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  {errors.chars}
                                </span>
                              </label>
                            )}
                            <label className="label">
                              <span className="label-text-alt">
                                Max: 1,000,000 characters
                              </span>
                            </label>
                          </div>
                        )}

                      {/* Pages Read Input with Enhanced Validation - Only show in advanced if not already shown */}
                      {isAdvancedOptions && logData.type !== 'manga' && (
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
                                <svg
                                  className="w-4 h-4"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                {errors.pages}
                              </span>
                            </label>
                          )}
                          <label className="label">
                            <span className="label-text-alt">
                              Max: 10,000 pages
                            </span>
                          </label>
                        </div>
                      )}

                      {/* Activity validation error message */}
                      {errors.activity && (
                        <div className="alert alert-error">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="stroke-current shrink-0 w-6 h-6"
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
                          <span>{errors.activity}</span>
                        </div>
                      )}

                      {/* Date Picker */}
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Date</span>
                        </label>
                        <div className="w-full">
                          <button
                            type="button"
                            onClick={openDatePicker}
                            className="input input-bordered w-full text-left flex items-center"
                          >
                            {logData.date instanceof Date
                              ? logData.date.toLocaleDateString()
                              : 'Select date (defaults to today)'}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 ml-auto"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Custom Description */}
                      <div className="form-control">
                        <label className="label">
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

                {/* Media Preview Card - Updated for YouTube */}
                <div className="flex flex-col items-center justify-start">
                  {logData.type === 'video' && logData.youtubeChannelInfo ? (
                    <div className="card bg-base-200 shadow-md w-full">
                      <figure className="px-4 pt-4">
                        <img
                          src={logData.img}
                          alt="Video thumbnail"
                          className="rounded-lg max-h-64 object-contain"
                        />
                      </figure>
                      <div className="card-body pt-2">
                        <h2 className="card-title text-center text-sm">
                          {logData.mediaName}
                        </h2>
                        <div className="badge badge-primary">
                          Channel: {logData.youtubeChannelInfo.channelTitle}
                        </div>
                        {logData.hours > 0 || logData.minutes > 0 ? (
                          <div className="badge badge-secondary">
                            {logData.hours > 0 && `${logData.hours}h `}
                            {logData.minutes > 0 && `${logData.minutes}m`}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : logData.img &&
                    !['video', 'audio'].includes(logData.type || '') ? (
                    <div className="card bg-base-200 shadow-md w-full">
                      <figure className="px-4 pt-4">
                        <div className="overflow-hidden rounded-lg">
                          <img
                            src={logData.img}
                            alt="Selected Media"
                            className={`max-h-64 object-cover w-full ${
                              logData.isAdult &&
                              user?.settings?.blurAdultContent
                                ? 'blur-sm'
                                : ''
                            }`}
                          />
                        </div>
                      </figure>
                      <div className="card-body pt-2">
                        <div className="flex flex-col mb-2">
                          <h2 className="font-bold text-lg">
                            {logData.mediaName}
                          </h2>
                          {logData.titleRomaji && (
                            <div className="text-sm opacity-70">
                              {logData.titleRomaji}
                            </div>
                          )}
                        </div>

                        {logData.episodes > 0 && (
                          <div className="badge badge-primary">
                            {logData.episodes} episodes
                          </div>
                        )}
                        {logData.isAdult && (
                          <div className="badge badge-warning">
                            Adult Content
                          </div>
                        )}
                        {logData.mediaDescription && (
                          <div className="text-sm mt-2 max-h-28 overflow-y-auto">
                            {logData.mediaDescription}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full w-full bg-base-200 rounded-lg p-8 text-center">
                      {['video', 'audio'].includes(logData.type || '') ? (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-12 w-12 text-base-content opacity-40"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            {logData.type === 'video' ? (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            ) : (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                              />
                            )}
                          </svg>
                          <p className="mt-2 text-base-content opacity-60">
                            {logData.type === 'video' ? 'Video' : 'Audio'}{' '}
                            title: {logData.mediaName || '(enter a title)'}
                          </p>
                        </>
                      ) : (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-12 w-12 text-base-content opacity-40"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <p className="mt-2 text-base-content opacity-60">
                            {logData.type
                              ? 'Search for media to see a preview'
                              : 'Select a log type to get started'}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Enhanced Submit Button */}
            {logData.type && (
              <div className="card-actions justify-center mt-6">
                <button
                  className={`btn btn-primary btn-lg ${!isFormValid ? 'btn-disabled' : ''}`}
                  type="submit"
                  disabled={isLogCreating || !isFormValid}
                >
                  {isLogCreating ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Create Log
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Move date picker dialog outside the form */}
      <dialog ref={datePickerRef} className="modal modal-middle">
        <div className="modal-box bg-base-100 flex flex-col justify-center">
          <DayPicker
            className="react-day-picker mx-auto"
            mode="single"
            selected={logData.date || undefined}
            onSelect={(date) => {
              handleInputChange('date', date || undefined);
              datePickerRef.current?.close();
            }}
          />
          <div className="modal-action justify-center">
            <form method="dialog">
              <button className="btn">Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}

export default LogScreen;
