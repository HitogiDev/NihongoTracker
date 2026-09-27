import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createImmersionForecastFn,
  getImmersionForecastTargetAvailabilityFn,
  multiSearchMediaFn,
  previewImmersionForecastFn,
  updateImmersionForecastFn,
} from '../api/trackerApi';
import {
  IImmersionForecast,
  ImmersionForecastMetric,
  IMediaDocument,
  SearchResultType,
} from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { useUserDataStore } from '../store/userData';
import { getApiErrorMessage } from '../utils/apiError';
import Modal from './ui/Modal';
import Field from './ui/Field';
import Button from './ui/Button';
import DatePickerInput from './ui/DatePickerInput';
import RowButton from './ui/RowButton';
import { buttonClass } from './ui/buttons';

type InitialMedia = Pick<
  IMediaDocument,
  'contentId' | 'type' | 'title' | 'contentImage' | 'isAdult'
>;

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function displayTitle(media: Pick<IMediaDocument, 'title'>): string {
  return (
    media.title.contentTitleNative ||
    media.title.contentTitleRomaji ||
    media.title.contentTitleEnglish ||
    ''
  );
}

function metricsForMedia(type: IMediaDocument['type']): ImmersionForecastMetric[] {
  if (type === 'anime' || type === 'tv show') return ['episodes'];
  if (type === 'movie') return ['minutes'];
  if (type === 'manga' || type === 'light-novel') {
    return ['volumes', 'pages', 'chars'];
  }
  if (type === 'book') return ['pages', 'chars'];
  return ['chars', 'minutes'];
}

function defaultMetric(type: IMediaDocument['type']): ImmersionForecastMetric {
  return metricsForMedia(type)[0];
}

const MEDIA_TYPE_TRANSLATION_KEYS = {
  anime: 'mediaTypes.anime',
  manga: 'mediaTypes.manga',
  'light-novel': 'mediaTypes.light-novel',
  vn: 'mediaTypes.vn',
  game: 'mediaTypes.game',
  video: 'mediaTypes.video',
  movie: 'mediaTypes.movie',
  'tv show': 'mediaTypes.tvShow',
  book: 'mediaTypes.book',
} as const satisfies Record<IMediaDocument['type'], string>;

function mediaTypeTranslationKey(type: IMediaDocument['type']) {
  return MEDIA_TYPE_TRANSLATION_KEYS[type];
}

function formatForecastDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export default function ForecastModal({
  open,
  onClose,
  initialMedia,
  forecast,
}: {
  open: boolean;
  onClose: () => void;
  initialMedia?: InitialMedia;
  forecast?: IImmersionForecast;
}) {
  const { t } = useTranslation('goals');
  const { t: tCommon } = useTranslation('common');
  const { user } = useUserDataStore();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultType[]>([]);
  const [selected, setSelected] = useState<InitialMedia | null>(null);
  const [targetDate, setTargetDate] = useState(tomorrow());
  const [targetMetric, setTargetMetric] = useState<ImmersionForecastMetric>(
    initialMedia ? defaultMetric(initialMedia.type) : 'chars'
  );
  const [manualTotal, setManualTotal] = useState('');
  const [resolvedTarget, setResolvedTarget] = useState<{
    metric: ImmersionForecastMetric;
    total: number;
  } | null | undefined>(undefined);
  const [paceWarning, setPaceWarning] = useState<{
    estimatedMinutes: number;
    availableMinutes: number;
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const tier = user?.patreon?.tier;
  const canManage = Boolean(
    user?.roles?.includes('admin') ||
      (user?.patreon?.isActive &&
        (tier === 'enthusiast' || tier === 'consumer'))
  );

  useEffect(() => {
    if (!open) return;
    setSelected(initialMedia ?? null);
    setQuery('');
    setResults([]);
    setTargetDate(forecast?.targetDate.slice(0, 10) ?? tomorrow());
    setTargetMetric(
      forecast?.metric ?? (initialMedia ? defaultMetric(initialMedia.type) : 'chars')
    );
    setManualTotal(forecast ? String(forecast.targetTotal) : '');
    setResolvedTarget(undefined);
  }, [forecast, initialMedia, open]);

  useEffect(() => {
    if (!open || !selected || forecast) {
      setResolvedTarget(undefined);
      return;
    }
    let active = true;
    setResolvedTarget(undefined);
    getImmersionForecastTargetAvailabilityFn(
      selected.contentId,
      selected.type
    )
      .then(({ target }) => {
        if (active) {
          setResolvedTarget(target);
          if (target) setTargetMetric(target.metric);
        }
      })
      .catch(() => {
        if (active) setResolvedTarget(null);
      });
    return () => {
      active = false;
    };
  }, [forecast, open, selected]);

  const requiresManualTotal =
    resolvedTarget === null ||
    (resolvedTarget !== undefined &&
      resolvedTarget !== null &&
      targetMetric !== resolvedTarget.metric);

  useEffect(() => {
    if (!open || selected || debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    multiSearchMediaFn({ search: debouncedQuery.trim(), perPage: 12 })
      .then((items) => {
        if (active) setResults(items.filter((item) => item.type !== 'video'));
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setSearching(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, open, selected]);

  const mutation = useMutation({
    mutationFn: () => {
      if (forecast) {
        return updateImmersionForecastFn(forecast._id, {
          targetDate,
          metric: targetMetric,
          targetTotal: Number(manualTotal),
        });
      }
      if (!selected) throw new Error(t('forecast.selectRequired'));
      return createImmersionForecastFn({
        mediaId: selected.contentId,
        mediaType: selected.type,
        targetDate,
        metric: targetMetric,
        targetTotal: manualTotal.trim() ? Number(manualTotal) : undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['immersionForecasts'] });
      onClose();
    },
  });

  const previewMutation = useMutation({
    mutationFn: previewImmersionForecastFn,
    onSuccess: (preview) => {
      if (
        preview.estimatedMinutes !== null &&
        preview.estimatedMinutes > preview.availableMinutes
      ) {
        setPaceWarning({
          estimatedMinutes: preview.estimatedMinutes,
          availableMinutes: preview.availableMinutes,
        });
      } else {
        mutation.mutate();
      }
    },
  });

  const checkPaceAndSubmit = () => {
    const mediaId = forecast?.mediaId ?? selected?.contentId;
    const mediaType = forecast?.mediaType ?? selected?.type;
    if (!mediaId || !mediaType) return;
    setPaceWarning(null);
    previewMutation.mutate({
      mediaId,
      mediaType,
      targetDate,
      metric: targetMetric,
      targetTotal: manualTotal.trim() ? Number(manualTotal) : undefined,
    });
  };

  const actions = canManage ? (
    paceWarning ? (
      <>
        <Button appearance="ghost" onClick={() => setPaceWarning(null)}>
          {t('forecast.cancelAndEdit')}
        </Button>
        <Button
          variant="primary"
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {forecast ? t('forecast.saveAnyway') : t('forecast.createAnyway')}
        </Button>
      </>
    ) : (
      <>
        <Button appearance="ghost" onClick={onClose}>
          {t('modal.cancel')}
        </Button>
        <Button
          variant="primary"
          loading={mutation.isPending || previewMutation.isPending}
          disabled={
            (!forecast && !selected) ||
            !targetDate ||
            (!forecast && resolvedTarget === undefined) ||
            (!forecast && requiresManualTotal && !manualTotal.trim()) ||
            (Boolean(forecast) && !manualTotal.trim()) ||
            (manualTotal.trim() !== '' &&
              (!Number.isFinite(Number(manualTotal)) || Number(manualTotal) <= 0))
          }
          onClick={checkPaceAndSubmit}
        >
          {forecast ? t('modal.saveChanges') : t('forecast.create')}
        </Button>
      </>
    )
  ) : undefined;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={forecast ? t('forecast.editTitle') : t('forecast.createTitle')}
      actions={actions}
      size="lg"
    >
      {!canManage ? (
        <div role="alert" className="alert alert-info alert-vertical">
          <div>
            <p className="font-semibold">{t('forecast.lockedTitle')}</p>
            <p className="text-sm">{t('forecast.lockedBody')}</p>
          </div>
          <Link
            to="/support"
            className={buttonClass({ variant: 'primary', size: 'sm' })}
            onClick={onClose}
          >
            {t('forecast.upgrade')}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {!forecast && !selected && (
            <Field label={t('forecast.media')}>
              {(id) => (
                <label className="input w-full" htmlFor={id}>
                  <Search className="w-4 h-4 opacity-50" />
                  <input
                    id={id}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('forecast.searchPlaceholder')}
                  />
                </label>
              )}
            </Field>
          )}

          {!forecast && !selected && query.trim().length >= 2 && (
            <div className="surface-muted max-h-64 overflow-y-auto p-1">
              {searching ? (
                <p className="p-4 text-sm text-base-content/60">
                  {t('forecast.searching')}
                </p>
              ) : results.length ? (
                results.map((media) => (
                  <RowButton
                    key={`${media.type}:${media.contentId}`}
                    onClick={() => {
                      setSelected(media);
                      setTargetMetric(defaultMetric(media.type));
                      setManualTotal('');
                      setPaceWarning(null);
                    }}
                  >
                    {media.contentImage ? (
                      <img
                        src={media.contentImage}
                        alt=""
                        className="w-10 h-14 object-cover rounded-field"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-base-300 rounded-field" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-medium truncate">
                        {displayTitle(media)}
                      </span>
                      <span className="block text-xs opacity-60">
                        {tCommon(mediaTypeTranslationKey(media.type))}
                      </span>
                    </span>
                  </RowButton>
                ))
              ) : (
                <p className="p-4 text-sm text-base-content/60">
                  {t('forecast.noResults')}
                </p>
              )}
            </div>
          )}

          {(selected || forecast) && (
            <div className="surface-muted flex items-center gap-3 p-3">
              {selected?.contentImage || forecast?.mediaImage ? (
                <img
                  src={selected?.contentImage || forecast?.mediaImage}
                  alt=""
                  className="w-12 h-16 object-cover rounded-field"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {selected ? displayTitle(selected) : forecast?.mediaTitle}
                </p>
                <p className="text-xs text-base-content/60">
                  {selected
                    ? tCommon(mediaTypeTranslationKey(selected.type))
                    : forecast && tCommon(mediaTypeTranslationKey(forecast.mediaType))}
                </p>
              </div>
              {!initialMedia && !forecast && (
                <Button size="sm" appearance="ghost" onClick={() => setSelected(null)}>
                  {t('forecast.change')}
                </Button>
              )}
            </div>
          )}

          {(selected || forecast) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label={t('forecast.completionMetric')}
                required={Boolean(forecast) || requiresManualTotal}
              >
                {(id) => (
                  <select
                    id={id}
                    className="select w-full"
                    value={targetMetric}
                    disabled={!forecast && resolvedTarget === undefined}
                    required={Boolean(forecast) || requiresManualTotal}
                    onChange={(event) => {
                      setTargetMetric(
                        event.target.value as ImmersionForecastMetric
                      );
                      setPaceWarning(null);
                    }}
                  >
                    {metricsForMedia(
                      selected?.type ?? forecast!.mediaType
                    ).map((metric) => (
                      <option key={metric} value={metric}>
                        {t(`forecast.units.${metric}`)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field
                label={t('forecast.completionTotal')}
                required={Boolean(forecast) || requiresManualTotal}
              >
                {(id) => (
                  <input
                    id={id}
                    className="input w-full"
                    type="number"
                    min="1"
                    step="1"
                    value={manualTotal}
                    required={Boolean(forecast) || requiresManualTotal}
                    onChange={(event) => {
                      setManualTotal(event.target.value);
                      setPaceWarning(null);
                    }}
                    placeholder={t('forecast.completionTotalPlaceholder')}
                  />
                )}
              </Field>
            </div>
          )}

          {!forecast && selected && (
            <p className="text-sm text-base-content/60" role="status">
              {resolvedTarget === undefined
                ? t('forecast.checkingMetadata')
                : resolvedTarget
                  ? t('forecast.metadataTotal', {
                      total: resolvedTarget.total.toLocaleString(),
                      unit: t(`forecast.units.${resolvedTarget.metric}`),
                    })
                  : t('forecast.metadataMissing')}
            </p>
          )}

          {(selected || forecast) && (
            <Field label={t('forecast.targetDate')} required>
              {(id) => (
                <DatePickerInput
                  id={id}
                  value={targetDate}
                  onChange={(value) => {
                    setTargetDate(value);
                    setPaceWarning(null);
                  }}
                  min={tomorrow()}
                  required
                  ariaLabel={t('forecast.targetDate')}
                  className="focus:input-primary"
                />
              )}
            </Field>
          )}

          {paceWarning && (
            <div role="alert" className="alert alert-warning">
              <span>
                {t('forecast.paceWarning', {
                  estimated: formatForecastDuration(paceWarning.estimatedMinutes),
                  available: formatForecastDuration(paceWarning.availableMinutes),
                })}
              </span>
            </div>
          )}

          {mutation.isError && (
            <div role="alert" className="alert alert-error">
              <span>{getApiErrorMessage(mutation.error)}</span>
            </div>
          )}
          {previewMutation.isError && (
            <div role="alert" className="alert alert-error">
              <span>{getApiErrorMessage(previewMutation.error)}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
