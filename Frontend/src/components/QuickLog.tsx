import { useRef, useState, useEffect } from 'react';
import { ICreateLog, ILog, IMediaDocument, youtubeChannelInfo } from '../types';
import { createLogFn } from '../api/trackerApi';
import useSearch from '../hooks/useSearch';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { validateQuickLogData } from '../utils/validation';
import { Link } from 'react-router-dom';

interface QuickLogProps {
  open: boolean;
  onClose: () => void;
  media?: IMediaDocument; // Add optional media prop
  onLogged?: () => void | Promise<void>;
  initialValues?: QuickLogInitialValues;
  allowedTypes?: ILog['type'][];
}

export interface QuickLogInitialValues {
  type?: ILog['type'];
  description?: string;
  episodes?: number;
  chars?: number;
  pages?: number;
  hours?: number;
  minutes?: number;
}

function QuickLog({
  open,
  onClose,
  media,
  onLogged,
  initialValues,
  allowedTypes,
}: QuickLogProps) {
  const [logType, setLogType] = useState<ILog['type'] | null>(null);
  const [logDescription, setLogDescription] = useState<string>('');
  const [episodes, setEpisodes] = useState<number>(0);
  const [chars, setChars] = useState<number>(0);
  const [pages, setPages] = useState<number>(0);
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);
  const [contentId, setContentId] = useState<string | undefined>(undefined);
  const [showTime, setShowTime] = useState<boolean>(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [isAdultMedia, setIsAdultMedia] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [defaultDuration, setDefaultDuration] = useState<number>(0);
  const [customDuration, setCustomDuration] = useState<number | undefined>(
    undefined
  );
  const suggestionRef = useRef<HTMLDivElement>(null);
  const lastSeedRef = useRef<string | null>(null);

  const queryClient = useQueryClient();
  const totalMinutes = hours * 60 + minutes;
  const hasActivity =
    totalMinutes > 0 || episodes > 0 || chars > 0 || pages > 0;

  useEffect(() => {
    // When media data is provided, auto-populate the form fields
    if (media) {
      setLogType(media.type);
      setLogDescription(media.title.contentTitleNative);
      setContentId(media.contentId);
      setCoverImage(media.contentImage);
      setIsAdultMedia(media.isAdult);

      // If it's anime, set episode duration (from API or default to 24 minutes)
      if (media.type === 'anime') {
        setDefaultDuration(media.episodeDuration || 24);
      }

      // For movies, auto-fill duration if available
      if (media.type === 'movie' && media.episodeDuration) {
        const totalMinutes = media.episodeDuration;
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        setHours(newHours);
        setMinutes(newMinutes);
      }
    }
  }, [media]); // Re-run when media changes

  // Reset custom duration when log type changes
  useEffect(() => {
    if (logType === 'anime') {
      // Set default to 24 minutes for anime if not already set
      if (defaultDuration === 0) {
        setDefaultDuration(24);
      }
    } else {
      setCustomDuration(undefined);
      setDefaultDuration(0);
    }

    // Reset type-specific fields when changing log type
    if (logType !== 'anime' && logType !== 'movie') {
      setEpisodes(0);
    }
    if (logType !== 'vn' && logType !== 'manga' && logType !== 'reading') {
      setChars(0);
    }
    if (logType !== 'manga' && logType !== 'reading') {
      setPages(0);
    }
    if (logType === 'anime' && episodes > 0) {
      // Don't reset time for anime as it's auto-calculated
    } else if (
      logType !== 'video' &&
      logType !== 'audio' &&
      logType !== 'manga' &&
      logType !== 'reading' &&
      logType !== 'movie' &&
      logType !== 'vn'
    ) {
      // Reset manual time for types that don't typically use it
      setHours(0);
      setMinutes(0);
    }
  }, [logType, defaultDuration, episodes]);

  const { data: searchResult, isLoading: isSearching } = useSearch(
    logType ?? '',
    logDescription,
    undefined,
    1,
    10,
    {
      enabled: open,
    }
  );

  useEffect(() => {
    if (!open) {
      lastSeedRef.current = null;
      return;
    }

    if (!initialValues) return;

    const serialized = JSON.stringify(initialValues);
    if (lastSeedRef.current === serialized) return;
    lastSeedRef.current = serialized;

    if (Object.prototype.hasOwnProperty.call(initialValues, 'type')) {
      setLogType(initialValues.type ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(initialValues, 'description')) {
      setLogDescription(initialValues.description ?? '');
    }
    if (Object.prototype.hasOwnProperty.call(initialValues, 'episodes')) {
      setEpisodes(initialValues.episodes ?? 0);
    }
    if (Object.prototype.hasOwnProperty.call(initialValues, 'chars')) {
      setChars(initialValues.chars ?? 0);
    }
    if (Object.prototype.hasOwnProperty.call(initialValues, 'pages')) {
      setPages(initialValues.pages ?? 0);
    }
    if (Object.prototype.hasOwnProperty.call(initialValues, 'hours')) {
      setHours(initialValues.hours ?? 0);
    }
    if (Object.prototype.hasOwnProperty.call(initialValues, 'minutes')) {
      setMinutes(initialValues.minutes ?? 0);
    }
  }, [open, initialValues]);

  const { mutate, isPending } = useMutation({
    mutationFn: createLogFn,
    onSuccess: () => {
      resetForm();
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            key.includes('logs') ||
            key[0] === 'logs' ||
            (Array.isArray(key) && key.some((k) => k === 'logs')) ||
            key.includes('recentLogs')
          );
        },
      });

      void queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes('comparison'),
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey.includes('recentLogs'),
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === 'globalFeed',
      });
      void queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'rankingSummary',
      });
      toast.success('Log created successfully!');
      if (onLogged) {
        void onLogged();
      }
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(error.message ? error.message : 'An error occurred');
      }
    },
  });

  const isSubmitDisabled = isPending || !hasActivity;

  function resetForm() {
    setLogType(null);
    setLogDescription('');
    setEpisodes(0);
    setChars(0);
    setPages(0);
    setHours(0);
    setMinutes(0);
    setContentId(undefined);
    setCoverImage(undefined);
    setIsAdultMedia(false);
    setDefaultDuration(0);
    setCustomDuration(undefined);
    setShowTime(false);
    lastSeedRef.current = null;
    onClose();
  }

  function preventNegativeValues(e: React.InputEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    if (input.valueAsNumber < 0) {
      input.value = '0';
    }
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    setLogDescription(e.target.value);
  }

  // Validate form before submission
  const isFormValid = () => {
    const validation = validateQuickLogData({
      type: logType,
      description: logDescription,
      episodes,
      chars,
      pages,
      hours,
      minutes,
    });

    setErrors(validation.errors);
    return validation.isValid;
  };

  async function logSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isFormValid()) {
      toast.error('Please fix validation errors');
      return;
    }

    mutate({
      type: logType,
      description: logDescription,
      episodes,
      time: totalMinutes || undefined,
      mediaId: contentId,
      chars,
      pages,
      date: new Date(),
      private: false,
      isAdult: false,
    } as ICreateLog);
  }

  function handleDescriptionInputBlur() {
    setTimeout(() => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(document.activeElement)
      ) {
        setIsSuggestionsOpen(false);
      }
    }, 200);
  }

  function handleSuggestionClick(
    group: IMediaDocument & { __youtubeChannelInfo?: youtubeChannelInfo }
  ) {
    if (logType === 'video' && group.__youtubeChannelInfo) {
      // Handle YouTube video selection
      setLogDescription(group.title.contentTitleNative);
      setContentId(group.__youtubeChannelInfo.channelId); // Use channel ID as contentId
      setCoverImage(
        group.contentImage || group.__youtubeChannelInfo.channelImage
      );
      setIsAdultMedia(group.isAdult);

      // Auto-fill duration if available
      if (group.episodeDuration) {
        const totalMinutes = group.episodeDuration;
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        setHours(newHours);
        setMinutes(newMinutes);
      }
    } else {
      // Handle regular media
      setLogDescription(group.title.contentTitleNative);
      setContentId(group.contentId);
      setCoverImage(group.coverImage || group.contentImage);
      setIsAdultMedia(group.isAdult);

      // For anime, store episode duration
      if (logType === 'anime' && group.episodeDuration) {
        setDefaultDuration(group.episodeDuration);
        setCustomDuration(undefined); // Reset custom duration when selecting new media
      } else if (logType === 'anime') {
        // Set default to 24 minutes if no duration from API
        setDefaultDuration(24);
        setCustomDuration(undefined);
      }

      // For movies, auto-fill duration if available
      if (logType === 'movie' && group.episodeDuration) {
        const totalMinutes = group.episodeDuration;
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        setHours(newHours);
        setMinutes(newMinutes);
      }
    }
    setIsSuggestionsOpen(false);
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-base-100/75 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <div
            className="card w-full max-w-lg bg-base-100 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-body">
              <div className="flex justify-between items-center">
                <h2 className="card-title">Quick Log</h2>
                <button
                  className="btn btn-sm btn-circle btn-ghost"
                  onClick={onClose}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={logSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex flex-col gap-4 flex-grow min-w-0">
                    <div>
                      <label className="label">
                        <span className="label-text">Select the log type</span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        onChange={(e) =>
                          setLogType(e.target.value as ILog['type'])
                        }
                        value={logType || 'Log type'}
                      >
                        <option disabled value="Log type">
                          Log type
                        </option>
                        {(
                          allowedTypes ?? [
                            'anime',
                            'manga',
                            'vn',
                            'video',
                            'movie',
                            'reading',
                            'audio',
                          ]
                        ).map((type) => (
                          <option key={type} value={type}>
                            {type === 'vn'
                              ? 'Visual Novel'
                              : type.charAt(0).toUpperCase() + type.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {logType && (
                      <>
                        <div>
                          <label className="label">
                            <span className="label-text">
                              Title or description
                            </span>
                          </label>
                          <input
                            type="text"
                            placeholder="Description"
                            className="input input-bordered w-full"
                            onFocus={() => setIsSuggestionsOpen(true)}
                            onBlur={handleDescriptionInputBlur}
                            onChange={handleSearch}
                            value={logDescription}
                          />
                          <div
                            ref={suggestionRef}
                            className={`dropdown dropdown-open ${
                              isSuggestionsOpen && searchResult
                                ? 'block'
                                : 'hidden'
                            }`}
                          >
                            <ul className="dropdown-content menu bg-base-200 rounded-box w-full shadow-lg mt-2 z-10">
                              {isSearching ? (
                                <li>
                                  <a>Loading...</a>
                                </li>
                              ) : searchResult?.length === 0 ? (
                                <li>
                                  <a>No results found</a>
                                </li>
                              ) : null}
                              {searchResult?.map((group, i) => (
                                <li
                                  key={i}
                                  onClick={() => handleSuggestionClick(group)}
                                >
                                  <a>{group.title.contentTitleNative}</a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Media-specific input fields */}
                        {(logType === 'anime' || logType === 'movie') && (
                          <div>
                            <label className="label">
                              <span className="label-text">
                                {logType === 'anime'
                                  ? 'Episodes Watched'
                                  : 'Movies Watched'}
                              </span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              onInput={preventNegativeValues}
                              placeholder={`Number of ${logType === 'anime' ? 'episodes' : 'movies'}`}
                              className="input input-bordered w-full mb-3"
                              onChange={(e) => {
                                const count = Number(e.target.value);
                                setEpisodes(count);

                                // Auto-calculate time based on duration for anime
                                if (logType === 'anime') {
                                  const effectiveDuration =
                                    customDuration || defaultDuration || 24;
                                  if (count > 0) {
                                    const totalMinutes =
                                      count * effectiveDuration;
                                    const newHours = Math.floor(
                                      totalMinutes / 60
                                    );
                                    const newMinutes = totalMinutes % 60;
                                    setHours(newHours);
                                    setMinutes(newMinutes);
                                  }
                                }
                              }}
                              value={episodes || ''}
                            />

                            {/* Custom Episode/Movie Duration for anime and movies */}
                            {logType === 'anime' && (
                              <>
                                <div className="form-control">
                                  <label className="label cursor-pointer">
                                    <span className="label-text">
                                      Custom episode duration
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={showTime}
                                      onChange={() => setShowTime(!showTime)}
                                      className="checkbox"
                                    />
                                  </label>
                                </div>

                                {showTime && (
                                  <div className="form-control mt-2">
                                    <label className="label">
                                      <span className="label-text-alt text-sm">
                                        Episode Duration (minutes)
                                      </span>
                                      {defaultDuration > 0 && (
                                        <span className="label-text-alt text-info text-xs">
                                          Default: {defaultDuration} min
                                        </span>
                                      )}
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      max="300"
                                      placeholder={
                                        defaultDuration > 0
                                          ? `${defaultDuration}`
                                          : '24'
                                      }
                                      className="input input-bordered input-sm"
                                      onChange={(e) => {
                                        const duration = Number(e.target.value);
                                        setCustomDuration(duration);

                                        // Recalculate time if episodes are set
                                        if (episodes > 0) {
                                          const totalMinutes =
                                            episodes * duration;
                                          const newHours = Math.floor(
                                            totalMinutes / 60
                                          );
                                          const newMinutes = totalMinutes % 60;
                                          setHours(newHours);
                                          setMinutes(newMinutes);
                                        }
                                      }}
                                      value={customDuration || ''}
                                    />
                                  </div>
                                )}

                                {/* Auto-calculated time display */}
                                {episodes > 0 && (
                                  <div className="alert alert-success mt-2">
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="stroke-current shrink-0 h-4 w-4"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    <span className="text-sm">
                                      Total time:{' '}
                                      {Math.floor(
                                        (episodes *
                                          (customDuration ||
                                            defaultDuration ||
                                            24)) /
                                          60
                                      )}
                                      h{' '}
                                      {(episodes *
                                        (customDuration ||
                                          defaultDuration ||
                                          24)) %
                                        60}
                                      m
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Characters field for VN, Manga, Reading */}
                        {(logType === 'vn' ||
                          logType === 'manga' ||
                          logType === 'reading') && (
                          <div>
                            <label className="label">
                              <span className="label-text">
                                Characters Read
                              </span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              onInput={preventNegativeValues}
                              placeholder="Number of characters"
                              className="input input-bordered w-full"
                              onChange={(e) => setChars(Number(e.target.value))}
                              value={chars || ''}
                            />
                          </div>
                        )}

                        {/* Pages field for Manga, Reading */}
                        {(logType === 'manga' || logType === 'reading') && (
                          <div>
                            <label className="label">
                              <span className="label-text">Pages Read</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              onInput={preventNegativeValues}
                              placeholder="Number of pages"
                              className="input input-bordered w-full"
                              onChange={(e) => setPages(Number(e.target.value))}
                              value={pages || ''}
                            />
                          </div>
                        )}

                        {/* Time fields for Video, Audio, Manga, Reading, VN, and when not auto-calculated */}
                        {(logType === 'video' ||
                          logType === 'audio' ||
                          logType === 'manga' ||
                          logType === 'reading' ||
                          logType === 'vn' ||
                          (logType === 'movie' && !episodes)) && (
                          <div>
                            <label className="label">
                              <span className="label-text">Time Spent</span>
                            </label>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="24"
                                  onInput={preventNegativeValues}
                                  placeholder="Hours"
                                  className="input input-bordered w-full"
                                  onChange={(e) =>
                                    setHours(Number(e.target.value))
                                  }
                                  value={hours || ''}
                                />
                                <label className="label">
                                  <span className="label-text-alt">Hours</span>
                                </label>
                              </div>
                              <div className="flex-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  onInput={preventNegativeValues}
                                  placeholder="Minutes"
                                  className="input input-bordered w-full"
                                  onChange={(e) =>
                                    setMinutes(Number(e.target.value))
                                  }
                                  value={minutes || ''}
                                />
                                <label className="label">
                                  <span className="label-text-alt">
                                    Minutes
                                  </span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {coverImage && (
                    <div className="flex-shrink-0 self-start lg:self-auto">
                      <Link
                        to={
                          logType && contentId
                            ? `/${logType}/${contentId}`
                            : '#'
                        }
                        className="group/qlog"
                      >
                        <img
                          src={coverImage}
                          alt="Cover"
                          className={`rounded-lg w-20 h-28 lg:w-24 lg:h-32 object-cover mx-auto lg:mx-0 ${
                            isAdultMedia
                              ? 'blur-lg group-hover/qlog:blur-sm transition-all'
                              : ''
                          }`}
                        />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Show validation errors */}
                {Object.keys(errors).length > 0 && (
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
                    <div>
                      <ul className="list-disc list-inside text-sm">
                        {Object.entries(errors).map(([field, error]) => (
                          <li key={field}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {logType && (
                  <div className="card-actions justify-end mt-4">
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={onClose}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      type="submit"
                      disabled={isSubmitDisabled}
                    >
                      {isPending ? (
                        <span className="loading loading-spinner"></span>
                      ) : (
                        'Log'
                      )}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default QuickLog;
