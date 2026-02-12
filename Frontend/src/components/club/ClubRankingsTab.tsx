import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Zap,
  ListOrdered,
  Clock,
  Star,
  BarChart,
  Calendar1,
} from 'lucide-react';
import { getClubMemberRankingsFn } from '../../api/clubApi';
import { numberWithCommas } from '../../utils/utils';
import { getPatreonBadgeProps } from '../../utils/patreonBadge';

interface ClubRankingsTabProps {
  clubId: string;
}

type ClubMember = {
  user: {
    _id: string;
    username: string;
    avatar?: string;
    stats: {
      userLevel: number;
      userXp: number;
    };
    patreon?: {
      isActive: boolean;
      tier: 'donator' | 'enthusiast' | 'consumer' | null;
      customBadgeText?: string;
      badgeColor?: string;
      badgeTextColor?: string;
    };
  };
  totalLogs: number;
  totalXp: number;
  totalTime: number;
  totalHours: number;
  rank: number;
  joinDate: string;
};

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
    {
      label: 'Total XP',
      value: 'totalXp' as const,
      icon: <Zap className="w-4 h-4" />,
    },
    {
      label: 'Total Logs',
      value: 'totalLogs' as const,
      icon: <ListOrdered className="w-4 h-4" />,
    },
    {
      label: 'Total Time',
      value: 'totalTime' as const,
      icon: <Clock className="w-4 h-4" />,
    },
    {
      label: 'Level',
      value: 'level' as const,
      icon: <Star className="w-4 h-4" />,
    },
  ];

  const periodOptions = [
    {
      label: 'All Time',
      value: 'all-time' as const,
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      label: 'This Month',
      value: 'month' as const,
      icon: <BarChart className="w-4 h-4" />,
    },
    {
      label: 'This Week',
      value: 'week' as const,
      icon: <Calendar1 className="w-4 h-4" />,
    },
  ];

  const getDisplayValue = (member: ClubMember) => {
    switch (sortBy) {
      case 'totalXp':
        return member.totalXp;
      case 'totalLogs':
        return member.totalLogs;
      case 'totalTime':
        return member.totalHours;
      case 'level':
        return member.user.stats.userLevel;
      default:
        return member.totalXp;
    }
  };

  const getFormattedDisplayValue = (member: ClubMember) => {
    const val = getDisplayValue(member);
    switch (sortBy) {
      case 'totalTime':
        return `${numberWithCommas(val)} hrs`;
      case 'level':
        return `Lv.${val}`;
      default:
        return numberWithCommas(val);
    }
  };

  const getValueUnit = () => {
    switch (sortBy) {
      case 'totalXp':
        return 'XP';
      case 'totalLogs':
        return 'logs';
      case 'totalTime':
        return 'hrs';
      case 'level':
        return '';
      default:
        return 'XP';
    }
  };

  const getSortLabel = () => {
    return sortOptions.find((opt) => opt.value === sortBy)?.label || 'Total XP';
  };

  const getSortIcon = () => {
    return (
      sortOptions.find((opt) => opt.value === sortBy)?.icon || (
        <Zap className="w-4 h-4" />
      )
    );
  };

  const getTimeFilterLabel = () => {
    return (
      periodOptions.find((opt) => opt.value === period)?.label || 'All Time'
    );
  };

  const getTimeFilterIcon = () => {
    return (
      periodOptions.find((opt) => opt.value === period)?.icon || (
        <Trophy className="w-4 h-4" />
      )
    );
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-warning';
      case 2:
        return 'text-base-content';
      case 3:
        return 'text-accent';
      default:
        return 'text-base-content/70';
    }
  };

  const members = rankings?.rankings || [];
  const hasTop3 = members.length >= 3;
  const firstUser = members[0];
  const secondUser = members[1];
  const thirdUser = members[2];
  const firstBadge = getPatreonBadgeProps(firstUser?.user.patreon);
  const secondBadge = getPatreonBadgeProps(secondUser?.user.patreon);
  const thirdBadge = getPatreonBadgeProps(thirdUser?.user.patreon);

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="text-center py-8 text-error">
              <Trophy className="mx-auto w-10 h-10 mb-2" />
              <p>Failed to load rankings</p>
              <p className="text-sm mt-1">Please try again later</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Trophy className="w-10 h-10 text-warning" />
          <h1 className="text-4xl font-bold text-base-content">Club Ranking</h1>
        </div>
        <p className="text-base-content/70">
          See how club members stack up against each other
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
        {/* Time Period Dropdown */}
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-outline gap-2">
            {getTimeFilterIcon()}
            {getTimeFilterLabel()}
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu p-2 shadow-xl bg-base-100 rounded-box w-52 border border-base-300"
          >
            {periodOptions.map((option) => (
              <li key={option.value}>
                <button
                  className={`gap-3 ${period === option.value ? 'active' : ''}`}
                  onClick={() => setPeriod(option.value)}
                >
                  {option.icon}
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Sort By Dropdown */}
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-primary gap-2">
            {getSortIcon()}
            {getSortLabel()}
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
          >
            {sortOptions.map((option) => (
              <li key={option.value}>
                <button
                  className={`gap-3 ${sortBy === option.value ? 'active' : ''}`}
                  onClick={() => setSortBy(option.value)}
                >
                  {option.icon}
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Rankings Content */}
      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="mt-4 text-base-content/70">Loading rankings...</p>
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="text-center py-12 text-base-content/60">
              <Trophy className="mx-auto w-12 h-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">No ranking data available</p>
              <p className="text-sm mt-2">
                Members need to log activities to appear in rankings
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-0">
            {/* Top 3 Podium */}
            {hasTop3 && (
              <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-3 sm:p-8 rounded-t-md">
                <div className="grid grid-cols-3 gap-1.5 sm:gap-4 max-w-2xl mx-auto items-end">
                  {/* 2nd Place */}
                  <div className="text-center order-1">
                    <div className="relative mb-1 sm:mb-4">
                      <div className="avatar">
                        <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full ring ring-base-content/40">
                          {secondUser?.user.avatar ? (
                            <img
                              src={secondUser.user.avatar}
                              alt={`${secondUser.user.username}'s Avatar`}
                            />
                          ) : (
                            <div className="bg-neutral-content flex items-center justify-center h-full">
                              <span className="text-sm sm:text-xl font-bold">
                                {secondUser?.user.username
                                  ?.charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="badge badge-xs sm:badge-sm bg-base-content text-base-100 font-bold">
                        2nd
                      </div>
                      <Link
                        to={`/user/${secondUser?.user.username ?? ''}`}
                        className="font-bold hover:underline text-xs sm:text-sm flex items-center justify-center gap-1 flex-wrap max-w-full"
                      >
                        <span className="truncate max-w-[4.5rem] sm:max-w-none">
                          {secondUser?.user.username}
                        </span>
                        {secondBadge && (
                          <div
                            className={`badge badge-xs gap-1 hidden sm:inline-flex max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap ${secondBadge.colorClass}`}
                            style={secondBadge.style}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="font-bold max-w-[5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                              {secondBadge.text}
                            </span>
                          </div>
                        )}
                      </Link>
                    </div>
                    <div className="text-xs sm:text-sm text-base-content/70">
                      Lv.{secondUser?.user.stats.userLevel ?? 1}
                    </div>
                    <div className="text-sm sm:text-lg font-bold text-base-content mt-1">
                      {secondUser ? getFormattedDisplayValue(secondUser) : null}
                    </div>
                  </div>

                  {/* 1st Place */}
                  <div className="text-center order-2">
                    <div className="relative mb-2 sm:mb-4">
                      <div className="avatar">
                        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full ring ring-warning ring-offset-2">
                          {firstUser?.user.avatar ? (
                            <img
                              src={firstUser.user.avatar}
                              alt={`${firstUser.user.username}'s Avatar`}
                            />
                          ) : (
                            <div className="bg-neutral-content flex items-center justify-center h-full">
                              <span className="text-lg sm:text-2xl font-bold">
                                {firstUser?.user.username
                                  ?.charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="absolute -top-4 sm:-top-6 left-1/2 transform -translate-x-1/2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="none"
                          className="w-7 h-7 sm:w-9 sm:h-9 text-warning"
                        >
                          <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="badge badge-xs sm:badge-sm bg-warning text-warning-content font-bold">
                        1st
                      </div>
                      <Link
                        to={`/user/${firstUser?.user.username ?? ''}`}
                        className="font-bold hover:underline text-xs sm:text-base flex items-center justify-center gap-1 flex-wrap max-w-full"
                      >
                        <span className="truncate max-w-[4.5rem] sm:max-w-none">
                          {firstUser?.user.username}
                        </span>
                        {firstBadge && (
                          <div
                            className={`badge badge-xs gap-1 hidden sm:inline-flex max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap ${firstBadge.colorClass}`}
                            style={firstBadge.style}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="font-bold max-w-[5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                              {firstBadge.text}
                            </span>
                          </div>
                        )}
                      </Link>
                    </div>
                    <div className="text-xs sm:text-sm text-base-content/70">
                      Lv.{firstUser?.user.stats.userLevel ?? 1}
                    </div>
                    <div className="text-base sm:text-xl font-bold text-warning mt-1">
                      {firstUser ? getFormattedDisplayValue(firstUser) : null}
                    </div>
                  </div>

                  {/* 3rd Place */}
                  <div className="text-center order-3">
                    <div className="relative mb-1 sm:mb-4">
                      <div className="avatar">
                        <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-full ring ring-accent/50">
                          {thirdUser?.user.avatar ? (
                            <img
                              src={thirdUser.user.avatar}
                              alt={`${thirdUser.user.username}'s Avatar`}
                            />
                          ) : (
                            <div className="bg-neutral-content flex items-center justify-center h-full">
                              <span className="text-sm sm:text-xl font-bold">
                                {thirdUser?.user.username
                                  ?.charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="badge badge-xs sm:badge-sm bg-accent text-accent-content font-bold">
                        3rd
                      </div>
                      <Link
                        to={`/user/${thirdUser?.user.username ?? ''}`}
                        className="font-bold hover:underline text-xs sm:text-sm flex items-center justify-center gap-1 flex-wrap max-w-full"
                      >
                        <span className="truncate max-w-[4.5rem] sm:max-w-none">
                          {thirdUser?.user.username}
                        </span>
                        {thirdBadge && (
                          <div
                            className={`badge badge-xs gap-1 hidden sm:inline-flex max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap ${thirdBadge.colorClass}`}
                            style={thirdBadge.style}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="font-bold max-w-[5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                              {thirdBadge.text}
                            </span>
                          </div>
                        )}
                      </Link>
                    </div>
                    <div className="text-xs sm:text-sm text-base-content/70">
                      Lv.{thirdUser?.user.stats.userLevel ?? 1}
                    </div>
                    <div className="text-sm sm:text-lg font-bold text-base-content mt-1">
                      {thirdUser ? getFormattedDisplayValue(thirdUser) : null}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Full Rankings Table */}
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-base-300">
                    <th className="text-center w-10 sm:w-16">Rank</th>
                    <th>Member</th>
                    <th className="text-center hidden sm:table-cell">Level</th>
                    <th className="text-end">{getSortLabel()}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    if (hasTop3 && member.rank <= 3) return null;

                    const patreonBadge = getPatreonBadgeProps(
                      member.user.patreon
                    );

                    return (
                      <tr key={member.user._id}>
                        <td className="text-center">
                          <div
                            className={`flex items-center justify-center gap-1 sm:gap-2 ${getRankColor(member.rank)}`}
                          >
                            <span className="font-bold text-sm sm:text-lg">
                              {member.rank}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="avatar">
                              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full ring ring-base-content/10">
                                {member.user.avatar ? (
                                  <img
                                    src={member.user.avatar}
                                    alt={`${member.user.username}'s Avatar`}
                                  />
                                ) : (
                                  <div className="bg-neutral-content flex items-center justify-center h-full">
                                    <span className="text-xs sm:text-lg font-bold">
                                      {member.user.username
                                        .charAt(0)
                                        .toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={`/user/${member.user.username}`}
                                className="font-bold hover:text-primary transition-colors flex items-center gap-2 flex-nowrap max-w-full"
                                title={`View ${member.user.username}'s profile`}
                              >
                                <span className="hidden md:inline">
                                  {member.user.username}
                                </span>
                                <span className="inline md:hidden truncate max-w-[6rem] sm:max-w-[8rem]">
                                  {member.user.username}
                                </span>
                                {patreonBadge && (
                                  <div
                                    className={`badge badge-sm gap-1 hidden sm:inline-flex ${patreonBadge.colorClass} md:max-w-none md:overflow-visible md:whitespace-normal max-w-[8rem] overflow-hidden text-ellipsis whitespace-nowrap`}
                                    style={patreonBadge.style}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3 w-3"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <span className="font-bold md:max-w-none md:overflow-visible md:whitespace-normal max-w-[5.5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                                      {patreonBadge.text}
                                    </span>
                                  </div>
                                )}
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="text-center hidden sm:table-cell">
                          <div className="badge badge-outline">
                            Lv.{member.user.stats.userLevel}
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="font-bold text-sm sm:text-lg">
                            {numberWithCommas(getDisplayValue(member))}
                          </div>
                          {getValueUnit() && (
                            <div className="text-xs text-base-content/60">
                              {getValueUnit()}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClubRankingsTab;
