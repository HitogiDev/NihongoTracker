import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  Calendar1,
  ChevronDown,
  Clock,
  Headphones,
  MessageSquareText,
  Trophy,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { getClubMemberRankingsFn } from '../../api/clubApi';
import { numberWithCommas } from '../../utils/utils';
import UserAvatar from '../UserAvatar';
import Spinner from '../ui/Spinner';

interface ClubRankingsTabProps {
  clubId: string;
  clubName?: string;
}

type Metric = 'xp' | 'time' | 'chars' | 'reading' | 'listening';
type Period = 'week' | 'month' | 'all-time';

const METRIC_ICONS = {
  xp: Zap,
  time: Clock,
  chars: MessageSquareText,
  reading: BookOpen,
  listening: Headphones,
} satisfies Record<Metric, typeof Zap>;

const PERIOD_ICONS = {
  week: Calendar1,
  month: Calendar,
  'all-time': Trophy,
} satisfies Record<Period, typeof Trophy>;

const PODIUM_SLOTS = [
  {
    dataIndex: 1,
    rank: 2,
    avatarClass:
      'w-10 h-10 sm:w-16 sm:h-16 rounded-full ring ring-base-content/40',
    badgeClass:
      'badge badge-xs sm:badge-sm bg-base-content text-base-100 font-bold',
    nameClass: 'text-xs sm:text-sm',
    valueClass: 'text-sm sm:text-lg text-base-content',
  },
  {
    dataIndex: 0,
    rank: 1,
    avatarClass:
      'w-14 h-14 sm:w-20 sm:h-20 rounded-full ring ring-warning ring-offset-2',
    badgeClass:
      'badge badge-xs sm:badge-sm bg-warning text-warning-content font-bold',
    nameClass: 'text-xs sm:text-base',
    valueClass: 'text-base sm:text-xl text-warning',
  },
  {
    dataIndex: 2,
    rank: 3,
    avatarClass:
      'w-10 h-10 sm:w-16 sm:h-16 rounded-full ring ring-accent/50',
    badgeClass:
      'badge badge-xs sm:badge-sm bg-accent text-accent-content font-bold',
    nameClass: 'text-xs sm:text-sm',
    valueClass: 'text-sm sm:text-lg text-base-content',
  },
] as const;

