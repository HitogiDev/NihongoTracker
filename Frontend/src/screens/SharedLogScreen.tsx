import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { getLogFn, createLogFn } from '../api/trackerApi';
import { ICreateLog } from '../types';
import { useUserDataStore } from '../store/userData';
import {
  MdBook,
  MdPlayArrow,
  MdGamepad,
  MdVideoLibrary,
  MdVolumeUp,
  MdMoreHoriz,
  MdShare,
  MdAdd,
  MdMovie,
  MdOutlineTv,
} from 'react-icons/md';
import { validateSharedLogData } from '../utils/validation';

const logTypeConfig = {
  reading: {
    label: 'Reading',
    icon: MdBook,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
  },
  anime: {
    label: 'Anime',
    icon: MdPlayArrow,
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
    borderColor: 'border-secondary/20',
  },
  vn: {
    label: 'Visual Novel',
    icon: MdGamepad,
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    borderColor: 'border-accent/20',
  },
  video: {
    label: 'Video',
    icon: MdVideoLibrary,
    color: 'text-info',
    bgColor: 'bg-info/10',
    borderColor: 'border-info/20',
  },
  manga: {
    label: 'Manga',
    icon: MdBook,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
  },
  audio: {
    label: 'Audio',
    icon: MdVolumeUp,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
  },
  movie: {
    label: 'Movie',
    icon: MdMovie,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  'tv show': {
    label: 'TV Show',
    icon: MdOutlineTv,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  other: {
    label: 'Other',
    icon: MdMoreHoriz,
    color: 'text-neutral',
    bgColor: 'bg-neutral/10',
    borderColor: 'border-neutral/20',
  },
};

function SharedLogScreen() {
  const { logId } = useParams<{ logId: string }>();
  const navigate = useNavigate();
  const { user } = useUserDataStore();
  const queryClient = useQueryClient();

  const [customValues, setCustomValues] = useState({
    episodes: 0,
    time: 0,
    chars: 0,
    pages: 0,
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const {
    data: sharedLog,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sharedLog', logId],
    queryFn: () => getLogFn(logId!),
    enabled: !!logId,
  });

  const { mutate: createLog, isPending: isCreating } = useMutation({
    mutationFn: createLogFn,
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          ['logs', 'user'].includes(query.queryKey[0] as string),
      });
      toast.success('Log created successfully from shared link!');
      navigate(`/user/${user?.username}`);
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data.message
          : 'An error occurred';
      toast.error(errorMessage);
    },
  });

  useEffect(() => {
    if (sharedLog) {
      setCustomValues({
        episodes: sharedLog.episodes || 0,
        time: sharedLog.time || 0,
        chars: sharedLog.chars || 0,
        pages: sharedLog.pages || 0,
        description: sharedLog.description || '',
      });
    }
  }, [sharedLog]);

  // Validate form when values change
  useEffect(() => {
    if (Object.keys(touched).length > 0) {
      const validation = validateSharedLogData(customValues);
      setErrors(validation.errors);
    }
  }, [customValues, touched]);

  const handleFieldChange = (
    field: keyof typeof customValues,
    value: string | number
  ) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setCustomValues({ ...customValues, [field]: value });
  };

  const handleCreateLog = () => {
    // Mark all fields as touched
    setTouched({
      description: true,
      episodes: true,
      time: true,
      chars: true,
      pages: true,
    });

    const validation = validateSharedLogData(customValues);
    setErrors(validation.errors);

    if (!validation.isValid) {
      toast.error('Please fix validation errors');
      return;
    }

    if (!sharedLog) {
      toast.error('Shared log data is not available');
      return;
    }

    const logData: ICreateLog = {
      type: sharedLog.type,
      description: customValues.description || sharedLog.description || '',
      episodes: customValues.episodes || undefined,
      time: customValues.time || undefined,
      chars: customValues.chars || undefined,
      pages: customValues.pages || undefined,
      private: false,
      isAdult: sharedLog.isAdult || false,
      date: sharedLog.date,
      ...(sharedLog.mediaId && { mediaId: sharedLog.mediaId }),
    };

    createLog(logData);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 flex items-center justify-center p-4">
        <div className="card w-full max-w-lg bg-base-100 shadow-2xl">
          <div className="card-body text-center p-8">
            <div className="mb-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MdShare className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold text-base-content mb-2">
                Check Out This Log!
              </h2>
              <p className="text-base-content/70 text-lg">
                Someone shared an amazing log with you! Join our community to
                create your own immersion journey.
              </p>
            </div>

            <div className="bg-primary/5 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="badge badge-primary badge-outline">
                  <MdBook className="w-3 h-3 mr-1" />
                  Shared Progress
                </div>
              </div>
              <p className="text-sm text-base-content/60">
                Join our community to track your own progress and share
                achievements
              </p>
            </div>

            <div className="space-y-3">
              <button
                className="btn btn-primary btn-lg w-full"
                onClick={() => navigate('/login')}
              >
                <MdPlayArrow className="w-5 h-5" />
                Sign In to Continue
              </button>
              <div className="divider text-xs">or</div>
              <button
                className="btn btn-outline btn-lg w-full"
                onClick={() => navigate('/register')}
              >
                Create New Account
              </button>
            </div>

            <p className="text-xs text-base-content/50 mt-6">
              Join thousands of learners tracking their progress
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 flex items-center justify-center p-4">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center p-8">
            <div className="flex justify-center mb-6">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Loading Shared Log</h2>
            <p className="text-base-content/60">
              Fetching the shared content for you...
            </p>
            <div className="flex justify-center gap-1 mt-4">
              <span className="loading loading-dots loading-sm"></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !sharedLog) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 flex items-center justify-center p-4">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body text-center p-8">
            <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">😔</span>
            </div>
            <h2 className="text-2xl font-bold text-base-content mb-4">
              Oops! Log Not Found
            </h2>
            <p className="text-base-content/70 mb-6">
              The shared log could not be found. It may have been deleted or the
              link might be incorrect.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-primary w-full"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => navigate(-1)}
                className="btn btn-ghost w-full"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const typeConfig = logTypeConfig[sharedLog.type];
  const TypeIcon = typeConfig.icon;

  const logTitle =
    sharedLog.media &&
    typeof sharedLog.media === 'object' &&
    sharedLog.media.title?.contentTitleNative
      ? sharedLog.media.title.contentTitleNative
      : sharedLog.description || 'Untitled Log';

  const coverImage =
    sharedLog.media &&
    typeof sharedLog.media === 'object' &&
    sharedLog.media.contentImage;

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 pt-20 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-base-100 rounded-full px-6 py-3 shadow-lg mb-4">
            <MdShare className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">Shared Log</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-base-content mb-2">
            Add This to Your Progress
          </h1>
          <p className="text-base-content/70 text-lg max-w-2xl mx-auto">
            Someone shared their learning achievement with you. Add it to your
            own log collection.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Cover Image & Info */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              {/* Cover Image */}
              {coverImage && (
                <div className="card bg-base-100 shadow-xl mb-6">
                  <figure className="aspect-[3/4] overflow-hidden rounded-xl">
                    <img
                      src={coverImage}
                      alt={logTitle}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </figure>
                </div>
              )}

              {/* Type Badge */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 ${typeConfig.bgColor} rounded-xl`}>
                      <TypeIcon className={`w-6 h-6 ${typeConfig.color}`} />
                    </div>
                    <div>
                      <div className={`badge ${typeConfig.color} gap-1`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeConfig.label}
                      </div>
                      <h3 className="font-semibold text-lg mt-1">
                        Shared Progress
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-base-content/60">
                        Title
                      </span>
                      <p className="font-semibold">{logTitle}</p>
                    </div>

                    {sharedLog.media &&
                      typeof sharedLog.media === 'object' &&
                      sharedLog.media.title?.contentTitleEnglish && (
                        <div>
                          <span className="text-sm font-medium text-base-content/60">
                            English Title
                          </span>
                          <p className="text-sm">
                            {sharedLog.media.title.contentTitleEnglish}
                          </p>
                        </div>
                      )}

                    <div className="divider my-4"></div>

                    {/* Original Stats */}
                    <div className="space-y-2">
                      {sharedLog.episodes && (
                        <div className="flex justify-between items-center py-2 px-3 bg-base-200 rounded-lg">
                          <span className="text-sm font-medium">Episodes</span>
                          <span className="font-bold">
                            {sharedLog.episodes}
                          </span>
                        </div>
                      )}
                      {sharedLog.time && (
                        <div className="flex justify-between items-center py-2 px-3 bg-base-200 rounded-lg">
                          <span className="text-sm font-medium">Time</span>
                          <span className="font-bold">
                            {sharedLog.time >= 60
                              ? `${Math.floor(sharedLog.time / 60)}h ${sharedLog.time % 60}m`
                              : `${sharedLog.time}m`}
                          </span>
                        </div>
                      )}
                      {sharedLog.chars && (
                        <div className="flex justify-between items-center py-2 px-3 bg-base-200 rounded-lg">
                          <span className="text-sm font-medium">
                            Characters
                          </span>
                          <span className="font-bold">
                            {sharedLog.chars.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {sharedLog.pages && (
                        <div className="flex justify-between items-center py-2 px-3 bg-base-200 rounded-lg">
                          <span className="text-sm font-medium">Pages</span>
                          <span className="font-bold">{sharedLog.pages}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 px-3 bg-primary/10 rounded-lg">
                        <span className="text-sm font-medium">XP Earned</span>
                        <span className="font-bold text-primary">
                          {sharedLog.xp}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Add to Your Log */}
          <div className="lg:col-span-2">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-success/10 rounded-xl">
                    <MdAdd className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Add to Your Progress</h2>
                    <p className="text-base-content/60">
                      Copy this log to your own profile
                    </p>
                  </div>
                </div>

                {/* Quick Add Section */}
                <div className="alert alert-success mb-6">
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="font-bold">Ready to add!</h3>
                    <div className="text-sm">
                      This log will be added to your profile: "
                      {customValues.description}" • {typeConfig.label}
                      {customValues.time > 0 && ` • ${customValues.time} min`}
                      {customValues.episodes > 0 &&
                        ` • ${customValues.episodes} episodes`}
                      {customValues.chars > 0 &&
                        ` • ${customValues.chars.toLocaleString()} chars`}
                      {customValues.pages > 0 &&
                        ` • ${customValues.pages} pages`}
                    </div>
                  </div>
                </div>

                {/* Optional Customization */}
                <details className="collapse collapse-arrow bg-base-200">
                  <summary className="collapse-title text-lg font-medium">
                    Want to adjust the values? (Optional)
                  </summary>
                  <div className="collapse-content">
                    <div className="space-y-4 pt-4">
                      {/* Description */}
                      <div>
                        <label className="label">
                          <span className="label-text font-semibold">
                            Description
                          </span>
                        </label>
                        <input
                          type="text"
                          className={`input input-bordered w-full ${
                            errors.description
                              ? 'input-error'
                              : touched.description &&
                                  customValues.description &&
                                  !errors.description
                                ? 'input-success'
                                : ''
                          }`}
                          value={customValues.description}
                          onChange={(e) =>
                            handleFieldChange('description', e.target.value)
                          }
                          placeholder="Enter your description"
                        />
                        {errors.description && (
                          <label className="label">
                            <span className="label-text-alt text-error">
                              {errors.description}
                            </span>
                          </label>
                        )}
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sharedLog.type === 'anime' && (
                          <div>
                            <label className="label">
                              <span className="label-text">Episodes</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              className={`input input-bordered w-full ${
                                errors.episodes ? 'input-error' : ''
                              }`}
                              value={customValues.episodes}
                              onChange={(e) =>
                                handleFieldChange(
                                  'episodes',
                                  Number(e.target.value)
                                )
                              }
                              placeholder="Number of episodes"
                            />
                            {errors.episodes && (
                              <label className="label">
                                <span className="label-text-alt text-error">
                                  {errors.episodes}
                                </span>
                              </label>
                            )}
                          </div>
                        )}

                        <div>
                          <label className="label">
                            <span className="label-text">Time (minutes)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="input input-bordered w-full"
                            value={customValues.time}
                            onChange={(e) =>
                              setCustomValues({
                                ...customValues,
                                time: Number(e.target.value),
                              })
                            }
                            placeholder="Time in minutes"
                          />
                        </div>

                        {(sharedLog.type === 'reading' ||
                          sharedLog.type === 'vn' ||
                          sharedLog.type === 'manga') && (
                          <div>
                            <label className="label">
                              <span className="label-text">Characters</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="input input-bordered w-full"
                              value={customValues.chars}
                              onChange={(e) =>
                                setCustomValues({
                                  ...customValues,
                                  chars: Number(e.target.value),
                                })
                              }
                              placeholder="Character count"
                            />
                          </div>
                        )}

                        {sharedLog.type === 'manga' && (
                          <div>
                            <label className="label">
                              <span className="label-text">Pages</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="input input-bordered w-full"
                              value={customValues.pages}
                              onChange={(e) =>
                                setCustomValues({
                                  ...customValues,
                                  pages: Number(e.target.value),
                                })
                              }
                              placeholder="Number of pages"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </details>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-end mt-8 pt-6 border-t border-base-300">
                  <button
                    onClick={() => navigate('/')}
                    className="btn btn-outline btn-lg w-full sm:w-auto"
                    disabled={isCreating}
                  >
                    Maybe Later
                  </button>
                  <button
                    onClick={handleCreateLog}
                    disabled={isCreating || Object.keys(errors).length > 0}
                    className="btn btn-primary btn-lg w-full sm:w-auto"
                  >
                    {isCreating ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Adding to Your Log...
                      </>
                    ) : (
                      <>
                        <MdAdd className="w-5 h-5" />
                        Add to My Progress
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SharedLogScreen;
