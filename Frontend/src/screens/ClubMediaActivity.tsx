import { useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { getClubMediaLogsFn } from '../api/clubApi';
import { OutletClubMediaContextType } from '../types';

export default function ClubMediaActivity() {
  const { clubId, mediaId } = useParams<{ clubId: string; mediaId: string }>();
  const { clubMedia } = useOutletContext<OutletClubMediaContextType>();

  // Fetch club member logs for this media
  const { data: clubLogsData, isLoading: logsLoading } = useQuery({
    queryKey: ['clubMediaLogs', clubId, mediaId],
    queryFn: () => getClubMediaLogsFn(clubId!, mediaId!),
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
            <h3 className="card-title">Club Member Activity</h3>
            <p className="text-base-content/70 mb-4">
              Logs from club members for this media since{' '}
              {clubMedia?.startDate
                ? new Date(clubMedia.startDate).toLocaleDateString()
                : 'the start date'}
            </p>

            {logsLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : clubLogsData?.logs && clubLogsData.logs.length > 0 ? (
              <div className="space-y-4">
                {clubLogsData.logs.map((log) => (
                  <div key={log._id} className="card bg-base-200 shadow-sm">
                    <div className="card-body p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-10 h-10 rounded-full">
                              {log.user?.avatar ? (
                                <img
                                  src={log.user.avatar}
                                  alt={log.user.username}
                                  className="rounded-full w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-primary font-semibold text-sm">
                                    {log.user?.username
                                      ?.charAt(0)
                                      .toUpperCase() || 'U'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold">
                              {log.user?.username || 'Unknown User'}
                            </h4>
                            <p className="text-sm text-base-content/60">
                              {new Date(log.date).toLocaleDateString()} •{' '}
                              {log.xp} XP
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm text-base-content/60">
                          <div className="flex flex-col items-end gap-1">
                            {log.episodes ? (
                              <span>{log.episodes} episodes</span>
                            ) : null}
                            {log.pages ? <span>{log.pages} pages</span> : null}
                            {log.time ? <span>{log.time} minutes</span> : null}
                          </div>
                        </div>
                      </div>

                      {log.description && (
                        <p className="mt-3 text-sm text-base-content/80">
                          {log.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {clubLogsData.totalPages > 1 && (
                  <div className="text-center mt-6">
                    <p className="text-sm text-base-content/60">
                      Showing page {clubLogsData.page} of{' '}
                      {clubLogsData.totalPages} ({clubLogsData.total} total
                      logs)
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-base-content/60">
                <History className="mx-auto text-4xl mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
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
