import { useMutation } from '@tanstack/react-query';
import { ILog, updateLogRequest } from '../types';
import { DateTime } from 'luxon';
import {
  MdDelete,
  MdSchedule,
  MdTrendingUp,
  MdBook,
  MdPlayArrow,
  MdGamepad,
  MdVideoLibrary,
  MdVolumeUp,
  MdMovie,
  MdOutlineTv,
  MdMoreHoriz,
  MdSpeed,
  MdCalendarToday,
  MdTimer,
  MdEdit,
  MdShare,
} from 'react-icons/md';
import { deleteLogFn, updateLogFn } from '../api/trackerApi';
import { toast } from 'react-toastify';
import queryClient from '../queryClient';
import { AxiosError } from 'axios';
import { useUserDataStore } from '../store/userData';
import { useRef, useState } from 'react';
import { validateUpdateLogData } from '../utils/validation';

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

function LogCard({ log, user: logUser }: { log: ILog; user?: string }) {
  const { description, xp, date, type, episodes, pages, time, chars, media } =
    log;
  const { user } = useUserDataStore();
  const deleteModalRef = useRef<HTMLDialogElement>(null);
  const editModalRef = useRef<HTMLDialogElement>(null);
  const detailsModalRef = useRef<HTMLDialogElement>(null);

  // Edit form state with all editable fields
  const [editData, setEditData] = useState({
    description: description || '',
    type: type,
    date: date
      ? typeof date === 'string'
        ? date.split('T')[0]
        : new Date(date).toISOString().split('T')[0]
      : '',
    episodes: episodes || 0,
    pages: pages || 0,
    chars: chars || 0,
    hours: time ? Math.floor(time / 60) : 0,
    minutes: time ? time % 60 : 0,
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const typeConfig = logTypeConfig[type];
  const TypeIcon = typeConfig.icon;

  const relativeDate = date
    ? typeof date === 'string'
      ? DateTime.fromISO(date).toRelative()
      : DateTime.fromJSDate(date as Date).toRelative()
    : '';

  const fullDate = date
    ? typeof date === 'string'
      ? DateTime.fromISO(date).toLocaleString({
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : DateTime.fromJSDate(date as Date).toLocaleString({
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
    : '';

  const logTitle =
    media && typeof media === 'object' && media.title?.contentTitleNative
      ? media.title.contentTitleNative
      : description || 'Untitled Log';

  const displayTitle =
    logTitle.length > 35 ? `${logTitle.slice(0, 35)}...` : logTitle;

  const { mutate: deleteLog, isPending: loadingDeleteLog } = useMutation({
    mutationFn: (id: string) => deleteLogFn(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) =>
          ['logs', 'user'].includes(query.queryKey[0] as string),
      });
      queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
      toast.success('Log deleted successfully!');
      deleteModalRef.current?.close();
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data.message
          : 'An error occurred';
      toast.error(errorMessage);
    },
  });

  const { mutate: updateLog, isPending: loadingUpdateLog } = useMutation({
    mutationFn: (data: updateLogRequest) => updateLogFn(log._id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) =>
          ['logs', 'user'].includes(query.queryKey[0] as string),
      });
      void queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
      toast.success('Log updated successfully!');
      editModalRef.current?.close();
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data.message
          : 'An error occurred';
      toast.error(errorMessage);
    },
  });

  function openEditModal() {
    setEditData({
      description: description || '',
      type: type,
      date: date
        ? typeof date === 'string'
          ? date.split('T')[0]
          : new Date(date).toISOString().split('T')[0]
        : '',
      episodes: episodes || 0,
      pages: pages || 0,
      chars: chars || 0,
      hours: time ? Math.floor(time / 60) : 0,
      minutes: time ? time % 60 : 0,
    });
    editModalRef.current?.showModal();
  }

  function openDetailsModal() {
    detailsModalRef.current?.showModal();
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validation = validateUpdateLogData({
      description: editData.description,
      type: editData.type,
      hours: editData.hours,
      minutes: editData.minutes,
      episodes: editData.episodes,
      chars: editData.chars,
      pages: editData.pages,
    });

    setEditErrors(validation.errors);

    if (!validation.isValid) {
      toast.error('Please fix validation errors');
      return;
    }

    const totalMinutes = editData.hours * 60 + editData.minutes;

    const updateData: updateLogRequest = {
      description: editData.description,
      type: editData.type,
      date: editData.date ? new Date(editData.date) : undefined,
      time: totalMinutes || undefined,
      episodes: editData.episodes || undefined,
      pages: editData.pages || undefined,
      chars: editData.chars || undefined,
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof updateLogRequest] === undefined) {
        delete updateData[key as keyof updateLogRequest];
      }
    });

    updateLog(updateData);
  }

  function preventNegativeValues(e: React.ChangeEvent<HTMLInputElement>) {
    if ((e.target as HTMLInputElement).valueAsNumber < 0) {
      (e.target as HTMLInputElement).value = '0';
    }
  }

  function getQuantityInfo() {
    const info: {
      label: string;
      value: string | number;
      icon?: React.ElementType;
      tooltip?: string;
    }[] = [];

    if (type === 'anime' && episodes) {
      info.push({
        label: 'Episodes',
        value: episodes,
        icon: MdPlayArrow,
        tooltip: time
          ? `${episodes} episodes • ${time} minutes total`
          : `${episodes} episodes watched`,
      });
    } else if (type === 'manga') {
      if (pages)
        info.push({
          label: 'Pages',
          value: pages,
          icon: MdBook,
          tooltip: chars
            ? `${pages} pages • ${chars.toLocaleString()} characters`
            : `${pages} pages read`,
        });
      if (chars && !pages)
        info.push({
          label: 'Characters',
          value: chars.toLocaleString(),
          icon: MdBook,
          tooltip: `${chars.toLocaleString()} characters read`,
        });
    } else if (type === 'vn' || type === 'reading') {
      if (chars) {
        const readingSpeed =
          time && chars ? Math.round((chars / time) * 60) : null;
        info.push({
          label: 'Characters',
          value: chars.toLocaleString(),
          icon: MdBook,
          tooltip: readingSpeed
            ? `${chars.toLocaleString()} characters • ${time} min • ${readingSpeed} chars/hour`
            : `${chars.toLocaleString()} characters read`,
        });

        // Add reading speed as separate badge
        if (readingSpeed && time) {
          info.push({
            label: 'Speed',
            value: `${readingSpeed}/hr`,
            icon: MdSpeed,
            tooltip: `Reading speed: ${readingSpeed} characters per hour`,
          });
        }

        // Add time as separate badge
        if (time) {
          const timeStr =
            time >= 60 ? `${Math.floor(time / 60)}h ${time % 60}m` : `${time}m`;
          info.push({
            label: 'Time',
            value: timeStr,
            icon: MdTimer,
            tooltip: `${time} minutes spent reading`,
          });
        }
      } else if (time && !chars) {
        const timeStr =
          time >= 60 ? `${Math.floor(time / 60)}h ${time % 60}m` : `${time}m`;
        info.push({
          label: 'Time',
          value: timeStr,
          icon: MdSchedule,
          tooltip: `${time} minutes spent reading`,
        });
      }
    } else if ((type === 'video' || type === 'audio') && time) {
      const timeStr =
        time >= 60 ? `${Math.floor(time / 60)}h ${time % 60}m` : `${time}m`;
      info.push({
        label: 'Time',
        value: timeStr,
        icon: MdSchedule,
        tooltip: `${time} minutes of ${type} content`,
      });
    }

    return info;
  }

  function getReadingSpeed() {
    if ((type === 'reading' || type === 'vn') && chars && time && time > 0) {
      return Math.round((chars / time) * 60);
    }
    return null;
  }

  const quantityInfo = getQuantityInfo();
  const isOwner = logUser === user?.username;
  const readingSpeed = getReadingSpeed();

  function handleShare() {
    const shareUrl = `${window.location.origin}/shared-log/${log._id}`;

    if (navigator.share) {
      // Use native sharing if available
      navigator
        .share({
          title: `Check out this ${typeConfig.label} log: ${logTitle}`,
          text: `I logged "${logTitle}" and thought you might want to create a similar log!`,
          url: shareUrl,
        })
        .catch((error) => {
          console.log('Error sharing:', error);
          // Fallback to clipboard
          copyToClipboard(shareUrl);
        });
    } else {
      // Fallback to clipboard
      copyToClipboard(shareUrl);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success('Share link copied to clipboard!');
      })
      .catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('Share link copied to clipboard!');
      });
  }

  return (
    <>
      <article
        className={`card bg-base-100 shadow-sm hover:shadow-md transition-all duration-300 border ${typeConfig.borderColor} group`}
        role="article"
        aria-label={`Log entry: ${logTitle}`}
      >
        {/* Header with type indicator */}
        <div
          className={`h-1 w-full ${typeConfig.bgColor.replace('/10', '')}`}
        ></div>

        <div className="card-body p-4 space-y-3">
          {/* Header Section */}
          <header className="flex justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className={`badge badge-outline ${typeConfig.color} gap-1 shrink-0`}
              >
                <TypeIcon className="w-3 h-3" />
                <span className="text-xs font-medium">{typeConfig.label}</span>
              </div>

              <div className="min-w-0 flex-1">
                <h2
                  className="font-bold text-base leading-tight text-base-content group-hover:text-primary transition-colors duration-200"
                  title={logTitle}
                >
                  {displayTitle}
                </h2>

                {media &&
                  typeof media === 'object' &&
                  media.title?.contentTitleEnglish && (
                    <p className="text-sm text-base-content/60 mt-1 leading-tight">
                      {media.title.contentTitleEnglish.length > 45
                        ? `${media.title.contentTitleEnglish.slice(0, 45)}...`
                        : media.title.contentTitleEnglish}
                    </p>
                  )}

                {/* Additional context for non-media logs */}
                {(!media || typeof media !== 'object') &&
                  description &&
                  description !== logTitle && (
                    <p className="text-sm text-base-content/60 mt-1 leading-tight">
                      {description.length > 45
                        ? `${description.slice(0, 45)}...`
                        : description}
                    </p>
                  )}
              </div>
            </div>

            {isOwner && (
              <div className="dropdown dropdown-end">
                <button
                  tabIndex={0}
                  className="btn btn-ghost btn-sm btn-circle opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  aria-label="Log options"
                >
                  <MdMoreHoriz className="w-4 h-4" />
                </button>
                <ul className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-32 border border-base-300 z-50">
                  <li>
                    <button
                      onClick={handleShare}
                      className="text-success hover:bg-success/10 gap-2"
                    >
                      <MdShare className="w-4 h-4" />
                      Share
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={openDetailsModal}
                      className="text-info hover:bg-info/10 gap-2"
                    >
                      <MdBook className="w-4 h-4" />
                      Details
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={openEditModal}
                      className="text-warning hover:bg-warning/10 gap-2"
                    >
                      <MdEdit className="w-4 h-4" />
                      Edit
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => deleteModalRef.current?.showModal()}
                      className="text-error hover:bg-error/10 gap-2"
                    >
                      <MdDelete className="w-4 h-4" />
                      Delete
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </header>

          {/* Quantity Information with enhanced data */}
          {quantityInfo.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quantityInfo.map((info, index) => (
                <div
                  key={index}
                  className={`tooltip ${info.tooltip ? 'tooltip-bottom' : ''}`}
                  data-tip={info.tooltip}
                >
                  <div
                    className={`badge badge-soft gap-1 ${typeConfig.bgColor} ${typeConfig.color}`}
                  >
                    {info.icon && <info.icon className="w-3 h-3" />}
                    <span className="text-xs">
                      {info.label}:{' '}
                      <span className="font-semibold">{info.value}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer Section with enhanced information */}
          <footer className="flex justify-between items-center pt-2 border-t border-base-300">
            <div className="flex items-center gap-2">
              <div
                className={`tooltip tooltip-top`}
                data-tip={`Experience gained: ${xp} points`}
              >
                <div
                  className={`badge badge-outline ${typeConfig.color} gap-1`}
                >
                  <MdTrendingUp className="w-3 h-3" />
                  <span className="text-xs font-bold">{xp} XP</span>
                </div>
              </div>
            </div>

            <div className="tooltip tooltip-left" data-tip={fullDate}>
              <time
                className="text-xs text-base-content/60 hover:text-base-content transition-colors duration-200 cursor-help flex items-center gap-1"
                dateTime={
                  date
                    ? typeof date === 'string'
                      ? date
                      : date.toISOString()
                    : undefined
                }
              >
                <MdCalendarToday className="w-3 h-3" />
                {relativeDate}
              </time>
            </div>
          </footer>
        </div>
      </article>

      {/* Log Details Modal */}
      <dialog
        ref={detailsModalRef}
        className="modal modal-bottom sm:modal-middle"
        aria-labelledby="details-modal-title"
      >
        <div className="modal-box max-w-2xl">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 ${typeConfig.bgColor} rounded-lg`}>
                <TypeIcon className={`w-6 h-6 ${typeConfig.color}`} />
              </div>
              <div>
                <h3 id="details-modal-title" className="font-bold text-xl">
                  Log Details
                </h3>
                <div className={`badge ${typeConfig.color} gap-1 mt-1`}>
                  <TypeIcon className="w-3 h-3" />
                  {typeConfig.label}
                </div>
              </div>
            </div>
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost">✕</button>
            </form>
          </div>

          <div className="space-y-6">
            {/* Media Information */}
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <MdBook className="w-5 h-5" />
                  Content Information
                </h4>

                <div className="space-y-3">
                  <div>
                    <span className="label-text font-medium">Title:</span>
                    <p className="text-base-content mt-1">{logTitle}</p>
                  </div>

                  {media &&
                    typeof media === 'object' &&
                    media.title?.contentTitleEnglish && (
                      <div>
                        <span className="label-text font-medium">
                          English Title:
                        </span>
                        <p className="text-base-content mt-1">
                          {media.title.contentTitleEnglish}
                        </p>
                      </div>
                    )}

                  {media &&
                    typeof media === 'object' &&
                    media.title?.contentTitleRomaji && (
                      <div>
                        <span className="label-text font-medium">
                          Romaji Title:
                        </span>
                        <p className="text-base-content mt-1">
                          {media.title.contentTitleRomaji}
                        </p>
                      </div>
                    )}

                  {description && description !== logTitle && (
                    <div>
                      <span className="label-text font-medium">
                        Description:
                      </span>
                      <p className="text-base-content mt-1">{description}</p>
                    </div>
                  )}

                  {media && typeof media === 'object' && media.type && (
                    <div>
                      <span className="label-text font-medium">
                        Media Type:
                      </span>
                      <span className="badge badge-outline ml-2 capitalize">
                        {media.type}
                      </span>
                    </div>
                  )}

                  {media && typeof media === 'object' && media.contentId && (
                    <div>
                      <span className="label-text font-medium">
                        Content ID:
                      </span>
                      <span className="font-mono text-xs bg-base-300 px-2 py-1 rounded ml-2">
                        {media.contentId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Activity Statistics */}
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <MdTrendingUp className="w-5 h-5" />
                  Activity Statistics
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="stat bg-base-100 rounded-lg p-3">
                    <div className="stat-title text-xs">Experience Gained</div>
                    <div className={`stat-value text-2xl ${typeConfig.color}`}>
                      {xp}
                    </div>
                    <div className="stat-desc">XP Points</div>
                  </div>

                  {time && time > 0 ? (
                    <div className="stat bg-base-100 rounded-lg p-3">
                      <div className="stat-title text-xs">Time Spent</div>
                      <div className="stat-value text-2xl text-info">
                        {time >= 60
                          ? `${Math.floor(time / 60)}h ${time % 60}m`
                          : `${time}m`}
                      </div>
                      <div className="stat-desc">{time} minutes</div>
                    </div>
                  ) : null}

                  {episodes && (
                    <div className="stat bg-base-100 rounded-lg p-3">
                      <div className="stat-title text-xs">Episodes</div>
                      <div className="stat-value text-2xl text-secondary">
                        {episodes}
                      </div>
                      <div className="stat-desc">Watched</div>
                    </div>
                  )}

                  {pages && pages > 0 ? (
                    <div className="stat bg-base-100 rounded-lg p-3">
                      <div className="stat-title text-xs">Pages</div>
                      <div className="stat-value text-2xl text-warning">
                        {pages}
                      </div>
                      <div className="stat-desc">Read</div>
                    </div>
                  ) : null}

                  {chars && (
                    <div className="stat bg-base-100 rounded-lg p-3">
                      <div className="stat-title text-xs">Characters</div>
                      <div className="stat-value text-lg text-accent">
                        {chars.toLocaleString()}
                      </div>
                      <div className="stat-desc">Read</div>
                    </div>
                  )}

                  {readingSpeed && (
                    <div className="stat bg-base-100 rounded-lg p-3">
                      <div className="stat-title text-xs">Reading Speed</div>
                      <div className="stat-value text-xl text-success">
                        {readingSpeed}
                      </div>
                      <div className="stat-desc">chars/hour</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Date and Time Information */}
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <MdCalendarToday className="w-5 h-5" />
                  Date & Time
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="label-text font-medium">Created:</span>
                    <p className="text-base-content mt-1">{fullDate}</p>
                    <p className="text-sm text-base-content/60">
                      {relativeDate}
                    </p>
                  </div>

                  {time && (
                    <div>
                      <span className="label-text font-medium">Duration:</span>
                      <p className="text-base-content mt-1">
                        {time >= 60
                          ? `${Math.floor(time / 60)} hour${Math.floor(time / 60) !== 1 ? 's' : ''} and ${time % 60} minute${time % 60 !== 1 ? 's' : ''}`
                          : `${time} minute${time !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Media Details (if available) */}
            {media && typeof media === 'object' && (
              <div className="card bg-base-200 shadow-sm">
                <div className="card-body p-4">
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <MdVideoLibrary className="w-5 h-5" />
                    Media Details
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <span className="label-text font-medium">
                        Content ID:
                      </span>
                      <span className="font-mono text-xs bg-base-300 px-2 py-1 rounded ml-2">
                        {media.contentId}
                      </span>
                    </div>

                    <div>
                      <span className="label-text font-medium">
                        Media Type:
                      </span>
                      <span className="badge badge-outline ml-2 capitalize">
                        {media.type}
                      </span>
                    </div>

                    <div>
                      <span className="label-text font-medium">
                        Available Titles:
                      </span>
                      <div className="mt-1 space-y-1">
                        {media.title?.contentTitleNative && (
                          <div className="text-sm">
                            <span className="font-medium">Native:</span>{' '}
                            {media.title.contentTitleNative}
                          </div>
                        )}
                        {media.title?.contentTitleEnglish && (
                          <div className="text-sm">
                            <span className="font-medium">English:</span>{' '}
                            {media.title.contentTitleEnglish}
                          </div>
                        )}
                        {media.title?.contentTitleRomaji && (
                          <div className="text-sm">
                            <span className="font-medium">Romaji:</span>{' '}
                            {media.title.contentTitleRomaji}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Technical Details */}
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <MdSpeed className="w-5 h-5" />
                  Technical Details
                </h4>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="label-text font-medium">Log ID:</span>
                    <span className="font-mono text-xs bg-base-300 px-2 py-1 rounded">
                      {log._id}
                    </span>
                  </div>

                  {logUser && (
                    <div className="flex justify-between">
                      <span className="label-text font-medium">User:</span>
                      <span>{logUser}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="label-text font-medium">
                      Content Type:
                    </span>
                    <span className="capitalize">{type}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-action mt-6">
            <form method="dialog" className="w-full">
              <button className="btn btn-outline w-full">Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close modal">close</button>
        </form>
      </dialog>

      {/* Enhanced Delete Confirmation Modal */}
      <dialog
        ref={deleteModalRef}
        className="modal modal-bottom sm:modal-middle"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-description"
      >
        <div className="modal-box border border-error/20">
          <div className="flex gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
              <MdDelete className="text-error" />
            </div>
            <div>
              <h3
                id="delete-modal-title"
                className="font-bold text-lg text-error"
              >
                Delete Log Entry
              </h3>
              <p className="text-sm text-base-content/60">
                This action cannot be undone
              </p>
            </div>
          </div>

          <div className="divider my-4"></div>

          <div id="delete-modal-description" className="space-y-3">
            <p className="text-base-content">
              Are you sure you want to delete this log entry?
            </p>
            <div className="alert alert-warning">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h4 className="font-semibold">"{displayTitle}"</h4>
                <div className="text-sm opacity-80">
                  {xp} XP • {typeConfig.label} • {relativeDate}
                  {readingSpeed && ` • ${readingSpeed} chars/hour`}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-action flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={() => deleteLog(log._id)}
              disabled={loadingDeleteLog}
              className="btn btn-error w-full sm:w-auto order-2 sm:order-1"
            >
              {loadingDeleteLog ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Deleting...
                </>
              ) : (
                <>
                  <MdDelete className="w-4 h-4" />
                  Delete Log
                </>
              )}
            </button>
            <form
              method="dialog"
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              <button className="btn btn-outline w-full" type="submit">
                Cancel
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close modal">close</button>
        </form>
      </dialog>

      {/* Enhanced Edit Log Modal with validation */}
      <dialog ref={editModalRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 ${typeConfig.bgColor} rounded-lg`}>
                <MdEdit className={`w-6 h-6 ${typeConfig.color}`} />
              </div>
              <div>
                <h3 id="edit-modal-title" className="font-bold text-xl">
                  Edit Log Entry
                </h3>
                <p className="text-sm text-base-content/60 mt-1">
                  Modify your log details below
                </p>
              </div>
            </div>
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost">✕</button>
            </form>
          </div>

          <form onSubmit={handleEditSubmit} className="space-y-6">
            {/* Show validation errors */}
            {Object.keys(editErrors).length > 0 && (
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
                  <h4 className="font-bold">
                    Please fix the following errors:
                  </h4>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {Object.entries(editErrors).map(([field, error]) => (
                      <li key={field}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Basic Information Section */}
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h4 className="font-semibold text-lg mb-4">
                  Basic Information
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="label">
                      <span className="label-text font-medium">
                        Description
                      </span>
                      <span className="label-text-alt text-error">*</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      value={editData.description}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Enter description"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text font-medium">Type</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={editData.type}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          type: e.target.value as ILog['type'],
                        })
                      }
                    >
                      <option value="reading">Reading</option>
                      <option value="anime">Anime</option>
                      <option value="vn">Visual Novel</option>
                      <option value="video">Video</option>
                      <option value="manga">Manga</option>
                      <option value="audio">Audio</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text font-medium">Date</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered w-full"
                      value={editData.date}
                      onChange={(e) =>
                        setEditData({ ...editData, date: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Details Section */}
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h4 className="font-semibold text-lg mb-4">Activity Details</h4>

                <div className="space-y-4">
                  {/* Time Section */}
                  <div>
                    <label className="label">
                      <span className="label-text font-medium">Time Spent</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="number"
                          min="0"
                          className="input input-bordered w-full"
                          value={editData.hours}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              hours: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder="Hours"
                        />
                        <div className="label">
                          <span className="label-text-alt">Hours</span>
                        </div>
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="input input-bordered w-full"
                          value={editData.minutes}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              minutes: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder="Minutes"
                        />
                        <div className="label">
                          <span className="label-text-alt">Minutes</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Type-specific fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {editData.type === 'anime' && (
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">
                            Episodes
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="input input-bordered w-full"
                          value={editData.episodes}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              episodes: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder="Number of episodes"
                        />
                      </div>
                    )}

                    {(editData.type === 'reading' ||
                      editData.type === 'vn' ||
                      editData.type === 'manga') && (
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">
                            Characters
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="input input-bordered w-full"
                          value={editData.chars}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              chars: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder="Number of characters"
                        />
                      </div>
                    )}

                    {editData.type === 'manga' && (
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">Pages</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="input input-bordered w-full"
                          value={editData.pages}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              pages: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder="Number of pages"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="modal-action flex-col sm:flex-row gap-3 pt-4">
              <button
                type="submit"
                className="btn btn-primary w-full sm:w-auto order-2 sm:order-1"
                disabled={
                  loadingUpdateLog || Object.keys(editErrors).length > 0
                }
              >
                {loadingUpdateLog ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Updating...
                  </>
                ) : (
                  <>
                    <MdEdit className="w-4 h-4" />
                    Update Log
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-outline w-full sm:w-auto order-1 sm:order-2"
                onClick={() => editModalRef.current?.close()}
                disabled={loadingUpdateLog}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close modal">close</button>
        </form>
      </dialog>
    </>
  );
}

export default LogCard;
