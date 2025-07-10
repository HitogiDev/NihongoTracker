import { useRef, useState, useEffect } from 'react';
import { ICreateLog, ILog, IMediaDocument, youtubeChannelInfo } from '../types';
import { createLogFn } from '../api/trackerApi';
import useSearch from '../hooks/useSearch';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { validateQuickLogData } from '../utils/validation';

interface QuickLogProps {
  open: boolean;
  onClose: () => void;
  media?: IMediaDocument; // Add optional media prop
}

function QuickLog({ open, onClose, media }: QuickLogProps) {
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const suggestionRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    // When media data is provided, auto-populate the form fields
    if (media) {
      setLogType(media.type);
      setLogDescription(media.title.contentTitleNative);
      setContentId(media.contentId);
      setCoverImage(media.contentImage);
    }
  }, [media]); // Re-run when media changes

  const { data: searchResult, isLoading: isSearching } = useSearch(
    logType ?? '',
    logDescription
  );

  const { mutate, isPending } = useMutation({
    mutationFn: createLogFn,
    onSuccess: () => {
      resetForm();
      void queryClient.invalidateQueries({
        predicate: (query) =>
          ['logs', 'user'].includes(query.queryKey[0] as string),
      });
      void queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
      toast.success('Log created successfully!');
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(error.message ? error.message : 'An error occurred');
      }
    },
  });

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
    onClose();
  }

  function preventNegativeValues(e: React.ChangeEvent<HTMLInputElement>) {
    if ((e.target as HTMLInputElement).valueAsNumber < 0) {
      (e.target as HTMLInputElement).value = '0';
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

  async function logSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isFormValid()) {
      toast.error('Please fix validation errors');
      return;
    }

    const totalMinutes = hours * 60 + minutes;

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
    }
    setIsSuggestionsOpen(false);
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-base-100/75">
          <div className="card w-96 bg-base-100 shadow-xl">
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
                <div className="flex flex-row gap-6">
                  <div className="flex flex-col gap-4 flex-grow">
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
                        <option value="anime">Anime</option>
                        <option value="manga">Manga</option>
                        <option value="vn">Visual novels</option>
                        <option value="video">Video</option>
                        <option value="movie">Movie</option>
                        <option value="reading">Reading</option>
                        <option value="audio">Audio</option>
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

                        {logType === 'anime' && (
                          <div>
                            <label className="label">
                              <span className="label-text">Episodes</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              onInput={preventNegativeValues}
                              placeholder="Episodes"
                              className="input input-bordered w-full"
                              onChange={(e) =>
                                setEpisodes(Number(e.target.value))
                              }
                              value={episodes}
                            />
                          </div>
                        )}

                        {logType === 'anime' && (
                          <div className="form-control">
                            <label className="label cursor-pointer">
                              <span className="label-text">Custom time</span>
                              <input
                                type="checkbox"
                                checked={showTime}
                                onChange={() => setShowTime(!showTime)}
                                className="checkbox"
                              />
                            </label>
                          </div>
                        )}

                        {(logType !== 'anime' || showTime) && (
                          <div>
                            <label className="label">
                              <span className="label-text">Time spent</span>
                            </label>
                            <div className="flex flex-col gap-2">
                              <div>
                                <label className="label">
                                  <span className="label-text-alt">
                                    Hours: {hours}
                                  </span>
                                </label>
                                <input
                                  type="range"
                                  min={0}
                                  max="24"
                                  value={hours}
                                  onChange={(e) =>
                                    setHours(Number(e.target.value))
                                  }
                                  className="range range-sm"
                                />
                              </div>
                              <div>
                                <label className="label">
                                  <span className="label-text-alt">
                                    Minutes: {minutes}
                                  </span>
                                </label>
                                <input
                                  type="range"
                                  min={0}
                                  max="59"
                                  value={minutes}
                                  onChange={(e) =>
                                    setMinutes(Number(e.target.value))
                                  }
                                  className="range range-sm"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {(logType === 'reading' ||
                          logType === 'vn' ||
                          logType === 'manga') && (
                          <div>
                            <label className="label">
                              <span className="label-text">Characters</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              onInput={preventNegativeValues}
                              placeholder="Character count"
                              className="input input-bordered w-full"
                              onChange={(e) => setChars(Number(e.target.value))}
                              value={chars}
                            />
                          </div>
                        )}

                        {logType === 'manga' && (
                          <div>
                            <label className="label">
                              <span className="label-text">Pages</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              onInput={preventNegativeValues}
                              placeholder="Pages"
                              className="input input-bordered w-full"
                              onChange={(e) => setPages(Number(e.target.value))}
                              value={pages}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {coverImage && (
                    <div className="flex-shrink-0">
                      <img
                        src={coverImage}
                        alt="Cover"
                        className="rounded-lg w-24 h-32 object-cover"
                      />
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
                      className="btn btn-neutral text-neutral-content"
                      type="submit"
                      disabled={isPending}
                    >
                      {isPending ? (
                        <span className="loading loading-spinner"></span>
                      ) : (
                        'Log'
                      )}
                    </button>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={onClose}
                    >
                      Cancel
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
