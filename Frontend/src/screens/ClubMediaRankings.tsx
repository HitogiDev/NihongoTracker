import { useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MdTrendingUp } from 'react-icons/md';
import { getClubMediaRankingsFn } from '../api/clubApi';
import { OutletClubMediaContextType } from '../types';

export default function ClubMediaRankings() {
  const { clubId, mediaId } = useParams<{ clubId: string; mediaId: string }>();
  const { clubMedia } = useOutletContext<OutletClubMediaContextType>();

  // Fetch club member rankings for this media
  const { data: clubRankingsData, isLoading: rankingsLoading } = useQuery({
    queryKey: ['clubMediaRankings', clubId, mediaId],
    queryFn: () => getClubMediaRankingsFn(clubId!, mediaId!),
    enabled: !!clubId && !!mediaId && !!clubMedia,
  });

  if (!clubMedia) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="text-center py-12 text-base-content/60">
          <h3 className="text-lg font-semibold mb-2">Loading...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="space-y-6">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">Club Member Rankings</h3>
            <p className="text-base-content/70 mb-4">
              How club members rank based on their activity with this media
              since{' '}
              {clubMedia?.startDate
                ? new Date(clubMedia.startDate).toLocaleDateString()
                : 'the start date'}
            </p>

            {rankingsLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : clubRankingsData?.rankings &&
              clubRankingsData.rankings.length > 0 ? (
              <div className="space-y-3">
                {clubRankingsData.rankings.map((ranking, index) => (
                  <div
                    key={ranking.user._id}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      index < 3
                        ? 'bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20'
                        : 'bg-base-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`badge ${
                          index === 0
                            ? 'badge-warning'
                            : index === 1
                              ? 'badge-info'
                              : index === 2
                                ? 'badge-accent'
                                : 'badge-neutral'
                        } badge-lg font-bold`}
                      >
                        {ranking.rank}
                      </div>
                      <div className="avatar">
                        <div className="w-10 h-10 rounded-full">
                          {ranking.user.avatar ? (
                            <img
                              src={ranking.user.avatar}
                              alt={ranking.user.username}
                              className="rounded-full w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-semibold text-sm">
                                {ranking.user.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold">
                          {ranking.user.username}
                        </h4>
                        <div className="flex gap-4 text-xs text-base-content/60">
                          <span>{ranking.totalLogs} logs</span>
                          {ranking.totalEpisodes > 0 && (
                            <span>{ranking.totalEpisodes} episodes</span>
                          )}
                          {ranking.totalPages > 0 && (
                            <span>{ranking.totalPages} pages</span>
                          )}
                          {ranking.totalTime > 0 && (
                            <span>{ranking.totalTime} min</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">
                        {ranking.totalXp.toLocaleString()} XP
                      </div>
                      {ranking.firstLog && (
                        <div className="text-xs text-base-content/60">
                          Since{' '}
                          {new Date(ranking.firstLog).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-base-content/60">
                <MdTrendingUp className="mx-auto text-4xl mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Rankings Yet</h3>
                <p>
                  No club members have logged this media since the consumption
                  period started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
