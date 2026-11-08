import { useQuery } from '@tanstack/react-query';
import { Swords } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDuelStatsFn } from '../../api/duelsApi';
import type { IDuelRival } from '../../types';
import UserAvatar from '../UserAvatar';
import { Skeleton } from '../ui/Skeleton';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-muted rounded-box p-3">
      <div className="text-xs text-base-content/60">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function RivalHighlight({
  label,
  rival,
}: {
  label: string;
  rival: IDuelRival | null;
}) {
  const { t } = useTranslation('duels');
  if (!rival) return null;
  return (
    <div className="surface-muted flex items-center gap-3 rounded-box p-3">
      <UserAvatar
        username={rival.user.username}
        avatar={rival.user.avatar}
        containerClassName="w-10 h-10 rounded-full shrink-0"
      />
      <div className="min-w-0">
        <div className="text-xs text-base-content/60">{label}</div>
        <Link
          to={`/user/${encodeURIComponent(rival.user.username)}`}
          className="block truncate font-semibold link link-hover"
        >
          {rival.user.username}
        </Link>
        <div className="text-xs text-base-content/70">
          {t('stats.record', {
            wins: rival.wins,
            losses: rival.losses,
            draws: rival.draws,
          })}
        </div>
      </div>
    </div>
  );
}

export default function DuelStatsSection({
  username,
  showLink = false,
}: {
  username: string;
  showLink?: boolean;
}) {
  const { t } = useTranslation('duels');
  const statsQuery = useQuery({
    queryKey: ['duels', 'stats', username],
    queryFn: () => getDuelStatsFn(username),
    staleTime: 5 * 60_000,
    retry: false,
  });

  // A private-statistics error hides the section instead of showing a failure.
  if (statsQuery.isError) return null;

  const stats = statsQuery.data;

  return (
    <section className="card surface">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="card-title">
            <Swords className="h-5 w-5" />
            {t('stats.title')}
          </h2>
          {showLink && (
            <Link to="/duels" className="btn btn-ghost btn-xs text-primary">
              {t('stats.viewAll')}
            </Link>
          )}
        </div>
        {statsQuery.isLoading || !stats ? (
          <Skeleton className="h-24 w-full" />
        ) : stats.total === 0 ? (
          <p className="text-base-content/70">{t('stats.empty')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label={t('stats.total')} value={String(stats.total)} />
              <StatTile label={t('stats.wins')} value={String(stats.wins)} />
              <StatTile label={t('stats.losses')} value={String(stats.losses)} />
              <StatTile label={t('stats.draws')} value={String(stats.draws)} />
              <StatTile
                label={t('stats.winRate')}
                value={`${Math.round(stats.winRate * 100)}%`}
              />
              <StatTile
                label={t('stats.currentStreak')}
                value={String(stats.currentStreak)}
              />
              <StatTile
                label={t('stats.bestStreak')}
                value={String(stats.bestStreak)}
              />
              <StatTile
                label={t('stats.openDuels')}
                value={String(stats.openDuels)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RivalHighlight label={t('stats.bestRival')} rival={stats.bestRival} />
              <RivalHighlight
                label={t('stats.mostFrequent')}
                rival={stats.mostFrequentRival}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>{t('stats.rivals')}</th>
                    <th className="text-right">{t('stats.wins')}</th>
                    <th className="text-right">{t('stats.losses')}</th>
                    <th className="text-right">{t('stats.draws')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.rivals.map((rival) => (
                    <tr key={rival.user._id}>
                      <td>
                        <Link
                          to={`/user/${encodeURIComponent(rival.user.username)}`}
                          className="link link-hover"
                        >
                          {rival.user.username}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">{rival.wins}</td>
                      <td className="text-right tabular-nums">{rival.losses}</td>
                      <td className="text-right tabular-nums">{rival.draws}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
