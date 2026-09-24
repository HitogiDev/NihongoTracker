import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Clock3, Globe2, Trophy, Users, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  getGanttDataFn,
  getGlobalImmersionRankingFn,
  IGlobalImmersionRankingItem,
} from '../api/trackerApi';
import { getMediaTypeColor } from '../constants/mediaColors';
import { IGanttMediaItem } from '../types';
import { numberWithCommas } from '../utils/utils';

type RankingScope = 'individual' | 'global';
type RankingMetric = 'xp' | 'hours';

interface ImmersionRankingProps {
  username: string | undefined;
  timezone: string;
  typeFilter: string[];
  allTypesSelected: boolean;
  start?: string;
  end?: string;
}

const PAGE_SIZE = 10;
const MEDIA_TYPE_LABEL_KEYS: Record<string, string> = {
  'light-novel': 'mediaTypes.light-novel',
  'tv show': 'mediaTypes.tvShow',
};

function getMediaTypeLabel(
  type: string,
  translate: (key: string) => string
): string {
  const key = MEDIA_TYPE_LABEL_KEYS[type] ?? `mediaTypes.${type}`;
  const translated = translate(key);
  return translated === key ? type : translated;
}

function getTitle(title: string | undefined, mediaId: string): string {
  return title?.trim() || mediaId;
}

function formatHours(value: number): string {
  return `${value.toFixed(1)} h`;
}

function getSortValue(
  item: IGanttMediaItem,
  metric: RankingMetric
): number {
  return metric === 'xp' ? item.totalXp : item.totalTime;
}

