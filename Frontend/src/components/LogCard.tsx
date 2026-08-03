import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ILog, IUpdateLogRequest } from '../types';

import {
  Trash,
  Clock,
  TrendingUp,
  Book,
  BookOpen,
  Play,
  GamepadDirectional,
  Video,
  Volume2,
  Clapperboard,
  MonitorPlay,
  Ellipsis,
  Gauge,
  Calendar,
  Timer,
  Pencil,
  Share2,
  Tag,
} from 'lucide-react';

import {
  deleteLogFn,
  updateLogFn,
  adminDeleteLogFn,
  adminUpdateLogFn,
} from '../api/trackerApi';
import { toast } from 'react-toastify';
import queryClient from '../queryClient';
import { useUserDataStore } from '../store/userData';
import { useRef, useState } from 'react';
import { validateUpdateLogData } from '../utils/validation';
import { useDateFormatting } from '../hooks/useDateFormatting';
import TagSelector from './TagSelector';
import type { ValidationKey } from '../utils/validation';
import { useValidationText } from '../hooks/useValidationText';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../utils/apiError';

/**
 * Module scope, so the label is a key into `common:mediaTypes` rather than
 * text — a literal here would never update on a language change.
 */
const logTypeConfig = {
  reading: {
    labelKey: 'mediaTypes.reading',
    icon: Book,
    color: 'text-[#b34ce6]',
    bgColor: 'bg-[#b34ce6]/10',
    borderColor: 'border-[#b34ce6]/30',
    accentColor: 'bg-[#b34ce6]',
  },
  anime: {
    labelKey: 'mediaTypes.anime',
    icon: Play,
    color: 'text-[#26b2f2]',
    bgColor: 'bg-[#26b2f2]/10',
    borderColor: 'border-[#26b2f2]/30',
    accentColor: 'bg-[#26b2f2]',
  },
  vn: {
    labelKey: 'mediaTypes.vn',
    icon: GamepadDirectional,
    color: 'text-[#3a70e4]',
    bgColor: 'bg-[#3a70e4]/10',
    borderColor: 'border-[#3a70e4]/30',
    accentColor: 'bg-[#3a70e4]',
  },
  game: {
    labelKey: 'mediaTypes.game',
    icon: GamepadDirectional,
    color: 'text-[#59c94e]',
    bgColor: 'bg-[#59c94e]/10',
    borderColor: 'border-[#59c94e]/30',
    accentColor: 'bg-[#59c94e]',
  },
  video: {
    labelKey: 'mediaTypes.video',
    icon: Video,
    color: 'text-[#2cc9a4]',
    bgColor: 'bg-[#2cc9a4]/10',
    borderColor: 'border-[#2cc9a4]/30',
    accentColor: 'bg-[#2cc9a4]',
  },
  manga: {
    labelKey: 'mediaTypes.manga',
    icon: Book,
    color: 'text-[#ee4466]',
    bgColor: 'bg-[#ee4466]/10',
    borderColor: 'border-[#ee4466]/30',
    accentColor: 'bg-[#ee4466]',
  },
  audio: {
    labelKey: 'mediaTypes.audio',
    icon: Volume2,
    color: 'text-[#f2a15a]',
    bgColor: 'bg-[#f2a15a]/10',
    borderColor: 'border-[#f2a15a]/30',
    accentColor: 'bg-[#f2a15a]',
  },
  movie: {
    labelKey: 'mediaTypes.movie',
    icon: Clapperboard,
    color: 'text-[#f77118]',
    bgColor: 'bg-[#f77118]/10',
    borderColor: 'border-[#f77118]/30',
    accentColor: 'bg-[#f77118]',
  },
  'tv show': {
    labelKey: 'mediaTypes.tvShow',
    icon: MonitorPlay,
    color: 'text-[#f8b420]',
    bgColor: 'bg-[#f8b420]/10',
    borderColor: 'border-[#f8b420]/30',
    accentColor: 'bg-[#f8b420]',
  },
  book: {
    labelKey: 'mediaTypes.book',
    icon: BookOpen,
    color: 'text-[#d98c1f]',
    bgColor: 'bg-[#d98c1f]/10',
    borderColor: 'border-[#d98c1f]/30',
    accentColor: 'bg-[#d98c1f]',
  },
  other: {
    labelKey: 'mediaTypes.other',
    icon: Ellipsis,
    color: 'text-[#6b7280]',
    bgColor: 'bg-[#6b7280]/10',
    borderColor: 'border-[#6b7280]/30',
    accentColor: 'bg-[#6b7280]',
  },
} as const;

