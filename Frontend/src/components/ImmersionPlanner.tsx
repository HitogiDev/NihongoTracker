import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Pencil, Target, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  deleteImmersionForecastFn,
  getImmersionListFn,
  getImmersionForecastsFn,
  multiSearchMediaFn,
} from '../api/trackerApi';
import {
  IImmersionForecast,
  IMediaDocument,
  SearchResultType,
} from '../types';
import { useUserDataStore } from '../store/userData';
import { getApiErrorMessage } from '../utils/apiError';
import Button from './ui/Button';
import { buttonClass } from './ui/buttons';
import ForecastModal from './ForecastModal';
import Modal from './ui/Modal';

const STATUS_CLASS = {
  on_track: 'badge badge-success badge-sm',
  behind: 'badge badge-warning badge-sm',
  completed: 'badge badge-success badge-sm',
  overdue: 'badge badge-error badge-sm',
} as const;

const FALLBACK_SEARCHES = [
  'Frieren',
  'Yotsuba',
  'Steins;Gate',
  'Spirited Away',
];

const FALLBACK_PREVIEWS: SearchResultType[] = [
  {
    _id: 'preview-frieren',
    contentId: '154587',
    title: {
      contentTitleNative: '葬送のフリーレン',
      contentTitleEnglish: 'Frieren: Beyond Journey’s End',
    },
    type: 'anime',
    episodes: 28,
    episodeDuration: 24,
    isAdult: false,
  },
  {
    _id: 'preview-yotsuba',
    contentId: 'preview-yotsuba',
    title: { contentTitleNative: 'よつばと!', contentTitleEnglish: 'Yotsuba&!' },
    type: 'manga',
    pageCount: 224,
    isAdult: false,
  },
];

type PreviewMetric = 'chars' | 'episodes' | 'minutes' | 'pages';

function displayMediaTitle(media: SearchResultType): string {
  return (
    media.title.contentTitleNative ||
    media.title.contentTitleRomaji ||
    media.title.contentTitleEnglish ||
    ''
  );
}

function previewTarget(media: SearchResultType): {
  metric: PreviewMetric;
  total: number;
} {
  if (media.characters && media.characters > 0) {
    return { metric: 'chars', total: media.characters };
  }
  if ((media.type === 'anime' || media.type === 'tv show') && media.episodes) {
    return { metric: 'episodes', total: media.episodes };
  }
  if (media.pageCount && media.pageCount > 0) {
    return { metric: 'pages', total: media.pageCount };
  }
  if (media.runtime && media.runtime > 0) {
    return { metric: 'minutes', total: media.runtime };
  }
  if (media.type === 'anime' || media.type === 'tv show') {
    return { metric: 'episodes', total: 24 };
  }
  if (media.type === 'movie') return { metric: 'minutes', total: 120 };
  if (media.type === 'game') return { metric: 'minutes', total: 2400 };
  if (media.type === 'vn') return { metric: 'chars', total: 500000 };
  return { metric: 'pages', total: 320 };
}

