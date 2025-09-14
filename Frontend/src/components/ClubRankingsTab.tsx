import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PiCrownSimpleFill } from 'react-icons/pi';
import {
  MdLeaderboard,
  MdTrendingUp,
  MdListAlt,
  MdAccessTime,
  MdStars,
  MdExpandMore,
} from 'react-icons/md';
import { getClubMemberRankingsFn } from '../api/clubApi';
import { numberWithCommas } from '../utils/utils';

interface ClubRankingsTabProps {
  clubId: string;
}

function ClubRankingsTab({ clubId }: ClubRankingsTabProps) {
  const [sortBy, setSortBy] = useState<
    'totalXp' | 'totalLogs' | 'totalTime' | 'level'
  >('totalXp');
  const [period, setPeriod] = useState<'week' | 'month' | 'all-time'>(
    'all-time'
  );

  const {
    data: rankings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['clubMemberRankings', clubId, sortBy, period],
    queryFn: () =>
      getClubMemberRankingsFn(clubId, {
        sortBy,
        period,
        limit: 50,
        page: 1,
      }),
  });

  const sortOptions = [
    { label: 'Total XP', value: 'totalXp' as const },
    { label: 'Total Logs', value: 'totalLogs' as const },
    { label: 'Total Time', value: 'totalTime' as const },
    { label: 'Level', value: 'level' as const },
  ];

  const periodOptions = [
    { label: 'All Time', value: 'all-time' as const },
    { label: 'This Month', value: 'month' as const },
    { label: 'This Week', value: 'week' as const },
  ];

  const getDisplayValue = (member: {
    user: {
      _id: string;
      username: string;
      avatar?: string;
      stats: {
        userLevel: number;
        userXp: number;
      };
    };
    totalLogs: number;
    totalXp: number;
    totalTime: number;
    totalHours: number;
    rank: number;
    joinDate: string;
  }) => {
    switch (sortBy) {
      case 'totalXp':
        return numberWithCommas(member.totalXp);
      case 'totalLogs':
        return numberWithCommas(member.totalLogs);
      case 'totalTime':
        return `${numberWithCommas(member.totalHours)}h`;
      case 'level':
        return `Lv.${member.user.stats.userLevel}`;
      default:
        return numberWithCommas(member.totalXp);
    }
  };

  const getSortLabel = () => {
    return sortOptions.find((opt) => opt.value === sortBy)?.label || 'Total XP';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1)
      return <PiCrownSimpleFill className="text-warning text-xl" />;
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

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="text-center py-8 text-error">
              <MdLeaderboard className="mx-auto text-4xl mb-2" />
              <p>Failed to load rankings</p>
              <p className="text-sm mt-1">Please try again later</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Filters */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-6">
          <div className="flex flex-col lg:flex-row gap-6 lg:items-end">
            {/* Sort By Filter */}
            <div className="flex-1">
              <label className="label">
                <span className="label-text font-medium">Sort By</span>
              </label>
              <div className="join w-full">
                {sortOptions.map((option) => {
                  const getIcon = () => {
                    switch (option.value) {
                      case 'totalXp':
                        return <MdTrendingUp className="text-lg" />;
                      case 'totalLogs':
                        return <MdListAlt className="text-lg" />;
                      case 'totalTime':
                        return <MdAccessTime className="text-lg" />;
                      case 'level':
                        return <MdStars className="text-lg" />;
                      default:
                        return null;
                    }
                  };

                  return (
                    <button
                      key={option.value}
                      className={`btn join-item flex-1 gap-2 ${
                        sortBy === option.value ? 'btn-primary' : 'btn-outline'
                      }`}
                      onClick={() => setSortBy(option.value)}
                    >
                      {getIcon()}
                      <span className="hidden sm:inline">{option.label}</span>
                      <span className="sm:hidden">
                        {option.label.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Period Filter */}
            <div className="min-w-48">
              <label className="label">
                <span className="label-text font-medium">Time Period</span>
              </label>
              <div className="dropdown dropdown-end w-full">
                <div
                  tabIndex={0}
                  role="button"
                  className="btn btn-outline w-full justify-between"
                >
                  <span>
                    {periodOptions.find((opt) => opt.value === period)?.label ||
                      'All Time'}
                  </span>
                  <MdExpandMore className="text-lg" />
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-full border border-base-300"
                >
                  {periodOptions.map((option) => (
                    <li key={option.value}>
                      <button
                        className={`text-left ${
                          period === option.value
                            ? 'active bg-primary text-primary-content'
                            : ''
                        }`}
                        onClick={() => setPeriod(option.value)}
                      >
                        {option.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rankings Content */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-3">
              <MdLeaderboard className="text-2xl text-primary" />
              Club Member Rankings
            </h2>
            <div className="badge badge-outline badge-lg">{getSortLabel()}</div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : !rankings?.rankings || rankings.rankings.length === 0 ? (
            <div className="text-center py-12 text-base-content/60">
              <MdLeaderboard className="mx-auto text-5xl mb-4 opacity-30" />
              <p className="text-lg font-medium">No ranking data available</p>
              <p className="text-sm mt-2">
                Members need to log activities to appear in rankings
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Top 3 Podium (if we have at least 3 members) */}
              {rankings.rankings.length >= 3 && (
                <div className="bg-gradient-to-r from-warning/10 via-primary/5 to-accent/10 rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4 text-center">
                    🏆 Top Performers
                  </h3>
                  <div className="flex justify-center items-end gap-4">
                    {/* 2nd Place */}
                    <div className="text-center">
                      <div className="avatar mb-2">
                        <div className="w-16 h-16 rounded-full ring ring-base-content/20">
                          {rankings.rankings[1]?.user.avatar ? (
                            <img
                              src={rankings.rankings[1].user.avatar}
                              alt={`${rankings.rankings[1].user.username}'s Avatar`}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-bold text-xl">
                                {rankings.rankings[1]?.user.username
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="badge badge-lg bg-base-content text-base-100 mb-1">
                        2nd
                      </div>
                      <p className="font-medium">
                        {rankings.rankings[1]?.user.username}
                      </p>
                      <p className="text-sm text-base-content/70">
                        {getDisplayValue(rankings.rankings[1])}
                      </p>
                    </div>

                    {/* 1st Place */}
                    <div className="text-center">
                      <div className="avatar mb-2 relative">
                        <div className="w-20 h-20 rounded-full ring ring-warning ring-offset-2">
                          {rankings.rankings[0]?.user.avatar ? (
                            <img
                              src={rankings.rankings[0].user.avatar}
                              alt={`${rankings.rankings[0].user.username}'s Avatar`}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-bold text-2xl">
                                {rankings.rankings[0]?.user.username
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <PiCrownSimpleFill className="absolute -top-3 left-1/2 transform -translate-x-1/2 text-3xl text-warning" />
                      </div>
                      <div className="badge badge-lg badge-warning mb-1">
                        1st
                      </div>
                      <p className="font-bold text-lg">
                        {rankings.rankings[0]?.user.username}
                      </p>
                      <p className="text-sm text-warning font-medium">
                        {getDisplayValue(rankings.rankings[0])}
                      </p>
                    </div>

                    {/* 3rd Place */}
                    <div className="text-center">
                      <div className="avatar mb-2">
                        <div className="w-16 h-16 rounded-full ring ring-accent/50">
                          {rankings.rankings[2]?.user.avatar ? (
                            <img
                              src={rankings.rankings[2].user.avatar}
                              alt={`${rankings.rankings[2].user.username}'s Avatar`}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-bold text-xl">
                                {rankings.rankings[2]?.user.username
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="badge badge-lg badge-accent mb-1">
                        3rd
                      </div>
                      <p className="font-medium">
                        {rankings.rankings[2]?.user.username}
                      </p>
                      <p className="text-sm text-base-content/70">
                        {getDisplayValue(rankings.rankings[2])}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Rankings Table */}
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr className="border-b-2 border-base-300">
                      <th className="text-center w-20 text-base">Rank</th>
                      <th className="text-base">Member</th>
                      <th className="text-center text-base">Level</th>
                      <th className="text-center text-base">Joined</th>
                      <th className="text-end text-base">{getSortLabel()}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.rankings.map((member) => (
                      <tr
                        key={member.user._id}
                        className="hover:bg-base-200/50 transition-colors"
                      >
                        <td className="text-center py-4">
                          <div
                            className={`flex items-center justify-center gap-2 ${getRankColor(member.rank)}`}
                          >
                            {getRankIcon(member.rank)}
                            <span className="font-bold text-lg">
                              {member.rank}
                            </span>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="avatar">
                              <div className="w-12 h-12 rounded-full">
                                {member.user.avatar ? (
                                  <img
                                    src={member.user.avatar}
                                    alt={`${member.user.username}'s Avatar`}
                                    className="rounded-full w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-primary font-semibold">
                                      {member.user.username
                                        .charAt(0)
                                        .toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <Link
                                to={`/user/${member.user.username}`}
                                className="font-medium hover:underline hover:text-primary transition-colors"
                              >
                                {member.user.username}
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="text-center py-4">
                          <span className="badge badge-outline badge-lg">
                            Lv.{member.user.stats.userLevel}
                          </span>
                        </td>
                        <td className="text-center text-sm text-base-content/70 py-4">
                          {new Date(member.joinDate).toLocaleDateString()}
                        </td>
                        <td className="text-end py-4">
                          <span className="font-mono font-bold text-lg">
                            {getDisplayValue(member)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClubRankingsTab;
