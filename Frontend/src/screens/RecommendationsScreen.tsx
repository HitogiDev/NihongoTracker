import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, ExternalLink, Inbox, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getMediaRecommendationsFn,
  updateMediaRecommendationStatusFn,
} from '../api/mediaSocialApi';
import { IMediaRecommendation, MediaRecommendationStatus } from '../types';
import { getApiErrorMessage } from '../utils/apiError';
import { formatRelativeDateInTimezone } from '../utils/timezone';
import UserAvatar from '../components/UserAvatar';
import PageContainer from '../components/ui/PageContainer';
import Spinner from '../components/ui/Spinner';

const STATUS_CLASS: Record<MediaRecommendationStatus, string> = {
  pending: 'badge badge-warning badge-sm',
  viewed: 'badge badge-info badge-sm',
  dismissed: 'badge badge-ghost badge-sm',
  accepted: 'badge badge-success badge-sm',
};

function mediaTitle(recommendation: IMediaRecommendation): string {
  return (
    recommendation.media?.title.contentTitleEnglish ||
    recommendation.media?.title.contentTitleRomaji ||
    recommendation.media?.title.contentTitleNative ||
    recommendation.mediaId
  );
}

export default function RecommendationsScreen() {
  const { t } = useTranslation('media');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const direction = searchParams.get('tab') === 'sent' ? 'sent' : 'received';
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const recommendationsQuery = useQuery({
    queryKey: ['mediaRecommendations', direction, page],
    queryFn: () => getMediaRecommendationsFn({ direction, page, limit: 20 }),
  });
  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: Exclude<MediaRecommendationStatus, 'pending'>;
    }) => updateMediaRecommendationStatusFn(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['mediaRecommendations'] }),
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const setDirection = (nextDirection: 'received' | 'sent') => {
    setSearchParams({ tab: nextDirection });
  };
  const setPage = (nextPage: number) => {
    setSearchParams({ tab: direction, page: String(nextPage) });
  };

  return (
    <PageContainer className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('recommendations.pageTitle')}</h1>
        <p className="mt-1 text-base-content/60">
          {t('recommendations.pageSubtitle')}
        </p>
      </div>

      <div className="join mb-6" role="tablist">
        <button
          role="tab"
          className={`join-item btn gap-2 ${direction === 'received' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setDirection('received')}
        >
          <Inbox className="h-4 w-4" />
          {t('recommendations.received')}
        </button>
        <button
          role="tab"
          className={`join-item btn gap-2 ${direction === 'sent' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setDirection('sent')}
        >
          <Send className="h-4 w-4" />
          {t('recommendations.sent')}
        </button>
      </div>

      {recommendationsQuery.isLoading ? (
        <div className="flex justify-center py-16" aria-busy="true">
          <Spinner size="lg" />
        </div>
      ) : recommendationsQuery.isError ? (
        <div role="alert" className="alert alert-error">
          <span>{t('recommendations.loadFailed')}</span>
          <button className="btn btn-sm" onClick={() => recommendationsQuery.refetch()}>
            {t('social.retry')}
          </button>
        </div>
      ) : recommendationsQuery.data?.recommendations.length ? (
        <>
          <div className="space-y-3">
            {recommendationsQuery.data.recommendations.map((recommendation) => {
              const person =
                direction === 'received'
                  ? recommendation.sender
                  : recommendation.recipient;
              const image =
                recommendation.media?.contentImage ||
                recommendation.media?.coverImage;
              const mediaPath = `/${encodeURIComponent(recommendation.mediaType)}/${encodeURIComponent(recommendation.mediaId)}`;
              return (
                <article key={recommendation._id} className="card card-sm surface-muted">
                  <div className="card-body sm:flex-row sm:items-start">
                    {image && (
                      <Link to={mediaPath} className="shrink-0">
                        <img
                          src={image}
                          alt=""
                          className="h-24 w-16 rounded-field object-cover"
                        />
                      </Link>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <UserAvatar
                          username={person.username}
                          avatar={person.avatar}
                          containerClassName="h-7 w-7 overflow-hidden rounded-full"
                          imageClassName="h-full w-full object-cover"
                          fallbackClassName="flex h-full w-full items-center justify-center bg-base-300"
                          textClassName="text-xs font-semibold"
                        />
                        <Link
                          to={`/user/${encodeURIComponent(person.username)}`}
                          className="link link-hover font-medium"
                        >
                          {person.username}
                        </Link>
                        <span className={STATUS_CLASS[recommendation.status]}>
                          {t(`recommendations.status.${recommendation.status}`)}
                        </span>
                        <span className="ml-auto text-xs text-base-content/60">
                          {formatRelativeDateInTimezone(recommendation.createdAt)}
                        </span>
                      </div>
                      <Link to={mediaPath} className="link link-hover mt-2 block text-lg font-semibold">
                        {mediaTitle(recommendation)}
                      </Link>
                      {recommendation.message && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-base-content/80">
                          {recommendation.message}
                        </p>
                      )}
                      <div className="card-actions mt-3">
                        <Link to={mediaPath} className="btn btn-ghost btn-sm">
                          <ExternalLink className="h-4 w-4" />
                          {t('recommendations.openMedia')}
                        </Link>
                        {direction === 'received' &&
                          !['accepted', 'dismissed'].includes(recommendation.status) && (
                            <>
                              {recommendation.status === 'pending' && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  disabled={statusMutation.isPending}
                                  onClick={() =>
                                    statusMutation.mutate({
                                      id: recommendation._id,
                                      status: 'viewed',
                                    })
                                  }
                                >
                                  <Clock3 className="h-4 w-4" />
                                  {t('recommendations.markViewed')}
                                </button>
                              )}
                              <button
                                className="btn btn-success btn-sm"
                                disabled={statusMutation.isPending}
                                onClick={() =>
                                  statusMutation.mutate({
                                    id: recommendation._id,
                                    status: 'accepted',
                                  })
                                }
                              >
                                <Check className="h-4 w-4" />
                                {t('recommendations.accept')}
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                disabled={statusMutation.isPending}
                                onClick={() =>
                                  statusMutation.mutate({
                                    id: recommendation._id,
                                    status: 'dismissed',
                                  })
                                }
                              >
                                <X className="h-4 w-4" />
                                {t('recommendations.dismiss')}
                              </button>
                            </>
                          )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {recommendationsQuery.data.pages > 1 && (
            <div className="join mt-6 flex justify-center">
              <button
                className="join-item btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {t('lists.pagination.previous')}
              </button>
              <span className="join-item btn btn-active btn-sm pointer-events-none">
                {t('lists.pagination.page', { page })}
              </span>
              <button
                className="join-item btn btn-sm"
                disabled={page >= recommendationsQuery.data.pages}
                onClick={() => setPage(page + 1)}
              >
                {t('lists.pagination.next')}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="card surface">
          <div className="card-body items-center py-16 text-center">
            <Inbox className="h-10 w-10 text-base-content/40" />
            <h2 className="card-title">{t('recommendations.emptyTitle')}</h2>
            <p className="text-base-content/60">
              {direction === 'received'
                ? t('recommendations.emptyReceived')
                : t('recommendations.emptySent')}
            </p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