function previewEstimatedMinutes(
  media: SearchResultType,
  metric: PreviewMetric,
  remaining: number
): number {
  if (metric === 'chars') return Math.round((remaining / 14800) * 60);
  if (metric === 'episodes') return remaining * (media.episodeDuration || 24);
  if (metric === 'pages') return remaining * 2;
  return remaining;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

export default function ImmersionPlanner() {
  const { t } = useTranslation('goals');
  const queryClient = useQueryClient();
  const { user } = useUserDataStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<IImmersionForecast | undefined>();
  const [pendingDelete, setPendingDelete] = useState<IImmersionForecast>();
  const [fallbackIndex] = useState(() =>
    Math.floor(Math.random() * FALLBACK_SEARCHES.length)
  );
  const { data, isLoading } = useQuery({
    queryKey: ['immersionForecasts'],
    queryFn: getImmersionForecastsFn,
  });
  const showLockedPreview = Boolean(
    data && !data.canManage && !data.forecasts.length
  );
  const { data: previewList, isLoading: previewListLoading } = useQuery({
    queryKey: ['immersionPlannerPreviewList', user?.username],
    queryFn: () =>
      getImmersionListFn(user!.username, { status: 'in_progress' }),
    enabled: showLockedPreview && Boolean(user?.username),
    staleTime: 30 * 1000,
  });
  const currentMedia = previewList
    ? (Object.values(previewList).flat() as IMediaDocument[])
        .filter(
          (media) =>
            media.mediaStatus === 'in_progress' && media.type !== 'video'
        )
        .sort(
          (first, second) =>
            new Date(second.lastLogDate || 0).getTime() -
            new Date(first.lastLogDate || 0).getTime()
        )[0]
    : undefined;
  const fallbackSearch = FALLBACK_SEARCHES[fallbackIndex];
  const { data: fallbackResults, isLoading: fallbackLoading } = useQuery({
    queryKey: ['immersionPlannerPreviewFallback', fallbackSearch],
    queryFn: () => multiSearchMediaFn({ search: fallbackSearch, perPage: 6 }),
    enabled: showLockedPreview && !previewListLoading && !currentMedia,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const previewMedia =
    currentMedia ||
    fallbackResults?.find(
      (media) =>
        media.type !== 'video' &&
        !media.isAdult &&
        Boolean(media.contentImage || media.coverImage)
    ) ||
    fallbackResults?.find(
      (media) => media.type !== 'video' && !media.isAdult
    ) ||
    FALLBACK_PREVIEWS[fallbackIndex % FALLBACK_PREVIEWS.length];
  const remove = useMutation({
    mutationFn: deleteImmersionForecastFn,
    onSuccess: () => {
      setPendingDelete(undefined);
      return queryClient.invalidateQueries({ queryKey: ['immersionForecasts'] });
    },
  });

  if (isLoading) {
    return <div className="skeleton h-40 w-full" />;
  }

  const preview = previewTarget(previewMedia);
  const previewRemaining = Math.ceil(preview.total * 0.72);
  const previewDaily = Math.ceil(previewRemaining / 30);
  const previewMinutes = previewEstimatedMinutes(
    previewMedia,
    preview.metric,
    previewRemaining
  );
  const previewDate = new Date();
  previewDate.setDate(previewDate.getDate() + 30);

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Target className="w-6 h-6 text-secondary shrink-0" />
            <h2 className="text-2xl leading-tight font-bold tracking-tight">
              {t('forecast.title')}
            </h2>
            <span className="badge badge-secondary badge-sm">Enthusiast+</span>
          </div>
          <p className="text-sm leading-relaxed text-base-content/60 mt-1.5">
            {t('forecast.subtitle')}
          </p>
        </div>
        {data?.canManage && (
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            {t('forecast.new')}
          </Button>
        )}
      </div>

      {!data?.canManage && !data?.forecasts.length && (
        <div className="card surface card-sm overflow-hidden">
          <div className="card-body gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              {previewMedia.contentImage || previewMedia.coverImage ? (
                <img
                  src={previewMedia.contentImage || previewMedia.coverImage}
                  alt=""
                  className="w-16 h-22 object-cover rounded-field shrink-0"
                />
              ) : (
                <div className="surface-muted w-16 h-22 flex items-center justify-center shrink-0">
                  <Target className="w-6 h-6 text-secondary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-secondary badge-sm">
                    {t('forecast.previewLabel')}
                  </span>
                  <span className="badge badge-success badge-sm">
                    {t('forecast.status.on_track')}
                  </span>
                </div>
                <h3 className="font-bold text-lg leading-snug mt-2 truncate">
                  {displayMediaTitle(previewMedia)}
                </h3>
                <p className="text-xs text-base-content/60 mt-1 flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5" />
                  {t('forecast.previewDeadline', {
                    date: previewDate.toLocaleDateString(),
                  })}
                </p>
              </div>
            </div>

            {previewListLoading || fallbackLoading ? (
              <div className="skeleton h-2 w-full" />
            ) : (
              <progress
                className="progress progress-primary w-full"
                value="28"
                max="100"
              />
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-base-content/60">{t('forecast.remaining')}</p>
                <p className="font-bold tabular-nums">
                  {previewRemaining.toLocaleString()}{' '}
                  {t(`forecast.units.${preview.metric}`)}
                </p>
              </div>
              <div>
                <p className="text-base-content/60">{t('forecast.daily')}</p>
                <p className="font-bold tabular-nums">
                  {previewDaily.toLocaleString()}{' '}
                  {t(`forecast.units.${preview.metric}`)}
                </p>
              </div>
              <div>
                <p className="text-base-content/60">{t('forecast.timeLeft')}</p>
                <p className="font-bold tabular-nums">
                  {formatDuration(previewMinutes)}
                </p>
              </div>
            </div>

            <div className="surface-muted p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-semibold">{t('forecast.previewTitle')}</p>
                <p className="text-sm text-base-content/60 mt-1 max-w-2xl">
                  {t('forecast.previewBody')}
                </p>
              </div>
              <Link
                to="/support"
                className={buttonClass({
                  variant: 'primary',
                  size: 'sm',
                  className: 'shrink-0',
                })}
              >
                {t('forecast.upgrade')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {!data?.canManage && Boolean(data?.forecasts.length) && (
        <div role="alert" className="alert alert-info">
          <span>{t('forecast.readOnly')}</span>
          <Link to="/support" className="link font-semibold">
            {t('forecast.upgrade')}
          </Link>
        </div>
      )}

      {data?.canManage && !data.forecasts.length && (
        <div className="surface-muted p-6 text-center">
          <p className="font-medium">{t('forecast.emptyTitle')}</p>
          <p className="text-sm text-base-content/60 mt-1">
            {t('forecast.emptyBody')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data?.forecasts.map((forecast) => {
          const progress = forecast.progress;
          return (
            <article key={forecast._id} className="card surface card-sm">
              <div className="card-body gap-4">
                <div className="flex items-start gap-3">
                  {forecast.mediaImage && (
                    <img
                      src={forecast.mediaImage}
                      alt=""
                      className="w-12 h-16 object-cover rounded-field"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold truncate">{forecast.mediaTitle}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={STATUS_CLASS[progress.status]}>
                        {t(`forecast.status.${progress.status}`)}
                      </span>
                      <span className="text-xs text-base-content/60 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        {new Date(
                          `${forecast.targetDate.slice(0, 10)}T00:00:00`
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {data.canManage && (
                      <Button
                        appearance="ghost"
                        size="sm"
                        shape="square"
                        aria-label={t('widget.edit')}
                        onClick={() => setEditing(forecast)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      appearance="ghost"
                      size="sm"
                      shape="square"
                      aria-label={t('widget.delete')}
                      onClick={() => setPendingDelete(forecast)}
                    >
                      <Trash2 className="w-4 h-4 text-error" />
                    </Button>
                  </div>
                </div>

                <progress
                  className="progress progress-primary w-full"
                  value={progress.percentage}
                  max="100"
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-base-content/60">{t('forecast.remaining')}</p>
                    <p className="font-bold tabular-nums">
                      {Math.ceil(progress.remaining).toLocaleString()} {t(`forecast.units.${forecast.metric}`)}
                    </p>
                  </div>
                  <div>
                    <p className="text-base-content/60">{t('forecast.daily')}</p>
                    <p className="font-bold tabular-nums">
                      {progress.requiredPerDay.toLocaleString()} {t(`forecast.units.${forecast.metric}`)}
                    </p>
                  </div>
                  <div>
                    <p className="text-base-content/60">{t('forecast.timeLeft')}</p>
                    <p className="font-bold tabular-nums">
                      {progress.estimatedMinutes === null
                        ? t('forecast.insufficientData')
                        : formatDuration(progress.estimatedMinutes)}
                    </p>
                  </div>
                </div>
                {progress.behindBy > 0 && progress.status === 'behind' && (
                  <div role="alert" className="alert alert-warning py-2 text-sm">
                    <span>
                      {t('forecast.behindBy', {
                        value: progress.behindBy.toLocaleString(),
                        unit: t(`forecast.units.${forecast.metric}`),
                      })}
                    </span>
                  </div>
                )}
                {remove.isError && (
                  <p className="text-sm text-error">{getApiErrorMessage(remove.error)}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <ForecastModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <ForecastModal
        open={Boolean(editing)}
        forecast={editing}
        onClose={() => setEditing(undefined)}
      />
      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(undefined)}
        title={t('forecast.deleteTitle')}
        actions={
          <>
            <Button appearance="ghost" onClick={() => setPendingDelete(undefined)}>
              {t('modal.cancel')}
            </Button>
            <Button
              variant="error"
              loading={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete._id)}
            >
              {t('widget.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-base-content/70">
          {t('forecast.deleteBody', { title: pendingDelete?.mediaTitle })}
        </p>
        {remove.isError && (
          <p className="text-sm text-error mt-3">{getApiErrorMessage(remove.error)}</p>
        )}
      </Modal>
    </section>
  );
}