function ImmersionRanking({
  username,
  timezone,
  typeFilter,
  allTypesSelected,
  start,
  end,
}: ImmersionRankingProps) {
  const { t } = useTranslation('stats');
  const { t: rawTCommon } = useTranslation('common');
  const tCommon = rawTCommon as (key: string) => string;
  const [scope, setScope] = useState<RankingScope>('individual');
  const [metric, setMetric] = useState<RankingMetric>('xp');
  const [personalVisibleCount, setPersonalVisibleCount] = useState(PAGE_SIZE);

  const hasSelectedTypes = typeFilter.length > 0;
  const typeFilterKey = typeFilter.join(',');
  const personalQuery = useQuery({
    queryKey: [
      'immersion-ranking-personal',
      username,
      timezone,
      typeFilterKey,
      start,
      end,
    ],
    queryFn: () =>
      getGanttDataFn(username!, {
        timezone,
        start,
        end,
      }),
    enabled:
      scope === 'individual' && Boolean(username) && hasSelectedTypes,
    staleTime: 5 * 60 * 1000,
  });

  const globalQuery = useInfiniteQuery({
    queryKey: [
      'immersion-ranking-global',
      metric,
      allTypesSelected ? 'all' : typeFilterKey,
      timezone,
      start,
      end,
    ],
    queryFn: ({ pageParam }) =>
      getGlobalImmersionRankingFn({
        page: pageParam,
        limit: PAGE_SIZE,
        metric,
        types: allTypesSelected ? undefined : typeFilter,
        timezone,
        start,
        end,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    enabled: scope === 'global' && hasSelectedTypes,
    staleTime: 5 * 60 * 1000,
  });

  const personalItems = useMemo(() => {
    const items = (personalQuery.data ?? []).filter(
      (item) => allTypesSelected || typeFilter.includes(item.type)
    );

    return [...items].sort((left, right) => {
      const valueDifference =
        getSortValue(right, metric) - getSortValue(left, metric);
      if (valueDifference !== 0) return valueDifference;

      const xpDifference = right.totalXp - left.totalXp;
      if (xpDifference !== 0) return xpDifference;

      return getTitle(left.titleEnglish ?? left.title, left.mediaId).localeCompare(
        getTitle(right.titleEnglish ?? right.title, right.mediaId)
      );
    });
  }, [allTypesSelected, metric, personalQuery.data, typeFilter]);

  useEffect(() => {
    setPersonalVisibleCount(PAGE_SIZE);
  }, [metric, start, end, typeFilterKey, username]);

  const globalItems = useMemo(
    () =>
      globalQuery.data?.pages.flatMap((page) => page.items) ??
      ([] as IGlobalImmersionRankingItem[]),
    [globalQuery.data]
  );

  const isGlobal = scope === 'global';
  const isLoading = isGlobal
    ? globalQuery.isLoading
    : personalQuery.isLoading;
  const isError = isGlobal ? globalQuery.isError : personalQuery.isError;
  const hasItems = isGlobal ? globalItems.length > 0 : personalItems.length > 0;
  const visibleItems = isGlobal
    ? globalItems
    : personalItems.slice(0, personalVisibleCount);
  const hasMoreItems = isGlobal
    ? Boolean(globalQuery.hasNextPage)
    : personalVisibleCount < personalItems.length;
  const isFetchingMore = isGlobal
    ? globalQuery.isFetchingNextPage
    : false;

  return (
    <div className="card surface">
      <div className="card-body gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="card-title flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {t('ranking.title')}
            </h2>
            <p className="mt-1 text-sm text-base-content/60">
              {t('ranking.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="join" aria-label={t('ranking.scopeLabel')}>
              <button
                type="button"
                className={`join-item btn btn-sm ${!isGlobal ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setScope('individual')}
              >
                <Trophy className="h-4 w-4" />
                {t('ranking.individual')}
              </button>
              <button
                type="button"
                className={`join-item btn btn-sm ${isGlobal ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setScope('global')}
              >
                <Globe2 className="h-4 w-4" />
                {t('ranking.global')}
              </button>
            </div>

            <div className="join" aria-label={t('ranking.metricLabel')}>
              <button
                type="button"
                className={`join-item btn btn-sm ${metric === 'xp' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setMetric('xp')}
              >
                <Zap className="h-4 w-4" />
                {t('ranking.xp')}
              </button>
              <button
                type="button"
                className={`join-item btn btn-sm ${metric === 'hours' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setMetric('hours')}
              >
                <Clock3 className="h-4 w-4" />
                {t('ranking.hours')}
              </button>
            </div>
          </div>
        </div>

        {!hasSelectedTypes ? (
          <div className="py-12 text-center text-sm text-base-content/60">
            {t('ranking.noTypes')}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-base-content/60">
            <span className="loading loading-spinner loading-sm" />
            {t('ranking.loading')}
          </div>
        ) : isError ? (
          <div className="py-12 text-center text-sm text-error">
            {t('ranking.loadFailed')}
          </div>
        ) : !hasItems ? (
          <div className="py-12 text-center text-sm text-base-content/60">
            {t('ranking.empty')}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>{t('ranking.position')}</th>
                    <th>{t('ranking.work')}</th>
                    <th className="text-right">
                      {metric === 'xp' ? t('ranking.xp') : t('ranking.hours')}
                    </th>
                    <th className="text-right">
                      {metric === 'xp' ? t('ranking.hours') : t('ranking.xp')}
                    </th>
                    <th className="text-right">{t('ranking.logs')}</th>
                    {isGlobal && (
                      <th className="text-right">{t('ranking.users')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item, index) => {
                    const rank = isGlobal
                      ? (item as IGlobalImmersionRankingItem).rank
                      : index + 1;
                    const globalItem = isGlobal
                      ? (item as IGlobalImmersionRankingItem)
                      : undefined;
                    const personalItem = !isGlobal
                      ? (item as IGanttMediaItem)
                      : undefined;
                    const totalHours = globalItem
                      ? globalItem.totalHours
                      : (personalItem?.totalTime ?? 0) / 60;
                    const totalXp = globalItem?.totalXp ?? personalItem?.totalXp ?? 0;
                    const logCount = globalItem?.logCount ?? personalItem?.logCount ?? 0;
                    const title = getTitle(
                      globalItem?.title ?? personalItem?.title,
                      item.mediaId
                    );
                    const titleEnglish =
                      globalItem?.titleEnglish ?? personalItem?.titleEnglish;

                    return (
                      <tr key={`${item.type}:${item.mediaId}`}>
                        <th className="w-16 text-base-content/60">#{rank}</th>
                        <td className="min-w-64">
                          <Link
                            to={`/${item.type}/${item.mediaId}`}
                            className="flex items-center gap-3"
                          >
                            {item.contentImage ? (
                              <img
                                src={item.contentImage}
                                alt=""
                                className="h-12 w-9 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <span className="h-12 w-9 shrink-0 rounded bg-base-300" />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate font-medium hover:underline">
                                {title}
                              </span>
                              {titleEnglish && titleEnglish !== title && (
                                <span className="block truncate text-xs text-base-content/50">
                                  {titleEnglish}
                                </span>
                              )}
                              <span className="mt-1 flex items-center gap-1 text-xs text-base-content/60">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{
                                    backgroundColor: getMediaTypeColor(item.type),
                                  }}
                                />
                                {getMediaTypeLabel(item.type, tCommon)}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {metric === 'xp'
                            ? `${numberWithCommas(totalXp)} XP`
                            : formatHours(totalHours)}
                        </td>
                        <td className="text-right text-sm text-base-content/70 tabular-nums">
                          {metric === 'xp'
                            ? formatHours(totalHours)
                            : `${numberWithCommas(totalXp)} XP`}
                        </td>
                        <td className="text-right text-sm tabular-nums">{logCount}</td>
                        {isGlobal && (
                          <td className="text-right text-sm tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {globalItem?.userCount ?? 0}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasMoreItems && (
              <div className="flex justify-center border-t border-base-300 pt-4">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    if (isGlobal) {
                      void globalQuery.fetchNextPage();
                    } else {
                      setPersonalVisibleCount((count) => count + PAGE_SIZE);
                    }
                  }}
                  disabled={isFetchingMore}
                >
                  {isFetchingMore && (
                    <span className="loading loading-spinner loading-sm" />
                  )}
                  {isFetchingMore
                    ? t('ranking.loadingMore')
                    : t('ranking.loadMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ImmersionRanking;
