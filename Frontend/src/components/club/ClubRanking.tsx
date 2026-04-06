import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

import {
  Users,
  BarChart,
  TrendingUp,
  ChevronDown,
  Crown,
  Medal,
} from 'lucide-react';

import { getUserClubsFn, getClubMemberRankingsFn } from '../../api/clubApi';
import { numberWithCommas } from '../../utils/utils';

const DASHBOARD_CARD_TITLE_CLASS =
  'card-title text-xl font-semibold leading-snug text-base-content';
const DASHBOARD_CARD_DESCRIPTION_CLASS = 'text-sm text-base-content/65';

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
  useEffect(() => {
    if (userClubs && userClubs.length > 0 && !selectedClubId) {
      setSelectedClubId(userClubs[0]._id);
    }
  }, [userClubs, selectedClubId]);

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
    if (rank === 1) return <Crown className="w-5 h-5" />;
    if (rank <= 3) return <Medal className="w-5 h-5" />;
    if (rank <= 10) return <TrendingUp className="w-5 h-5" />;
    return <BarChart className="w-5 h-5" />;
  };

  const getRankIconTone = (rank: number) => {
    if (rank === 1) return 'bg-warning/15 text-warning';
    if (rank <= 3) return 'bg-primary/15 text-primary';
    if (rank <= 10) return 'bg-secondary/15 text-secondary';
    return 'bg-base-300 text-base-content';
  };

  if (clubsError || rankingsError) {
    return (
      <div className="card card-border bg-base-100 shadow-sm">
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
    <div className="card card-border bg-base-100 shadow-md">
      <div className="card-body gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3
              className={`${DASHBOARD_CARD_TITLE_CLASS} flex items-center gap-2`}
            >
              <BarChart className="text-primary w-5 h-5" />
              Club Ranking
            </h3>
            <p className={`${DASHBOARD_CARD_DESCRIPTION_CLASS} mt-1`}>
              Check your standing among your club members.
            </p>
          </div>

          {userClubs && userClubs.length > 1 && (
            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-sm btn-outline max-w-[15rem]"
              >
                <span className="truncate">
                  {selectedClub?.name || 'Select Club'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box z-[1] w-56 p-2 shadow-xl border border-base-300"
              >
                {userClubs.map((club) => (
                  <li key={club._id}>
                    <button
                      type="button"
                      onClick={() => setSelectedClubId(club._id)}
                      className={
                        selectedClub?._id === club._id ? 'menu-active' : ''
                      }
                    >
                      {club.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {isClubsLoading || isRankingsLoading ? (
          <div className="space-y-3 py-2">
            <div className="skeleton h-16 w-full rounded-box"></div>
            <div className="skeleton h-28 w-full rounded-box"></div>
            <div className="skeleton h-9 w-28 ml-auto rounded-box"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedClub && (
              <div className="rounded-box border border-base-300/70 bg-base-200/35 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="avatar">
                      <div className="w-12 h-12 rounded-full">
                        {selectedClub.avatar ? (
                          <img
                            src={selectedClub.avatar}
                            alt={selectedClub.name}
                            className="rounded-full w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="text-primary w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-base-content/60">
                        Selected Club
                      </p>
                      <Link
                        to={`/clubs/${selectedClub._id}`}
                        className="font-semibold hover:underline hover:text-primary transition-colors truncate block"
                      >
                        {selectedClub.name}
                      </Link>
                    </div>
                  </div>

                  <span className="badge badge-outline bg-base-100 border-base-content/30 text-base-content font-medium whitespace-nowrap">
                    {selectedClub.members?.length || 0} members
                  </span>
                </div>
              </div>
            )}

            {userRanking ? (
              <div className="rounded-box border border-base-300 p-4 sm:p-5 bg-base-100">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center ${getRankIconTone(userRanking.rank)}`}
                    >
                      {getRankIcon(userRanking.rank)}
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-base-content/60">
                        Your Position
                      </p>
                      <div className="flex items-end gap-2">
                        <p className="text-3xl leading-none font-bold tabular-nums text-base-content">
                          #{userRanking.rank}
                        </p>
                        <p className="text-sm text-base-content/60 pb-0.5">
                          of {clubRankings?.pagination.total || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-[11px] uppercase tracking-wide text-base-content/60">
                      Total XP
                    </p>
                    <p className="text-2xl sm:text-3xl leading-none font-bold tabular-nums text-primary mt-1">
                      {numberWithCommas(userRanking.totalXp)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="alert alert-soft">
                <span className="text-sm">
                  No ranking data available yet. Start logging to appear in club
                  rankings.
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <Link
                to={`/clubs/${selectedClub?._id}?tab=rankings`}
                className="btn btn-sm btn-primary btn-outline"
              >
                View Club Rankings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClubRanking;