export default function ClubRankingsTab({
  clubId,
  clubName,
}: ClubRankingsTabProps) {
  const { t } = useTranslation('clubs');
  const [metric, setMetric] = useState<Metric>('xp');
  const [period, setPeriod] = useState<Period>('all-time');
  const rankings = useQuery({
    queryKey: ['clubMemberRankings', clubId, metric, period],
    queryFn: () =>
      getClubMemberRankingsFn(clubId, { metric, period, limit: 100 }),
  });

  const metricOptions = (Object.keys(METRIC_ICONS) as Metric[]).map(
    (value) => ({
      value,
      label: t(`ranking.metrics.${value}`),
      Icon: METRIC_ICONS[value],
    })
  );
  const periodOptions = (['week', 'month', 'all-time'] as Period[]).map(
    (value) => ({
      value,
      label: t(
        `ranking.period.${value === 'all-time' ? 'allTime' : value}`
      ),
      Icon: PERIOD_ICONS[value],
    })
  );
  const selectedMetric = metricOptions.find((option) => option.value === metric)!;
  const selectedPeriod = periodOptions.find((option) => option.value === period)!;
  const rows = rankings.data?.rankings ?? [];
  const hasPodium = rows.length >= 3;
  const tableRows = hasPodium ? rows.slice(3) : rows;
  const isTimeMetric = ['time', 'reading', 'listening'].includes(metric);

  const formatValue = (value: number) =>
    numberWithCommas(isTimeMetric ? Math.round((value / 60) * 10) / 10 : value);
  const unit = isTimeMetric
    ? t('ranking.units.hours')
    : metric === 'chars'
      ? t('ranking.units.chars')
      : t('ranking.units.xp');

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-3">
          <Trophy className="h-10 w-10 text-warning" />
          <h1 className="text-3xl font-bold text-base-content sm:text-4xl">
            {clubName
              ? t('ranking.titleForClub', { club: clubName })
              : t('ranking.title')}
          </h1>
        </div>
        <p className="text-base-content/70">
          {clubName
            ? t('ranking.tabSubtitleForClub', { club: clubName })
            : t('ranking.tabSubtitle')}
        </p>
      </div>

      <div className="mb-8 grid w-full grid-cols-2 gap-3 sm:flex sm:justify-center sm:gap-4">
        <div className="dropdown dropdown-start w-full sm:w-auto">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-outline w-full gap-2 sm:w-auto"
          >
            <selectedPeriod.Icon className="h-4 w-4" />
            {selectedPeriod.label}
            <ChevronDown className="h-4 w-4" />
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu surface-raised z-[1] w-52 p-2"
          >
            {periodOptions.map(({ value, label, Icon }) => (
              <li key={value}>
                <button
                  type="button"
                  className={`gap-3 ${period === value ? 'active' : ''}`}
                  onClick={() => setPeriod(value)}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="dropdown dropdown-end w-full sm:w-auto">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-primary w-full gap-2 sm:w-auto"
          >
            <selectedMetric.Icon className="h-4 w-4" />
            {selectedMetric.label}
            <ChevronDown className="h-4 w-4" />
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu surface-raised z-[1] w-56 p-2"
          >
            {metricOptions.map(({ value, label, Icon }) => (
              <li key={value}>
                <button
                  type="button"
                  className={`gap-3 ${metric === value ? 'active' : ''}`}
                  onClick={() => setMetric(value)}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {rankings.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Spinner className="loading-lg" />
            <p className="mt-4 text-base-content/70">{t('ranking.loading')}</p>
          </div>
        </div>
      ) : rankings.isError ? (
        <p className="py-12 text-center text-error">
          {t('ranking.tabLoadFailed')}
        </p>
      ) : rows.length ? (
        <div className="card surface overflow-hidden">
          <div className="card-body p-0">
            {hasPodium && (
              <div className="bg-primary/15 p-3 sm:p-8">
                <div className="mx-auto grid max-w-2xl grid-cols-3 items-end gap-1.5 sm:gap-4">
                  {PODIUM_SLOTS.map((slot) => {
                    const entry = rows[slot.dataIndex];
                    return (
                      <div key={entry.user._id} className="text-center">
                        <div className="relative mb-1 sm:mb-4">
                          <div className="avatar">
                            <UserAvatar
                              username={entry.user.username}
                              avatar={entry.user.avatar}
                              containerClassName={slot.avatarClass}
                              imageClassName="h-full w-full rounded-full object-cover"
                              fallbackClassName="flex h-full w-full items-center justify-center rounded-full bg-neutral-content"
                              textClassName="text-sm font-bold sm:text-xl"
                            />
                          </div>
                          {slot.rank === 1 && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 sm:-top-6">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                stroke="none"
                                className="h-7 w-7 text-warning sm:h-9 sm:w-9"
                              >
                                <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className={slot.badgeClass}>#{slot.rank}</div>
                          <Link
                            to={`/user/${encodeURIComponent(entry.user.username)}`}
                            className={`max-w-full font-bold hover:underline ${slot.nameClass}`}
                          >
                            <span className="block max-w-[4.5rem] truncate sm:max-w-none">
                              {entry.user.username}
                            </span>
                          </Link>
                        </div>
                        <div className="text-xs text-base-content/70 sm:text-sm">
                          {t('ranking.levelShort', {
                            level: entry.user.stats?.userLevel ?? 1,
                          })}
                        </div>
                        <div className={`mt-1 font-bold ${slot.valueClass}`}>
                          {formatValue(entry.value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tableRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr className="border-b border-base-300">
                      <th className="w-10 text-center sm:w-16">
                        {t('ranking.rank')}
                      </th>
                      <th>{t('ranking.member')}</th>
                      <th className="hidden text-center sm:table-cell">
                        {t('ranking.level')}
                      </th>
                      <th className="text-end">{selectedMetric.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((entry) => (
                      <tr key={entry.user._id}>
                        <td className="text-center">
                          <span className="text-sm font-bold text-base-content/70 sm:text-lg">
                            {entry.rank}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="avatar">
                              <UserAvatar
                                username={entry.user.username}
                                avatar={entry.user.avatar}
                                containerClassName="h-8 w-8 rounded-full ring ring-base-content/10 sm:h-12 sm:w-12"
                                imageClassName="h-full w-full rounded-full object-cover"
                                fallbackClassName="flex h-full w-full items-center justify-center rounded-full bg-neutral-content"
                                textClassName="text-xs font-bold sm:text-lg"
                              />
                            </div>
                            <Link
                              className="max-w-[7rem] truncate font-bold transition-colors hover:text-primary sm:max-w-none"
                              to={`/user/${encodeURIComponent(entry.user.username)}`}
                            >
                              {entry.user.username}
                            </Link>
                          </div>
                        </td>
                        <td className="hidden text-center sm:table-cell">
                          <div className="badge badge-outline">
                            {t('ranking.levelShort', {
                              level: entry.user.stats?.userLevel ?? 1,
                            })}
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="text-sm font-bold sm:text-lg">
                            {formatValue(entry.value)}
                          </div>
                          <div className="text-xs text-base-content/60">
                            {unit}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="py-12 text-center text-base-content/60">
          {t('ranking.empty')}
        </p>
      )}
    </section>
  );
}
