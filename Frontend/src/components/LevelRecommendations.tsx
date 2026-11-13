import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  EyeOff,
  Headphones,
  Lock,
  Play,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  dismissLevelRecommendationFn,
  getLevelRecommendationsFn,
  restoreLevelRecommendationFn,
  type LevelRecommendationFilters,
} from '../api/mediaSocialApi';
import { useNativePageState } from '../native/useNativePageState';
import { useUserDataStore } from '../store/userData';
import {
  ILevelRecommendationItem,
  LevelRecommendationCategory,
} from '../types';
import { getApiErrorMessage } from '../utils/apiError';
import Button from './ui/Button';
import MultiSelectDropdown from './ui/MultiSelectDropdown';
import { BTN } from './ui/buttons';

const CATEGORIES: {
  value: LevelRecommendationCategory;
  icon: typeof BookOpen;
}[] = [
  { value: 'reading', icon: BookOpen },
  { value: 'listening', icon: Headphones },
];

const CATEGORY_TYPES: Record<
  LevelRecommendationCategory,
  ILevelRecommendationItem['type'][]
> = {
  reading: ['light-novel', 'vn', 'manga', 'book', 'game'],
  listening: ['anime', 'movie', 'tv show'],
};

const FIT_CLASS: Record<ILevelRecommendationItem['fit'], string> = {
  comfortable: 'badge badge-success badge-sm',
  challenge: 'badge badge-warning badge-sm',
};

const EMPTY_FILTERS: LevelRecommendationFilters = {
  types: [],
  genres: [],
  shift: 0,
};

function itemTitle(item: ILevelRecommendationItem): string {
  return (
    item.title.contentTitleEnglish ||
    item.title.contentTitleRomaji ||
    item.title.contentTitleNative
  );
}

function mediaTypeKey(type: ILevelRecommendationItem['type']) {
  return type === 'tv show' ? 'tvShow' : type;
}

interface LevelRecommendationsProps {
  limit: number;
  /** Compact mode renders a dashboard card with a link to the full list. */
  compact?: boolean;
}

