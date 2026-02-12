import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';

import { Users, BarChart, TrendingUp, ChevronDown, Crown } from 'lucide-react';

import { getUserClubsFn, getClubMemberRankingsFn } from '../../api/clubApi';
import { numberWithCommas } from '../../utils/utils';

interface ClubRankingProps {
  username: string;
}

function ClubRanking({ username }: ClubRankingProps) {
  // Fetch user's clubs
  const {
    data: userClubs,
    isLoading: isClubsLoading,
    error: clubsError,
  } = useQuery({
    queryKey: ['userClubs'],
    queryFn: () => getUserClubsFn(),
  });

  // State for selected club
  const [selectedClubId, setSelectedClubId] = useState<string>('');

  // Set default selected club when clubs are loaded
  const selectedClub =
    userClubs?.find((club) => club._id === selectedClubId) || userClubs?.[0];

  // Update selected club ID when clubs are first loaded
  if (userClubs && userClubs.length > 0 && !selectedClubId) {
    setSelectedClubId(userClubs[0]._id);
  }

  // Fetch club rankings for the selected club
  const {
    data: clubRankings,
    isLoading: isRankingsLoading,
    error: rankingsError,
  } = useQuery({
    queryKey: ['clubMemberRankings', selectedClub?._id, 'totalXp', 'all-time'],
    queryFn: () =>
      getClubMemberRankingsFn(selectedClub!._id, {
        sortBy: 'totalXp',
        period: 'all-time',
        limit: 50,
        page: 1,
      }),
    enabled: !!selectedClub,
  });

  // Find user's ranking in the club
  const userRanking = clubRankings?.rankings?.find(
    (ranking) => ranking.user.username === username
  );

  // Don't render if user has no clubs
  if (!userClubs || userClubs.length === 0) {
    return null;
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="text-warning text-xl w-4 h-4" />;
    if (rank <= 3) return <span className="text-lg">🏆</span>;
    if (rank <= 10) return <span className="text-lg">🥇</span>;
    return null;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-warning';
    if (rank === 2) return 'text-base-content';
    if (rank === 3) return 'text-accent';
    return 'text-base-content/70';
  };

  if (clubsError || rankingsError) {
    return (
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h3 className="card-title text-lg flex items-center gap-2">
            <BarChart className="text-primary w-4 h-4" />
            Club Ranking
          </h3>
          <div className="text-center py-4 text-error">
            <p className="text-sm">Failed to load club ranking</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-title text-lg flex items-center gap-2">
            <BarChart className="text-primary w-4 h-4" />
            Club Ranking
          </h3>
          {/* Club Selection Dropdown (only show if user has multiple clubs) */}
          {userClubs && userClubs.length > 1 && (
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-sm btn-ghost">
                {selectedClub?.name || 'Select Club'}
                <ChevronDown className="w-4 h-4" />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow"
              >
                {userClubs.map((club) => (
                  <li key={club._id}>
                    <a
                      onClick={() => setSelectedClubId(club._id)}
                      className={selectedClub?._id === club._id ? 'active' : ''}
                    >
                      {club.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {isClubsLoading || isRankingsLoading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected Club Info */}
            {selectedClub && (
              <div className="flex items-center gap-3 p-3 bg-base-200/50 rounded-lg">
                <div className="avatar">
                  <div className="w-10 h-10 rounded-full">
                    {selectedClub.avatar ? (
                      <img
                        src={selectedClub.avatar}
                        alt={selectedClub.name}
                        className="rounded-full w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="text-primary w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <Link
                    to={`/clubs/${selectedClub._id}`}
                    className="font-medium hover:underline hover:text-primary transition-colors"
                  >
                    {selectedClub.name}
                  </Link>
                  <p className="text-xs text-base-content/60">
                    {selectedClub.members?.length || 0} members
                  </p>
                </div>
              </div>
            )}

            {/* User's Ranking */}
            {userRanking ? (
              <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center gap-2 ${getRankColor(userRanking.rank)}`}
                    >
                      {getRankIcon(userRanking.rank)}
                      <span className="font-bold text-2xl">
                        #{userRanking.rank}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">Your Position</p>
                      <p className="text-sm text-base-content/60">
                        out of {clubRankings?.pagination.total || 0} members
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-primary">
                      <TrendingUp className="w-4 h-4" />
                      <span className="font-bold text-lg">
                        {numberWithCommas(userRanking.totalXp)}
                      </span>
                    </div>
                    <p className="text-xs text-base-content/60">Total XP</p>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-base-content/10">
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      {numberWithCommas(userRanking.totalLogs)}
                    </p>
                    <p className="text-xs text-base-content/60">Logs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      {numberWithCommas(userRanking.totalHours)}h
                    </p>
                    <p className="text-xs text-base-content/60">Time</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">
                      Lv.{userRanking.user.stats.userLevel}
                    </p>
                    <p className="text-xs text-base-content/60">Level</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-base-content/60">
                <p className="text-sm">No ranking data available yet</p>
                <p className="text-xs mt-1">
                  Start logging to appear in rankings!
                </p>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <Link
                to={`/clubs/${selectedClub?._id}?tab=rankings`}
                className="btn btn-ghost btn-sm"
              >
                View Club
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClubRanking;
