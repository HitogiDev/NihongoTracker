import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDuelCountsFn, getDuelsFn } from '../api/duelsApi';
import CreateDuelModal from '../components/duels/CreateDuelModal';
import DuelCard from '../components/duels/DuelCard';
import Button from '../components/ui/Button';
import PageContainer from '../components/ui/PageContainer';
import Spinner from '../components/ui/Spinner';
import { BTN } from '../components/ui/buttons';
import type { DuelListGroup } from '../types';

const TABS: DuelListGroup[] = ['active', 'pending', 'history'];

export default function DuelsScreen() {
  const { t } = useTranslation('duels');
  const [tab, setTab] = useState<DuelListGroup>('active');
  const [createOpen, setCreateOpen] = useState(false);

  const countsQuery = useQuery({
    queryKey: ['duels', 'counts'],
    queryFn: getDuelCountsFn,
    refetchInterval: 60_000,
  });
  const duelsQuery = useInfiniteQuery({
    queryKey: ['duels', 'list', tab],
    queryFn: ({ pageParam }) => getDuelsFn(tab, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    refetchInterval: tab === 'active' ? 60_000 : false,
  });
  const duels = duelsQuery.data?.pages.flatMap((page) => page.duels) ?? [];
  const incoming = countsQuery.data?.incoming ?? 0;

  let content;
  if (duelsQuery.isLoading) {
    content = (
      <div className="flex justify-center py-16" aria-busy="true">
        <Spinner size="lg" />
      </div>
    );
  } else if (duelsQuery.isError) {
    content = (
      <div role="alert" className="alert alert-error">
        <span>{t('page.loadFailed')}</span>
        <button className={BTN.action} onClick={() => duelsQuery.refetch()}>
          {t('page.retry')}
        </button>
      </div>
    );
  } else if (duels.length === 0) {
    content = (
      <div className="card surface">
        <div className="card-body items-center py-12 text-center text-base-content/70">
          {t(`empty.${tab}`)}
        </div>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-4">
        {duels.map((duel) => (
          <DuelCard key={duel._id} duel={duel} />
        ))}
        {duelsQuery.hasNextPage && (
          <div className="flex justify-center">
            <Button
              appearance="outline"
              loading={duelsQuery.isFetchingNextPage}
              onClick={() => duelsQuery.fetchNextPage()}
            >
              {t('page.loadMore')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <PageContainer width="lg">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t('page.title')}</h1>
          <p className="mt-1 text-base-content/70">{t('page.subtitle')}</p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('page.newDuel')}
        </Button>
      </div>

      <div className="join mb-6" role="tablist">
        {TABS.map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? BTN.segmentActive : BTN.segment}
            onClick={() => setTab(value)}
          >
            {t(`tabs.${value}`)}
            {value === 'pending' && incoming > 0 && (
              <span className="badge badge-secondary badge-xs">{incoming}</span>
            )}
          </button>
        ))}
      </div>

      {content}
      <CreateDuelModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageContainer>
  );
}