function LevelRecommendations({
  limit,
  compact = false,
}: LevelRecommendationsProps) {
  const { t } = useTranslation('media');
  const { t: tCommon } = useTranslation('common');
  const queryClient = useQueryClient();
  const { user } = useUserDataStore();
  const blurAdult = user?.settings?.blurAdultContent ?? true;
  const [category, setCategory] = useNativePageState<LevelRecommendationCategory>(
    compact ? 'home:levelRecommendations' : 'recommendations:level',
    () => 'reading'
  );
  const [filters, setFilters] = useNativePageState<LevelRecommendationFilters>(
    'recommendations:levelFilters',
    () => EMPTY_FILTERS
  );
  const activeFilters = compact ? EMPTY_FILTERS : filters;
  const hasActiveFilters =
    activeFilters.types.length > 0 ||
    activeFilters.genres.length > 0 ||
    activeFilters.shift !== 0;

  const query = useQuery({
    queryKey: [
      'levelRecommendations',
      category,
      limit,
      activeFilters.types,
      activeFilters.genres,
      activeFilters.shift,
    ],
    queryFn: () =>
      getLevelRecommendationsFn({ category, limit, filters: activeFilters }),
    staleTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
  const data = query.data;
  const canFilter = data?.canFilter ?? false;

  useEffect(() => {
    // A downgrade or expired tier must not leave filters that the server refuses.
    if (data && !data.canFilter && hasActiveFilters) setFilters(EMPTY_FILTERS);
  }, [data, hasActiveFilters, setFilters]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['levelRecommendations'] });
  const restoreMutation = useMutation({
    mutationFn: (item: ILevelRecommendationItem) =>
      restoreLevelRecommendationFn(item.type, item.contentId),
    onSuccess: invalidate,
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const dismissMutation = useMutation({
    mutationFn: (item: ILevelRecommendationItem) =>
      dismissLevelRecommendationFn(item.type, item.contentId),
    onSuccess: (_result, item) => {
      void invalidate();
      toast(
        <span className="flex items-center gap-3">
          {t('levelRecommendations.hidden')}
          <button
            type="button"
            className="link font-semibold"
            onClick={() => restoreMutation.mutate(item)}
          >
            {t('levelRecommendations.undo')}
          </button>
        </span>
      );
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const changeCategory = (next: LevelRecommendationCategory) => {
    setCategory(next);
    setFilters(EMPTY_FILTERS);
  };

  const gridClass = compact
    ? 'grid grid-cols-3 gap-3 sm:grid-cols-6 xl:grid-cols-3'
    : 'grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6';

  const typeOptions = CATEGORY_TYPES[category].map((type) => ({
    value: type,
    label: tCommon(`mediaTypes.${mediaTypeKey(type)}`),
  }));
  const genreOptions = (data?.availableGenres ?? []).map((genre) => ({
    value: genre,
    label: genre,
  }));

  const filterBar = compact ? null : canFilter ? (
    <div className="flex flex-wrap items-end gap-3">
      <MultiSelectDropdown
        label={
          activeFilters.types.length === 0
            ? t('levelRecommendations.filters.allTypes')
            : t('levelRecommendations.filters.typesCount', {
                count: activeFilters.types.length,
              })
        }
        options={typeOptions}
        value={activeFilters.types}
        onChange={(types) =>
          setFilters({
            ...activeFilters,
            types: types as ILevelRecommendationItem['type'][],
          })
        }
        selectAllLabel={t('levelRecommendations.filters.selectAll')}
        selectNoneLabel={t('levelRecommendations.filters.selectNone')}
      />
      <MultiSelectDropdown
        label={
          activeFilters.genres.length === 0
            ? t('levelRecommendations.filters.allGenres')
            : t('levelRecommendations.filters.genresCount', {
                count: activeFilters.genres.length,
              })
        }
        options={genreOptions}
        value={activeFilters.genres}
        onChange={(genres) =>
          setFilters({ ...activeFilters, genres: genres.slice(0, 5) })
        }
        selectAllLabel={t('levelRecommendations.filters.selectAll')}
        selectNoneLabel={t('levelRecommendations.filters.selectNone')}
      />
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-base-content/65">
        <span className="flex justify-between">
          <span>{t('levelRecommendations.filters.easier')}</span>
          <span className="font-medium text-base-content">
            {activeFilters.shift === 0
              ? t('levelRecommendations.filters.yourLevel')
              : `${activeFilters.shift > 0 ? '+' : ''}${activeFilters.shift.toFixed(2)} Jiten`}
          </span>
          <span>{t('levelRecommendations.filters.harder')}</span>
        </span>
        <input
          type="range"
          className="range range-primary range-xs"
          min={-1}
          max={1}
          step={0.25}
          value={activeFilters.shift}
          aria-label={t('levelRecommendations.filters.difficulty')}
          onChange={(event) =>
            setFilters({ ...activeFilters, shift: Number(event.target.value) })
          }
        />
      </label>
      {hasActiveFilters && (
        <Button size="sm" appearance="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
          {t('levelRecommendations.filters.reset')}
        </Button>
      )}
    </div>
  ) : data ? (
    <div className="surface-muted flex flex-wrap items-center justify-between gap-3 p-3">
      <p className="flex items-center gap-2 text-sm text-base-content/75">
        <Lock className="h-4 w-4 shrink-0" />
        {t('levelRecommendations.locked')}
      </p>
      <Link to="/support" className={BTN.actionPrimary}>
        {t('levelRecommendations.lockedCta')}
      </Link>
    </div>
  ) : null;

  const content = query.isLoading ? (
    <div className={gridClass} aria-busy="true">
      {Array.from({ length: compact ? 6 : 12 }, (_, index) => (
        <div key={index} className="skeleton aspect-[2/3] w-full" />
      ))}
    </div>
  ) : query.isError ? (
    <div role="alert" className="alert">
      <span>{getApiErrorMessage(query.error)}</span>
      <Button size="sm" onClick={() => void query.refetch()}>
        {t('social.retry')}
      </Button>
    </div>
  ) : data && data.items.length ? (
    <div className={gridClass}>
      {data.items.map((item) => {
        const image = item.contentImage || item.coverImage;
        const shouldBlur = blurAdult && (item.isAdultImage || item.isAdult);
        const path = `/${encodeURIComponent(item.type)}/${encodeURIComponent(item.contentId)}`;
        return (
          <div key={`${item.type}:${item.contentId}`} className="group relative min-w-0">
            <Link to={path} className="block">
              <div className="relative aspect-[2/3] overflow-hidden rounded-field bg-base-300">
                {image ? (
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    className={`h-full w-full object-cover transition-transform group-hover:scale-105 ${shouldBlur ? 'blur-sm' : ''}`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Play className="h-8 w-8 text-base-content/40" />
                  </div>
                )}
                <span className="badge badge-neutral badge-sm absolute left-1 top-1">
                  Jiten {item.jitenDifficulty.toFixed(1)}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-medium group-hover:underline">
                {itemTitle(item)}
              </p>
              {!compact && (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-base-content/65">
                  <span className={FIT_CLASS[item.fit]}>
                    {t(`levelRecommendations.fit.${item.fit}`)}
                  </span>
                  <span>{tCommon(`mediaTypes.${mediaTypeKey(item.type)}`)}</span>
                  {item.readers > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {t('levelRecommendations.readers', { count: item.readers })}
                    </span>
                  )}
                </div>
              )}
            </Link>
            {!compact && canFilter && (
              <button
                type="button"
                className="btn btn-neutral btn-xs btn-square absolute right-1 top-1"
                title={t('levelRecommendations.hide')}
                aria-label={t('levelRecommendations.hide')}
                disabled={dismissMutation.isPending}
                onClick={() => dismissMutation.mutate(item)}
              >
                <EyeOff className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <p className="surface-muted p-4 text-sm text-base-content/65">
      {hasActiveFilters
        ? t('levelRecommendations.emptyFiltered')
        : t('levelRecommendations.empty')}
    </p>
  );

  return (
    <section className="card surface">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="card-title text-xl font-semibold leading-snug">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('levelRecommendations.title')}
            </h2>
            <p className="text-sm text-base-content/65">
              {data
                ? data.hasHistory
                  ? t('levelRecommendations.subtitle', {
                      comfort: data.comfortJiten.toFixed(2),
                      min: data.minJiten.toFixed(2),
                      max: data.maxJiten.toFixed(2),
                    })
                  : t('levelRecommendations.subtitleNoHistory')
                : t('levelRecommendations.subtitleLoading')}
            </p>
          </div>
          <div className="join">
            {CATEGORIES.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className={category === value ? BTN.segmentActive : BTN.segment}
                aria-pressed={category === value}
                onClick={() => changeCategory(value)}
              >
                <Icon className="h-4 w-4" />
                {t(`levelRecommendations.categories.${value}`)}
              </button>
            ))}
          </div>
        </div>
        {filterBar}
        {content}
        {compact && (
          <Link to="/recommendations?tab=level" className={BTN.action}>
            {t('levelRecommendations.seeAll')}
          </Link>
        )}
      </div>
    </section>
  );
}

export default LevelRecommendations;
