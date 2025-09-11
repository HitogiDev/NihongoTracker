import { useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getClubMediaStatsFn } from '../api/clubApi';
import { OutletClubMediaContextType } from '../types';
import { useState } from 'react';
import {
  MdPeople,
  MdLibraryBooks,
  MdTimer,
  MdStars,
  MdTrendingUp,
  MdCalendarToday,
} from 'react-icons/md';

export default function ClubMediaInfo() {
  const { club, clubMedia } = useOutletContext<OutletClubMediaContextType>();
  const { clubId, mediaId } = useParams<{ clubId: string; mediaId: string }>();
  const [period, setPeriod] = useState<'consumption' | 'alltime'>(
    'consumption'
  );

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
            icon: MdLibraryBooks,
          },
          secondary: { label: 'Hours', value: stats.hours, icon: MdTimer },
        };
      case 'manga':
        return {
          primary: {
            label: 'Chapters',
            value: stats.pages,
            icon: MdLibraryBooks,
          },
          secondary: {
            label: 'Pages',
            value: stats.pages,
            icon: MdLibraryBooks,
          },
        };
      case 'reading':
      case 'vn':
        return {
          primary: {
            label: 'Characters',
            value: stats.characters.toLocaleString(),
            icon: MdLibraryBooks,
          },
          secondary: { label: 'Hours', value: stats.hours, icon: MdTimer },
        };
      case 'video':
      case 'movie':
        return {
          primary: { label: 'Hours', value: stats.hours, icon: MdTimer },
          secondary: {
            label: 'Minutes',
            value: stats.minutes.toLocaleString(),
            icon: MdTimer,
          },
        };
      default:
        return {
          primary: { label: 'Hours', value: stats.hours, icon: MdTimer },
          secondary: {
            label: 'XP',
            value: stats.xp.toLocaleString(),
            icon: MdStars,
          },
        };
    }
  };

  const typeSpecificStats = getMediaTypeSpecificStats();

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="space-y-6">
        {/* Period Toggle */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <div className="flex justify-between items-center">
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
                  <MdCalendarToday className="w-4 h-4 mr-1" />
                  Consumption Period
                </button>
                <button
                  className={`btn btn-sm join-item ${
                    period === 'alltime'
                      ? 'btn-active btn-primary'
                      : 'btn-outline'
                  }`}
                  onClick={() => setPeriod('alltime')}
                >
                  <MdTrendingUp className="w-4 h-4 mr-1" />
                  All Time
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
                <MdLibraryBooks className="w-8 h-8" />
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
                <MdPeople className="w-8 h-8" />
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
                <MdStars className="w-8 h-8" />
              </div>
              <div className="stat-title">Total XP</div>
              <div className="stat-value text-warning">
                {mediaStats.total.xp.toLocaleString()}
              </div>
              <div className="stat-desc">Experience earned</div>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {mediaStats && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h3 className="card-title mb-4">Recent Activity</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* This Week */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-base-content/70">
                    This Week
                  </h4>
                  <div className="stats stats-vertical shadow">
                    <div className="stat py-2">
                      <div className="stat-title text-xs">Logs</div>
                      <div className="stat-value text-lg">
                        {mediaStats.thisWeek.logs}
                      </div>
                    </div>
                    <div className="stat py-2">
                      <div className="stat-title text-xs">Active Members</div>
                      <div className="stat-value text-lg">
                        {mediaStats.thisWeek.activeMembers}
                      </div>
                    </div>
                    <div className="stat py-2">
                      <div className="stat-title text-xs">XP Earned</div>
                      <div className="stat-value text-lg">
                        {mediaStats.thisWeek.xp}
                      </div>
                    </div>
                  </div>
                </div>

                {/* This Month */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-base-content/70">
                    This Month
                  </h4>
                  <div className="stats stats-vertical shadow">
                    <div className="stat py-2">
                      <div className="stat-title text-xs">Logs</div>
                      <div className="stat-value text-lg">
                        {mediaStats.thisMonth.logs}
                      </div>
                    </div>
                    <div className="stat py-2">
                      <div className="stat-title text-xs">Active Members</div>
                      <div className="stat-value text-lg">
                        {mediaStats.thisMonth.activeMembers}
                      </div>
                    </div>
                    <div className="stat py-2">
                      <div className="stat-title text-xs">XP Earned</div>
                      <div className="stat-value text-lg">
                        {mediaStats.thisMonth.xp}
                      </div>
                    </div>
                  </div>
                </div>
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
