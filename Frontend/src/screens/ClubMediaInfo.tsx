import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getGlobalMediaStatsFn } from '../api/trackerApi';
import { OutletClubMediaContextType } from '../types';

export default function ClubMediaInfo() {
  const { club, clubMedia } = useOutletContext<OutletClubMediaContextType>();

  // Fetch media stats (for global ranking comparison)
  const { data: mediaStats } = useQuery({
    queryKey: ['mediaStats', clubMedia?.mediaId],
    queryFn: () =>
      getGlobalMediaStatsFn(clubMedia!.mediaId, clubMedia!.mediaType),
    enabled: !!clubMedia?.mediaId,
  });

  if (!club || !clubMedia) {
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
        {/* Media Stats */}
        {mediaStats && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h3 className="card-title">Global Statistics</h3>
              <div className="stats stats-vertical lg:stats-horizontal shadow">
                <div className="stat">
                  <div className="stat-title">Total Logs</div>
                  <div className="stat-value text-primary">
                    {mediaStats.total.logs}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-title">Total XP</div>
                  <div className="stat-value text-secondary">
                    {mediaStats.total.xp.toLocaleString()}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-title">Activity Period</div>
                  <div className="stat-value text-accent text-sm">
                    {mediaStats.total.firstLogDate &&
                    mediaStats.total.lastLogDate ? (
                      <>
                        {new Date(
                          mediaStats.total.firstLogDate
                        ).toLocaleDateString()}{' '}
                        -
                        {new Date(
                          mediaStats.total.lastLogDate
                        ).toLocaleDateString()}
                      </>
                    ) : (
                      'No activity'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Club Members Activity - Overview */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title">Quick Overview</h3>
            <div className="text-base-content/70">
              <p>
                See club member activity in the "Member Activity" tab above.
              </p>
              <p className="text-sm mt-2">
                The activity tab shows all logs from club members for this media
                since the consumption period started.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
