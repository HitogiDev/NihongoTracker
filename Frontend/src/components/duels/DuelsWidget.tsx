import { useQuery } from '@tanstack/react-query';
import { getDuelsFn } from '../../api/duelsApi';
import { Skeleton } from '../ui/Skeleton';
import DuelCard from './DuelCard';
import DuelStatsSection from './DuelStatsSection';

/** Shows the oldest active duel, or the duel stats when none is active. */
export default function DuelsWidget({ username }: { username: string }) {
  const activeQuery = useQuery({
    queryKey: ['duels', 'widget', 'active'],
    queryFn: () => getDuelsFn('active', 1, 1),
    meta: { persist: false },
  });

  if (activeQuery.isLoading) {
    return (
      <section className="card surface">
        <div className="card-body">
          <Skeleton className="h-24 w-full" />
        </div>
      </section>
    );
  }

  const activeDuel = activeQuery.data?.duels?.[0];
  if (activeDuel) return <DuelCard duel={activeDuel} />;

  return <DuelStatsSection username={username} showLink />;
}