type EditLogFormState = {
  description: string;
  type: ILog['type'];
  date: string;
  episodes: number;
  volume: number;
  pages: number;
  chars: number;
  hours: number;
  minutes: number;
  tags: string[];
};

// `dateOnly` comes from a native <input type="date"> ("YYYY-MM-DD"). Parsing
// that directly with `new Date()` reads it as UTC midnight, which rolls back
// to the previous day once rendered in a timezone behind UTC. Building the
// date from components keeps it anchored to local midnight instead, and
// carries over the original time-of-day so only the calendar day changes.
function buildEditedDate(dateOnly: string, referenceDate: Date | string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const reference =
    typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  return new Date(
    year,
    month - 1,
    day,
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
    reference.getMilliseconds()
  );
}

function extractTagIds(tags?: ILog['tags']): string[] {
  if (!tags) return [];

  return (tags as Array<string | { _id?: string }>)
    .map((tag) => {
      if (typeof tag === 'string') return tag;
      return tag?._id ?? '';
    })
    .filter((id): id is string => Boolean(id));
}

function LogCard({
  log,
  user: logUser,
  selectionMode = false,
}: {
  log: ILog;
  user?: string;
  selectionMode?: boolean;
}) {
  const { t } = useTranslation(['logs', 'common']);
  const vt = useValidationText();
  const {
    description,
    xp,
    xpBreakdown,
    date,
    type,
    episodes,
    volume,
    pages,
    time,
    chars,
    media,
    manabeId,
    unknownDate,
  } = log;
  const { user } = useUserDataStore();
  const { formatRelativeDate, formatDateTime, formatNumber } =
    useDateFormatting();

  /** "1h 30m" in English, "1 h 30 min" in Spanish. */
  const formatDuration = (minutes: number) =>
    minutes >= 60
      ? t('card.hoursMinutes', {
          hours: Math.floor(minutes / 60),
          minutes: minutes % 60,
        })
      : t('card.minutesOnly', { minutes });
  const deleteModalRef = useRef<HTMLDialogElement>(null);
  const editModalRef = useRef<HTMLDialogElement>(null);
  const detailsModalRef = useRef<HTMLDialogElement>(null);
  const isOwner = logUser === user?.username;
  const isAdmin = user?.roles?.includes('admin');
  const shouldUseAdminLogEndpoints = isAdmin && !isOwner;

  const buildEditState = (): EditLogFormState => ({
    description: description || '',
    type,
    date: date
      ? typeof date === 'string'
        ? date.split('T')[0]
        : new Date(date).toISOString().split('T')[0]
      : '',
    episodes: episodes || 0,
    volume: volume || 0,
    pages: pages || 0,
    chars: chars || 0,
    hours: time ? Math.floor(time / 60) : 0,
    minutes: time ? time % 60 : 0,
    tags: extractTagIds(log.tags),
  });

  // Edit form state with all editable fields
  const [editData, setEditData] = useState<EditLogFormState>(() =>
    buildEditState()
  );
  const [editErrors, setEditErrors] = useState<Record<string, ValidationKey>>(
    {}
  );

  const typeConfig = logTypeConfig[type];
  const TypeIcon = typeConfig.icon;
  const typeLabel = t(typeConfig.labelKey, { ns: 'common' });

  const relativeDate = unknownDate
    ? t('card.unknown')
    : date
      ? formatRelativeDate(date)
      : '';
  const fullDate = unknownDate
    ? t('card.unknownDate')
    : date
      ? formatDateTime(date)
      : '';

  const logTitle =
    media && typeof media === 'object' && media.title?.contentTitleNative
      ? media.title.contentTitleNative
      : description || t('card.untitled');

  const displayTitle =
    logTitle.length > 35 ? `${logTitle.slice(0, 35)}...` : logTitle;

  const { mutate: deleteLog, isPending: loadingDeleteLog } = useMutation({
    mutationFn: (id: string) =>
      shouldUseAdminLogEndpoints ? adminDeleteLogFn(id) : deleteLogFn(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (!Array.isArray(key)) return false;
          return key.some((k) => k === 'logs' || k === 'user');
        },
      });
      queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
      toast.success(t('toast.deleted'));
      deleteModalRef.current?.close();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const { mutate: updateLog, isPending: loadingUpdateLog } = useMutation({
    mutationFn: (data: IUpdateLogRequest) =>
      shouldUseAdminLogEndpoints
        ? adminUpdateLogFn(log._id, data)
        : updateLogFn(log._id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (!Array.isArray(key)) return false;
          return key.some((k) => k === 'logs' || k === 'user');
        },
      });
      queryClient.invalidateQueries({ queryKey: ['dailyGoals'] });
      toast.success(t('toast.updated'));
      editModalRef.current?.close();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  function openEditModal() {
    setEditErrors({});
    setEditData(buildEditState());
    editModalRef.current?.showModal();
  }

  function openDetailsModal() {
    detailsModalRef.current?.showModal();
  }

  function handleEditSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    const validation = validateUpdateLogData({
      description: editData.description,
      type: editData.type,
      hours: editData.hours,
      minutes: editData.minutes,
      episodes: editData.episodes,
      volume: editData.volume,
      chars: editData.chars,
      pages: editData.pages,
    });

    setEditErrors(validation.errors);

    if (!validation.isValid) {
      toast.error(t('toast.fixValidation'));
      return;
    }

    const totalMinutes = editData.hours * 60 + editData.minutes;

    // Check if the date was actually changed (compare date-only strings)
    const originalDateString = date
      ? typeof date === 'string'
        ? date.split('T')[0]
        : new Date(date).toISOString().split('T')[0]
      : '';
    const hasDateChanged = editData.date !== originalDateString;

    const updateData: IUpdateLogRequest = {
      description: editData.description,
      type: editData.type,
      // Only include date if it was changed; keep the original time-of-day and
      // just move the calendar day (built in local time, not UTC — see buildEditedDate).
      date:
        hasDateChanged && editData.date
          ? buildEditedDate(editData.date, date ?? new Date())
          : undefined,
      time: totalMinutes || undefined,
      episodes: editData.episodes || undefined,
      volume: editData.volume || undefined,
      pages: editData.pages || undefined,
      chars: editData.chars || undefined,
      tags: editData.tags,
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof IUpdateLogRequest] === undefined) {
        delete updateData[key as keyof IUpdateLogRequest];
      }
    });

    updateLog(updateData);
  }

  function preventNegativeValues(e: React.InputEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    if (input.valueAsNumber < 0) {
      input.value = '0';
    }
  }

  function getQuantityInfo() {
    const info: {
      label: string;
      value: string | number;
      icon?: React.ElementType;
      tooltip?: string;
    }[] = [];

    if ((type === 'anime' || type === 'tv show') && episodes) {
      info.push({
        label: t('card.metrics.episodes'),
        value: episodes,
        icon: Play,
        tooltip: time
          ? t('card.tooltips.episodesWithTime', { episodes, time })
          : t('card.tooltips.episodesWatched', { episodes }),
      });
    } else if (type === 'manga' || type === 'book') {
      if (pages) {
        info.push({
          label: t('card.metrics.pages'),
          value: pages,
          icon: Book,
          tooltip: chars
            ? t('card.tooltips.pagesWithChars', {
                pages,
                chars: formatNumber(chars),
              })
            : t('card.tooltips.pagesRead', { pages }),
        });
      }
      if (chars) {
        const readingSpeed =
          time && chars ? Math.round((chars / time) * 60) : null;
        info.push({
          label: t('card.metrics.characters'),
          value: formatNumber(chars),
          icon: Book,
          tooltip: readingSpeed
            ? t('card.tooltips.charsWithSpeed', {
                chars: formatNumber(chars),
                time,
                speed: readingSpeed,
              })
            : t('card.tooltips.charsRead', { chars: formatNumber(chars) }),
        });

        if (readingSpeed && time) {
          info.push({
            label: t('card.metrics.speed'),
            value: t('card.speedValue', { speed: readingSpeed }),
            icon: Gauge,
            tooltip: t('card.tooltips.readingSpeed', { speed: readingSpeed }),
          });
        }

        if (time) {
          const timeStr = formatDuration(time);
          info.push({
            label: t('card.metrics.time'),
            value: timeStr,
            icon: Timer,
            tooltip: t('card.tooltips.minutesManga', { time }),
          });
        }
      } else if (time && !chars) {
        const timeStr = formatDuration(time);
        info.push({
          label: t('card.metrics.time'),
          value: timeStr,
          icon: Clock,
          tooltip: t('card.tooltips.minutesReading', { time }),
        });
      }
    } else if (type === 'vn' || type === 'game' || type === 'reading') {
      if (chars) {
        const readingSpeed =
          time && chars ? Math.round((chars / time) * 60) : null;
        info.push({
          label: t('card.metrics.characters'),
          value: formatNumber(chars),
          icon: Book,
          tooltip: readingSpeed
            ? t('card.tooltips.charsWithSpeed', {
                chars: formatNumber(chars),
                time,
                speed: readingSpeed,
              })
            : t('card.tooltips.charsRead', { chars: formatNumber(chars) }),
        });

        if (readingSpeed && time) {
          info.push({
            label: t('card.metrics.speed'),
            value: t('card.speedValue', { speed: readingSpeed }),
            icon: Gauge,
            tooltip: t('card.tooltips.readingSpeed', { speed: readingSpeed }),
          });
        }

        if (time) {
          const timeStr = formatDuration(time);
          info.push({
            label: t('card.metrics.time'),
            value: timeStr,
            icon: Timer,
            tooltip: t('card.tooltips.minutesReading', { time }),
          });
        }
      } else if (time && !chars) {
        const timeStr = formatDuration(time);
        info.push({
          label: t('card.metrics.time'),
          value: timeStr,
          icon: Clock,
          tooltip: t('card.tooltips.minutesReading', { time }),
        });
      }
    } else if (
      (type === 'video' || type === 'audio' || type === 'movie') &&
      time
    ) {
      const timeStr = formatDuration(time);
      info.push({
        label: t('card.metrics.time'),
        value: timeStr,
        icon: Clock,
        tooltip: t('card.tooltips.minutesOfType', {
          time,
          type: typeLabel.toLowerCase(),
        }),
      });
    }

    return info;
  }

  function getReadingSpeed() {
    if (
      (type === 'reading' ||
        type === 'vn' ||
        type === 'game' ||
        type === 'book') &&
      chars &&
      time &&
      time > 0
    ) {
      return Math.round((chars / time) * 60);
    }
    return null;
  }

  const quantityInfo = getQuantityInfo();
  const canModerateLog = isOwner || isAdmin;
  const readingSpeed = getReadingSpeed();

  // Difficulty bonus: XP earned above the time-based base because the content
  // was hard relative to the user's comfort. Only present (and only worth
  // surfacing) when the multiplier actually pushed XP above baseXp.
  const difficultyBonus =
    xpBreakdown && xpBreakdown.baseXp > 0 && xp > xpBreakdown.baseXp
      ? xp - xpBreakdown.baseXp
      : 0;
  const bonusMultiplier = difficultyBonus
    ? `x${xpBreakdown!.multiplier.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`
    : '';
  const xpTooltip =
    difficultyBonus > 0
      ? `Experience gained: ${xp} points (${xpBreakdown!.baseXp} base + ${difficultyBonus} difficulty bonus, ${bonusMultiplier})`
      : `Experience gained: ${xp} points`;

  function handleShare() {
    const shareUrl = `${window.location.origin}/shared-log/${log._id}`;

    if (navigator.share) {
      // Use native sharing if available
      navigator
        .share({
          title: `Check out this ${typeLabel} log: ${logTitle}`,
          text: `I logged "${logTitle}" and thought you might want to create a similar log!`,
          url: shareUrl,
        })
        .catch(() => {
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
        toast.success(t('toast.linkCopied'));
      })
      .catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success(t('toast.linkCopied'));
      });
  }

  return (
    <>
      <article
        className={`card bg-base-100 shadow-sm hover:shadow-md transition-all duration-300 border ${typeConfig.borderColor} group rounded-t-none`}
        role="article"
        aria-label={`Log entry: ${logTitle}`}
      >
        {/* Header with type indicator */}
        <div className={`h-1 w-full ${typeConfig.accentColor}`}></div>

        <div className="card-body p-4 space-y-3">
          {/* Header Section */}
          <header className="flex justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className={`badge badge-outline ${typeConfig.color} gap-1 shrink-0`}
              >
                <TypeIcon className="w-3 h-3" />
                <span className="text-xs font-medium">{typeLabel}</span>
              </div>

              <div className="min-w-0 flex-1">
                {media &&
                typeof media === 'object' &&
                media.contentId &&
                media.type ? (
                  <Link
                    to={`/${encodeURIComponent(media.type)}/${media.contentId}${logUser ? `/${encodeURIComponent(logUser)}` : ''}`}
                    className="font-bold text-base leading-tight text-base-content group-hover:text-primary transition-colors duration-200 no-underline hover:no-underline"
                    title={logTitle}
                  >
                    {displayTitle}
                  </Link>
                ) : (
                  <h2
                    className="font-bold text-base leading-tight text-base-content group-hover:text-primary transition-colors duration-200"
                    title={logTitle}
                  >
                    {displayTitle}
                  </h2>
                )}

                {/* Media English title */}
                {media &&
                  typeof media === 'object' &&
                  media.title?.contentTitleEnglish && (
                    <p className="text-sm text-base-content/60 mt-1 leading-tight">
                      {media.title.contentTitleEnglish.length > 45
                        ? `${media.title.contentTitleEnglish.slice(0, 45)}...`
                        : media.title.contentTitleEnglish}
                    </p>
                  )}

                {/* Description - show when it exists and is different from both native and english titles */}
                {description &&
                  description.trim() !== '' &&
                  description !== logTitle &&
                  (!(
                    media &&
                    typeof media === 'object' &&
                    media.title?.contentTitleEnglish
                  ) ||
                    description !== media.title.contentTitleEnglish) && (
                    <p className="text-sm text-base-content/60 mt-1 leading-tight">
                      {description.length > 45
                        ? `${description.slice(0, 45)}...`
                        : description}
                    </p>
                  )}
              </div>
            </div>

            {canModerateLog && !selectionMode && (
              <div className="dropdown dropdown-end">
                <button
                  tabIndex={0}
                  className="btn btn-ghost btn-sm btn-circle opacity-100 hover:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-200"
                  aria-label={t('card.a11y.options')}
                >
                  <Ellipsis className="w-4 h-4" />
                </button>
                <ul className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-32 border border-base-300 z-50">
                  <li>
                    <button
                      onClick={handleShare}
                      className="text-success hover:bg-success/10 gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      {t('card.share')}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={openDetailsModal}
                      className="text-info hover:bg-info/10 gap-2"
                    >
                      <Book className="w-4 h-4" />
                      {t('card.details')}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={openEditModal}
                      className="text-warning hover:bg-warning/10 gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      {t('card.edit')}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => deleteModalRef.current?.showModal()}
                      className="text-error hover:bg-error/10 gap-2"
                    >
                      <Trash className="w-4 h-4" />
                      {t('card.delete')}
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
                  className={`tooltip ${info.tooltip ? 'tooltip-left md:tooltip-bottom' : ''}`}
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

          {/* Tags */}
          {log.tags && log.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {log.tags.map((tag) => {
                const tagData = typeof tag === 'object' ? tag : null;
                if (!tagData) return null;

                return (
                  <span
                    key={tagData._id}
                    className="badge badge-sm"
                    style={{
                      backgroundColor: `${tagData.color}20`,
                      border: `2px solid ${tagData.color}`,
                      color: tagData.color,
                    }}
                  >
                    {tagData.name}
                  </span>
                );
              })}
            </div>
          )}

          {/* Footer Section with enhanced information */}
          <footer className="flex justify-between items-center pt-2 border-t border-base-300">
            <div className="flex items-center gap-2">
              <div
                className={`tooltip tooltip-left md:tooltip-top`}
                data-tip={xpTooltip}
              >
                <div
                  className={`badge badge-outline ${typeConfig.color} gap-1`}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-xs font-bold">{xp} XP</span>
                  {difficultyBonus > 0 && (
                    <span className="text-[0.65rem] font-semibold opacity-70">
                      {bonusMultiplier}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="tooltip tooltip-left" data-tip={fullDate}>
              <time
                className="text-xs text-base-content/60 hover:text-base-content transition-colors duration-200 cursor-help flex items-center gap-1"
                dateTime={
                  !unknownDate && date
                    ? typeof date === 'string'
                      ? date
                      : date.toISOString()
                    : undefined
                }
              >
                <Calendar className="w-3 h-3" />
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
                  {t('details.title')}
                </h3>
                <div className={`badge ${typeConfig.color} gap-1 mt-1`}>
                  <TypeIcon className="w-3 h-3" />
                  {typeLabel}
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
                  <Book className="w-5 h-5" />
                  {t('details.contentInfo')}
                </h4>

                <div className="space-y-3">
                  <div>
                    <span className="label-text font-medium">
                      {t('details.titleLabel')}
                    </span>
                    <p className="text-base-content mt-1">{logTitle}</p>
                  </div>

                  {media &&
                    typeof media === 'object' &&
                    media.title?.contentTitleEnglish && (
                      <div>
                        <span className="label-text font-medium">
                          {t('details.englishTitle')}
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
                          {t('details.romajiTitle')}
                        </span>
                        <p className="text-base-content mt-1">
                          {media.title.contentTitleRomaji}
                        </p>
                      </div>
                    )}

                  {description && description !== logTitle && (
                    <div>
                      <span className="label-text font-medium">
                        {t('details.descriptionLabel')}
                      </span>
                      <p className="text-base-content mt-1">{description}</p>
                    </div>
                  )}

                  {media && typeof media === 'object' && media.type && (
                    <div>
                      <span className="label-text font-medium">
                        {t('details.mediaType')}
                      </span>
                      <span className="badge badge-outline ml-2 capitalize">
                        {media.type === 'vn'
                          ? t('common:mediaTypes.vn')
                          : media.type === 'game'
                            ? t('common:mediaTypes.game')
                            : media.type === 'reading'
                              ? t('details.lightNovel')
                              : media.type}
                      </span>
                    </div>
                  )}

                  {media && typeof media === 'object' && media.contentId && (
                    <div>
                      <span className="label-text font-medium">
                        {t('details.contentId')}
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
                  <TrendingUp className="w-5 h-5" />
                  {t('details.activityStats')}
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="stat bg-base-100 rounded-lg p-3">
                    <div className="stat-title text-xs">
                      {t('details.xpGained')}
                    </div>
                    <div className={`stat-value text-2xl ${typeConfig.color}`}>
                      {xp}
                    </div>
                    <div className="stat-desc">{t('details.xpPoints')}</div>
                  </div>

                  {time && time > 0 ? (
                    <div className="stat bg-base-100 rounded-lg p-3">
                      <div className="stat-title text-xs">
                        {t('details.timeSpent')}
                      </div>
                      <div className="stat-value text-2xl text-info">
                        {formatDuration(time)}
                      </div>
                      <div className="stat-desc">{time} minutes</div>
                    </div>
                  ) : null}

                  {episodes ? (
                    <div className="stat bg-base-100 rounded-lg p-3">
                      <div className="stat-title text-xs">
                        {t('details.episodes')}
                      </div>
                      <div className="stat-value text-2xl text-secondary">
                        {episodes}
                      </div>
                      <div className="stat-desc">{t('details.watched')}</div>
                    </div>
                  ) : null}

                  {pages && pages > 0 ? (
                    <div className="stat bg-base-100 rounded-lg p-3">
                      <div className="stat-title text-xs">
                        {t('details.pages')}
                      </div>
                      <div className="stat-value text-2xl text-warning">
                        {pages}
                      </div>
                      <div className="stat-desc">{t('details.read')}</div>
                    </div>
                  ) : null}

                  {chars ? (
                    <div className="stat bg-base-100 rounded-lg p-3">
                      <div className="stat-title text-xs">
                        {t('details.characters')}
                      </div>
                      <div className="stat-value text-lg text-accent">
                        {formatNumber(chars)}
                      </div>
                      <div className="stat-desc">{t('details.read')}</div>
                    </div>
                  ) : null}

                  {readingSpeed && (
                    <div className="stat bg-base-100 rounded-lg p-3">
                      <div className="stat-title text-xs">
                        {t('details.readingSpeed')}
                      </div>
                      <div className="stat-value text-xl text-success">
                        {readingSpeed}
                      </div>
                      <div className="stat-desc">chars/hour</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tags */}
            {log.tags && log.tags.length > 0 && (
              <div className="card bg-base-200 shadow-sm">
                <div className="card-body p-4">
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    {t('details.tags')}
                  </h4>

                  <div className="flex flex-wrap gap-2">
                    {log.tags.map((tag) => {
                      const tagData = typeof tag === 'object' ? tag : null;
                      if (!tagData) return null;

                      return (
                        <span
                          key={tagData._id}
                          className="badge badge-lg"
                          style={{
                            backgroundColor: `${tagData.color}20`,
                            border: `2px solid ${tagData.color}`,
                            color: tagData.color,
                          }}
                        >
                          {tagData.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Date and Time Information */}
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {t('details.dateAndTime')}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="label-text font-medium">
                      {t('details.created')}
                    </span>
                    <p className="text-base-content mt-1">{fullDate}</p>
                    {!unknownDate ? (
                      <p className="text-sm text-base-content/60">
                        {relativeDate}
                      </p>
                    ) : null}
                  </div>

                  {time ? (
                    <div>
                      <span className="label-text font-medium">
                        {t('details.duration')}
                      </span>
                      <p className="text-base-content mt-1">
                        {time >= 60
                          ? `${Math.floor(time / 60)} hour${Math.floor(time / 60) !== 1 ? 's' : ''} and ${time % 60} minute${time % 60 !== 1 ? 's' : ''}`
                          : `${time} minute${time !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Media Details (if available) */}
            {media && typeof media === 'object' && (
              <div className="card bg-base-200 shadow-sm">
                <div className="card-body p-4">
                  <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    {t('details.mediaDetails')}
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <span className="label-text font-medium">
                        {t('details.contentId')}
                      </span>
                      <span className="font-mono text-xs bg-base-300 px-2 py-1 rounded ml-2">
                        {media.contentId}
                      </span>
                    </div>

                    <div>
                      <span className="label-text font-medium">
                        {t('details.mediaType')}
                      </span>
                      <span className="badge badge-outline ml-2 capitalize">
                        {media.type === 'vn'
                          ? t('common:mediaTypes.vn')
                          : media.type === 'game'
                            ? t('common:mediaTypes.game')
                            : media.type === 'reading'
                              ? t('details.lightNovel')
                              : media.type}
                      </span>
                    </div>

                    <div>
                      <span className="label-text font-medium">
                        {t('details.availableTitles')}
                      </span>
                      <div className="mt-1 space-y-1">
                        {media.title?.contentTitleNative && (
                          <div className="text-sm">
                            <span className="font-medium">
                              {t('details.native')}
                            </span>{' '}
                            {media.title.contentTitleNative}
                          </div>
                        )}
                        {media.title?.contentTitleEnglish && (
                          <div className="text-sm">
                            <span className="font-medium">
                              {t('details.english')}
                            </span>{' '}
                            {media.title.contentTitleEnglish}
                          </div>
                        )}
                        {media.title?.contentTitleRomaji && (
                          <div className="text-sm">
                            <span className="font-medium">
                              {t('details.romaji')}
                            </span>{' '}
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
                  <Gauge className="w-5 h-5" />
                  {t('details.technical')}
                </h4>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="label-text font-medium">
                      {t('details.logId')}
                    </span>
                    <span className="font-mono text-xs bg-base-300 px-2 py-1 rounded">
                      {log._id}
                    </span>
                  </div>

                  {logUser ? (
                    <div className="flex justify-between">
                      <span className="label-text font-medium">
                        {t('details.user')}
                      </span>
                      <span>{logUser}</span>
                    </div>
                  ) : null}

                  {manabeId ? (
                    <div className="flex justify-between">
                      <span className="label-text font-medium">
                        {t('details.manabeId')}
                      </span>
                      <span>{manabeId}</span>
                    </div>
                  ) : null}

                  <div className="flex justify-between">
                    <span className="label-text font-medium">
                      {t('details.contentType')}
                    </span>
                    <span className="capitalize">
                      {type === 'vn'
                        ? 'visual novel'
                        : type === 'game'
                          ? 'video game'
                          : type === 'reading'
                            ? 'light novel'
                            : type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-action mt-6">
            <form method="dialog" className="w-full">
              <button className="btn btn-outline w-full">
                {t('common.close')}
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label={t('common.a11y.closeModal')}>close</button>
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
              <Trash className="text-error" />
            </div>
            <div>
              <h3
                id="delete-modal-title"
                className="font-bold text-lg text-error"
              >
                {t('delete.title')}
              </h3>
              <p className="text-sm text-base-content/60">
                {t('delete.irreversible')}
              </p>
            </div>
          </div>

          <div className="divider my-4"></div>

          <div id="delete-modal-description" className="space-y-3">
            <p className="text-base-content">{t('delete.confirm')}</p>
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
                  {xp} XP • {typeLabel} • {relativeDate}
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
                  {t('delete.deleting')}
                </>
              ) : (
                <>
                  <Trash className="w-4 h-4" />
                  {t('delete.confirmButton')}
                </>
              )}
            </button>
            <form
              method="dialog"
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              <button className="btn btn-outline w-full" type="submit">
                {t('common.cancel')}
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label={t('common.a11y.closeModal')}>close</button>
        </form>
      </dialog>

      {/* Enhanced Edit Log Modal with validation */}
      <dialog ref={editModalRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 ${typeConfig.bgColor} rounded-lg`}>
                <Pencil className={`w-6 h-6 ${typeConfig.color}`} />
              </div>
              <div>
                <h3 id="edit-modal-title" className="font-bold text-xl">
                  {t('edit.title')}
                </h3>
                <p className="text-sm text-base-content/60 mt-1">
                  {t('edit.subtitle')}
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
                  <h4 className="font-bold">{t('edit.fixErrors')}</h4>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {Object.entries(editErrors).map(([field, error]) => (
                      <li key={field}>{vt(error)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Basic Information Section */}
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h4 className="font-semibold text-lg mb-4">
                  {t('edit.basicInfo')}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="label">
                      <span className="label-text font-medium">
                        {t('edit.description')}
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
                      placeholder={t('edit.descriptionPlaceholder')}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text font-medium">
                        {t('edit.type')}
                      </span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={editData.type}
                      onChange={(e) => {
                        const nextType = e.target.value as ILog['type'];
                        setEditData((prev) => ({
                          ...prev,
                          type: nextType,
                          episodes: nextType === 'anime' ? prev.episodes : 0,
                          chars: [
                            'reading',
                            'vn',
                            'game',
                            'manga',
                            'book',
                          ].includes(nextType)
                            ? prev.chars
                            : 0,
                          volume: ['manga', 'reading'].includes(nextType)
                            ? prev.volume
                            : 0,
                          pages: ['manga', 'book'].includes(nextType)
                            ? prev.pages
                            : 0,
                        }));
                      }}
                    >
                      <option value="reading">
                        {t('common:mediaTypes.reading')}
                      </option>
                      <option value="anime">
                        {t('common:mediaTypes.anime')}
                      </option>
                      <option value="vn">{t('common:mediaTypes.vn')}</option>
                      <option value="game">
                        {t('common:mediaTypes.game')}
                      </option>
                      <option value="video">
                        {t('common:mediaTypes.video')}
                      </option>
                      <option value="manga">
                        {t('common:mediaTypes.manga')}
                      </option>
                      <option value="book">
                        {t('common:mediaTypes.book')}
                      </option>
                      <option value="audio">
                        {t('common:mediaTypes.audio')}
                      </option>
                      <option value="movie">
                        {t('common:mediaTypes.movie')}
                      </option>
                      <option value="tv show">
                        {t('common:mediaTypes.tvShow')}
                      </option>
                      <option value="other">
                        {t('common:mediaTypes.other')}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="label">
                      <span className="label-text font-medium">
                        {t('edit.date')}
                      </span>
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
                <h4 className="font-semibold text-lg mb-4">
                  {t('edit.activityDetails')}
                </h4>

                <div className="space-y-4">
                  {/* Time Section */}
                  <div>
                    <label className="label">
                      <span className="label-text font-medium">
                        {t('details.timeSpent')}
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="number"
                          min="0"
                          className="input input-bordered w-full"
                          value={editData.hours || ''}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              hours: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder={t('card.hoursPlaceholder')}
                        />
                        <div className="label">
                          <span className="label-text-alt">
                            {t('edit.hours')}
                          </span>
                        </div>
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          className="input input-bordered w-full"
                          value={editData.minutes || ''}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              minutes: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder={t('card.minutesPlaceholder')}
                        />
                        <div className="label">
                          <span className="label-text-alt">
                            {t('edit.minutes')}
                          </span>
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
                            {t('details.episodes')}
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="input input-bordered w-full"
                          value={editData.episodes || ''}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              episodes: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder={t('edit.episodesPlaceholder')}
                        />
                      </div>
                    )}

                    {(editData.type === 'reading' ||
                      editData.type === 'vn' ||
                      editData.type === 'game' ||
                      editData.type === 'manga' ||
                      editData.type === 'book') && (
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">
                            {t('details.characters')}
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="input input-bordered w-full"
                          value={editData.chars || ''}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              chars: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder={t('edit.charsPlaceholder')}
                        />
                      </div>
                    )}

                    {(editData.type === 'manga' ||
                      editData.type === 'reading') && (
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">
                            {t('edit.volume')}
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="input input-bordered w-full"
                          value={editData.volume || ''}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              volume: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder={t('edit.volumePlaceholder')}
                        />
                      </div>
                    )}

                    {(editData.type === 'manga' ||
                      editData.type === 'book') && (
                      <div>
                        <label className="label">
                          <span className="label-text font-medium">
                            {t('details.pages')}
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="input input-bordered w-full"
                          value={editData.pages || ''}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              pages: Number(e.target.value),
                            })
                          }
                          onInput={preventNegativeValues}
                          placeholder={t('edit.pagesPlaceholder')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tags Section */}
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  {t('details.tags')}
                </h4>
                <TagSelector
                  selectedTags={editData.tags}
                  onChange={(tags) =>
                    setEditData((prev) => ({
                      ...prev,
                      tags,
                    }))
                  }
                  label="Tags (optional)"
                />
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
                    {t('edit.updating')}
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" />
                    {t('edit.update')}
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-outline w-full sm:w-auto order-1 sm:order-2"
                onClick={() => editModalRef.current?.close()}
                disabled={loadingUpdateLog}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label={t('common.a11y.closeModal')}>close</button>
        </form>
      </dialog>
    </>
  );
}

export default LogCard;
