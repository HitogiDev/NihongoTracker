import { useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getClubMediaStatsFn } from '../api/clubApi';
import { OutletClubMediaContextType } from '../types';
import { useState } from 'react';
import {
  Users,
  Files,
  Timer,
  Star,
  TrendingUp,
  Calendar,
  ChartNoAxesColumn,
  ChartLine,
} from 'lucide-react';
import BarChart from '../components/BarChart';
import ProgressChart from '../components/ProgressChart';

export default function ClubMediaInfo() {
  const { club, clubMedia } = useOutletContext<OutletClubMediaContextType>();
  const { clubId, mediaId } = useParams<{ clubId: string; mediaId: string }>();
  const [period, setPeriod] = useState<'consumption' | 'alltime'>(
    'consumption'
  );
  const [chartView, setChartView] = useState<'progress' | 'bar'>('progress');

  const { data: mediaStats, isLoading } = useQuery({
    queryKey: ['clubMediaStats', clubId, mediaId, period],
    queryFn: () => getClubMediaStatsFn(clubId!, mediaId!, period),
    enabled: !!clubId && !!mediaId && !!clubMedia,
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content/60">Loading statistics...</p>
        </div>
      </div>
    );
  }

  const getMediaTypeSpecificStats = () => {
    if (!mediaStats) return null;

    const mediaType = mediaStats.mediaInfo.mediaType;
    const stats = mediaStats.total;

    switch (mediaType) {
      case 'anime':
        return {
          primary: {
            label: 'Episodes',
            value: stats.episodes,
            icon: Files,
          },
          secondary: { label: 'Hours', value: stats.hours, icon: Timer },
        };
      case 'manga':
        return {
          primary: {
            label: 'Chapters',
            value: stats.pages,
            icon: Files,
          },
          secondary: {
            label: 'Pages',
            value: stats.pages,
            icon: Files,
          },
        };
      case 'reading':
      case 'vn':
        return {
          primary: {
            label: 'Characters',
            value: stats.characters.toLocaleString(),
            icon: Files,
          },
          secondary: { label: 'Hours', value: stats.hours, icon: Timer },
        };
      case 'video':
      case 'movie':
        return {
          primary: { label: 'Hours', value: stats.hours, icon: Timer },
          secondary: {
            label: 'Minutes',
            value: stats.minutes.toLocaleString(),
            icon: Timer,
          },
        };
      default:
        return {
          primary: { label: 'Hours', value: stats.hours, icon: Timer },
          secondary: {
            label: 'XP',
            value: stats.xp.toLocaleString(),
            icon: Star,
          },
        };
    }
  };

  const typeSpecificStats = getMediaTypeSpecificStats();
  const mediaType = mediaStats?.mediaInfo.mediaType;

  // Helper function to determine if consumption period is greater than 30 days
  const isConsumptionPeriodLongerThanMonth = () => {
    if (!mediaStats) return false;
    const startDate = new Date(mediaStats.mediaInfo.startDate);
    const endDate = new Date(mediaStats.mediaInfo.endDate);
    const diffInMs = endDate.getTime() - startDate.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    return diffInDays > 30;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="space-y-6">
        {/* Period Toggle */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
              <div>
                <h3 className="card-title text-lg">Club Media Statistics</h3>
                <p className="text-sm text-base-content/60">
                  Statistics for{' '}
                  {mediaStats?.mediaInfo.title || clubMedia.title} from club
                  members
                </p>
              </div>
              <div className="join">
                <button
                  className={`btn btn-sm join-item ${
                    period === 'consumption'
                      ? 'btn-active btn-primary'
                      : 'btn-outline'
                  }`}
                  onClick={() => setPeriod('consumption')}
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Consumption Period</span>
                  <span className="sm:hidden">Period</span>
                </button>
                <button
                  className={`btn btn-sm join-item ${
                    period === 'alltime'
                      ? 'btn-active btn-primary'
                      : 'btn-outline'
                  }`}
                  onClick={() => setPeriod('alltime')}
                >
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">All Time</span>
                  <span className="sm:hidden">All</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Statistics */}
        {mediaStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Logs */}
            <div className="stat bg-base-100 shadow-sm rounded-lg">
              <div className="stat-figure text-primary">
                <Files className="w-8 h-8" />
              </div>
              <div className="stat-title">Total Logs</div>
              <div className="stat-value text-primary">
                {mediaStats.total.logs.toLocaleString()}
              </div>
              <div className="stat-desc">
                From {mediaStats.total.members} members
              </div>
            </div>

            {/* Active Members */}
            <div className="stat bg-base-100 shadow-sm rounded-lg">
              <div className="stat-figure text-secondary">
                <Users className="w-8 h-8" />
              </div>
              <div className="stat-title">Active Members</div>
              <div className="stat-value text-secondary">
                {mediaStats.total.members}
              </div>
              <div className="stat-desc">
                {period === 'consumption'
                  ? 'Since consumption started'
                  : 'All time participants'}
              </div>
            </div>

            {/* Type-specific primary stat */}
            {typeSpecificStats && (
              <div className="stat bg-base-100 shadow-sm rounded-lg">
                <div className="stat-figure text-accent">
                  <typeSpecificStats.primary.icon className="w-8 h-8" />
                </div>
                <div className="stat-title">
                  {typeSpecificStats.primary.label}
                </div>
                <div className="stat-value text-accent">
                  {typeSpecificStats.primary.value.toLocaleString()}
                </div>
                <div className="stat-desc">Club total</div>
              </div>
            )}

            {/* Total XP */}
            <div className="stat bg-base-100 shadow-sm rounded-lg">
              <div className="stat-figure text-warning">
                <Star className="w-8 h-8" />
              </div>
              <div className="stat-title">Total XP</div>
              <div className="stat-value text-warning">
                {mediaStats.total.xp.toLocaleString()}
              </div>
              <div className="stat-desc">Experience earned</div>
            </div>
          </div>
        )}

        {/* Activity Overview */}
        {mediaStats && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h3 className="card-title mb-4">Your Activity Overview</h3>

              {/* This Week Stats - Horizontal Layout */}
              <div className="mb-6">
                <h4 className="font-semibold text-sm uppercase tracking-wide text-base-content/70 mb-3">
                  This Week
                </h4>
                <div className="stats stats-horizontal shadow w-full">
                  <div className="stat">
                    <div className="stat-figure text-primary">
                      <Files className="w-6 h-6" />
                    </div>
                    <div className="stat-title">Logs</div>
                    <div className="stat-value text-primary">
                      {mediaStats.thisWeek.logs}
                    </div>
                    <div className="stat-desc">New entries</div>
                  </div>

                  <div className="stat">
                    <div className="stat-figure text-secondary">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="stat-title">Active Members</div>
                    <div className="stat-value text-secondary">
                      {mediaStats.thisWeek.activeMembers}
                    </div>
                    <div className="stat-desc">Contributing</div>
                  </div>

                  <div className="stat">
                    <div className="stat-figure text-accent">
                      <Star className="w-6 h-6" />
                    </div>
                    <div className="stat-title">XP Earned</div>
                    <div className="stat-value text-accent">
                      {mediaStats.thisWeek.xp.toLocaleString()}
                    </div>
                    <div className="stat-desc">Experience points</div>
                  </div>

                  {typeSpecificStats && (
                    <div className="stat">
                      <div className="stat-figure text-warning">
                        <typeSpecificStats.primary.icon className="w-6 h-6" />
                      </div>
                      <div className="stat-title">
                        {typeSpecificStats.primary.label}
                      </div>
                      <div className="stat-value text-warning">
                        {(mediaType === 'anime'
                          ? mediaStats.thisWeek.episodes
                          : mediaType === 'manga'
                            ? mediaStats.thisWeek.pages
                            : mediaType === 'reading' || mediaType === 'vn'
                              ? mediaStats.thisWeek.characters
                              : Math.round(
                                  (mediaStats.thisWeek.minutes / 60) * 100
                                ) / 100
                        ).toLocaleString()}
                      </div>
                      <div className="stat-desc">This week</div>
                    </div>
                  )}
                </div>
              </div>

              {/* This Month Stats - Only show if consumption period > 30 days */}
              {isConsumptionPeriodLongerThanMonth() && (
                <div>
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-base-content/70 mb-3">
                    This Month
                  </h4>
                  <div className="stats stats-horizontal shadow w-full">
                    <div className="stat">
                      <div className="stat-figure text-primary">
                        <Files className="w-6 h-6" />
                      </div>
                      <div className="stat-title">Logs</div>
                      <div className="stat-value text-primary">
                        {mediaStats.thisMonth.logs}
                      </div>
                      <div className="stat-desc">New entries</div>
                    </div>

                    <div className="stat">
                      <div className="stat-figure text-secondary">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="stat-title">Active Members</div>
                      <div className="stat-value text-secondary">
                        {mediaStats.thisMonth.activeMembers}
                      </div>
                      <div className="stat-desc">Contributing</div>
                    </div>

                    <div className="stat">
                      <div className="stat-figure text-accent">
                        <Star className="w-6 h-6" />
                      </div>
                      <div className="stat-title">XP Earned</div>
                      <div className="stat-value text-accent">
                        {mediaStats.thisMonth.xp.toLocaleString()}
                      </div>
                      <div className="stat-desc">Experience points</div>
                    </div>

                    {typeSpecificStats && (
                      <div className="stat">
                        <div className="stat-figure text-warning">
                          <typeSpecificStats.primary.icon className="w-6 h-6" />
                        </div>
                        <div className="stat-title">
                          {typeSpecificStats.primary.label}
                        </div>
                        <div className="stat-value text-warning">
                          {(mediaType === 'anime'
                            ? mediaStats.thisMonth.episodes
                            : mediaType === 'manga'
                              ? mediaStats.thisMonth.pages
                              : mediaType === 'reading' || mediaType === 'vn'
                                ? mediaStats.thisMonth.characters
                                : Math.round(
                                    (mediaStats.thisMonth.minutes / 60) * 100
                                  ) / 100
                          ).toLocaleString()}
                        </div>
                        <div className="stat-desc">This month</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Visualization */}
        {mediaStats && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-4">
                <h3 className="card-title">Activity Visualization</h3>
                <div className="join">
                  <button
                    className={`btn btn-sm join-item ${
                      chartView === 'progress'
                        ? 'btn-active btn-primary'
                        : 'btn-outline'
                    }`}
                    onClick={() => setChartView('progress')}
                  >
                    <ChartLine className="w-4 h-4 mr-1" />
                    Progress
                  </button>
                  <button
                    className={`btn btn-sm join-item ${
                      chartView === 'bar'
                        ? 'btn-active btn-primary'
                        : 'btn-outline'
                    }`}
                    onClick={() => setChartView('bar')}
                  >
                    <ChartNoAxesColumn className="w-4 h-4 mr-1" />
                    Bar Chart
                  </button>
                </div>
              </div>

              <div className="w-full" style={{ height: '450px' }}>
                {chartView === 'progress' ? (
                  <ProgressChart
                    statsData={[
                      {
                        type: 'all',
                        count: mediaStats.total.logs,
                        totalXp: mediaStats.total.xp,
                        totalTimeMinutes: mediaStats.total.minutes,
                        totalTimeHours: mediaStats.total.hours,
                        untrackedCount: 0,
                        dates: [
                          {
                            date: new Date(
                              mediaStats.total.firstLogDate || new Date()
                            ),
                            xp: mediaStats.thisWeek.xp,
                            time: mediaStats.thisWeek.minutes,
                            episodes: mediaStats.thisWeek.episodes,
                          },
                          {
                            date: new Date(
                              mediaStats.total.lastLogDate || new Date()
                            ),
                            xp: mediaStats.thisMonth.xp,
                            time: mediaStats.thisMonth.minutes,
                            episodes: mediaStats.thisMonth.episodes,
                          },
                        ],
                      },
                    ]}
                    selectedType="all"
                    timeframe="total"
                  />
                ) : (
                  <BarChart
                    data={(() => {
                      const mediaType = mediaStats.mediaInfo.mediaType;
                      const showThisMonth =
                        isConsumptionPeriodLongerThanMonth();

                      // Prepare labels and data based on period length
                      const labels = showThisMonth
                        ? ['This Week', 'This Month', 'Total']
                        : ['This Week', 'Total'];

                      const baseDatasets = [
                        {
                          label: 'Logs',
                          data: showThisMonth
                            ? [
                                mediaStats.thisWeek.logs,
                                mediaStats.thisMonth.logs,
                                mediaStats.total.logs,
                              ]
                            : [mediaStats.thisWeek.logs, mediaStats.total.logs],
                          backgroundColor: 'rgba(59, 130, 246, 0.5)',
                          borderColor: 'rgba(59, 130, 246, 1)',
                          borderWidth: 1,
                        },
                        {
                          label: 'XP Earned',
                          data: showThisMonth
                            ? [
                                mediaStats.thisWeek.xp,
                                mediaStats.thisMonth.xp,
                                mediaStats.total.xp,
                              ]
                            : [mediaStats.thisWeek.xp, mediaStats.total.xp],
                          backgroundColor: 'rgba(16, 185, 129, 0.5)',
                          borderColor: 'rgba(16, 185, 129, 1)',
                          borderWidth: 1,
                        },
                        {
                          label: 'Active Members',
                          data: showThisMonth
                            ? [
                                mediaStats.thisWeek.activeMembers,
                                mediaStats.thisMonth.activeMembers,
                                mediaStats.total.members,
                              ]
                            : [
                                mediaStats.thisWeek.activeMembers,
                                mediaStats.total.members,
                              ],
                          backgroundColor: 'rgba(245, 158, 11, 0.5)',
                          borderColor: 'rgba(245, 158, 11, 1)',
                          borderWidth: 1,
                        },
                      ];

                      // Add media-type specific dataset
                      if (mediaType === 'anime') {
                        baseDatasets.push({
                          label: 'Episodes Watched',
                          data: showThisMonth
                            ? [
                                mediaStats.thisWeek.episodes,
                                mediaStats.thisMonth.episodes,
                                mediaStats.total.episodes,
                              ]
                            : [
                                mediaStats.thisWeek.episodes,
                                mediaStats.total.episodes,
                              ],
                          backgroundColor: 'rgba(168, 85, 247, 0.5)',
                          borderColor: 'rgba(168, 85, 247, 1)',
                          borderWidth: 1,
                        });
                      } else if (
                        mediaType === 'manga' ||
                        mediaType === 'reading'
                      ) {
                        baseDatasets.push({
                          label:
                            mediaType === 'manga'
                              ? 'Chapters Read'
                              : 'Pages Read',
                          data: showThisMonth
                            ? [
                                mediaStats.thisWeek.pages,
                                mediaStats.thisMonth.pages,
                                mediaStats.total.pages,
                              ]
                            : [
                                mediaStats.thisWeek.pages,
                                mediaStats.total.pages,
                              ],
                          backgroundColor: 'rgba(168, 85, 247, 0.5)',
                          borderColor: 'rgba(168, 85, 247, 1)',
                          borderWidth: 1,
                        });
                      } else if (
                        mediaType === 'reading' ||
                        mediaType === 'vn'
                      ) {
                        baseDatasets.push({
                          label: 'Characters Read',
                          data: showThisMonth
                            ? [
                                mediaStats.thisWeek.characters,
                                mediaStats.thisMonth.characters,
                                mediaStats.total.characters,
                              ]
                            : [
                                mediaStats.thisWeek.characters,
                                mediaStats.total.characters,
                              ],
                          backgroundColor: 'rgba(168, 85, 247, 0.5)',
                          borderColor: 'rgba(168, 85, 247, 1)',
                          borderWidth: 1,
                        });
                      }

                      return {
                        labels,
                        datasets: baseDatasets,
                      };
                    })()}
                    options={{
                      scales: {
                        y: {
                          title: {
                            display: true,
                            text: 'Count',
                          },
                        },
                        x: {
                          title: {
                            display: true,
                            text: 'Time Period',
                          },
                        },
                      },
                      plugins: {
                        title: {
                          display: true,
                          text: `Club Activity for ${mediaStats.mediaInfo.title}`,
                        },
                      },
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Activity Period Info */}
        {mediaStats && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h3 className="card-title">Activity Period</h3>
              <div className="text-base-content/70">
                {period === 'consumption' ? (
                  <>
                    <p className="mb-2">
                      <strong>Consumption Period:</strong>{' '}
                      {new Date(
                        mediaStats.mediaInfo.startDate
                      ).toLocaleDateString()}{' '}
                      -{' '}
                      {new Date(
                        mediaStats.mediaInfo.endDate
                      ).toLocaleDateString()}
                    </p>
                    <p className="text-sm">
                      Showing statistics for club member activity since the
                      consumption period started.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mb-2">
                      <strong>All Time Activity:</strong>{' '}
                      {mediaStats.total.firstLogDate
                        ? `${new Date(mediaStats.total.firstLogDate).toLocaleDateString()} - ${
                            mediaStats.total.lastLogDate
                              ? new Date(
                                  mediaStats.total.lastLogDate
                                ).toLocaleDateString()
                              : 'Present'
                          }`
                        : 'No activity yet'}
                    </p>
                    <p className="text-sm">
                      Showing all-time statistics for this media from club
                      members.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
