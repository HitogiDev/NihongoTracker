import React, { useEffect, useState, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useUserDataStore } from '../store/userData';
import { getMyAchievementsFn, getUserAchievementsFn } from '../api/trackerApi';
import AchievementCard from '../components/achievements/AchievementCard';
import { RARITY_COLOR, rarityTint } from '../components/achievements/rarity';
import { AchievementRarity, AchievementCategory } from '../types';
import {
  Lock,
  Search,
  X,
  Tag,
  ChevronDown,
  CircleCheck,
  Layers,
  Trophy,
  Sparkles,
  ListFilter,
  Star,
  Flame,
  Users,
  Zap,
  Eye,
  Circle,
  Crown,
} from 'lucide-react';

const RARITY_ORDER: AchievementRarity[] = ['common', 'rare', 'epic', 'legendary', 'secret'];
const RARITY_CONFIG: Record<
  AchievementRarity,
  { label: string; icon: React.FC<{ className?: string }> }
> = {
  common: { label: 'Common', icon: Circle },
  rare: { label: 'Rare', icon: Star },
  epic: { label: 'Epic', icon: Zap },
  legendary: { label: 'Legendary', icon: Crown },
  secret: { label: 'Secret', icon: Eye },
};
const CATEGORIES: { value: AchievementCategory | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'streaks',   label: 'Streaks' },
  { value: 'immersion', label: 'Immersion' },
  { value: 'social',    label: 'Social' },
  { value: 'secret',    label: 'Secret' },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  all:       <Layers className="w-4 h-4" />,
  milestone: <Star className="w-4 h-4" />,
  streaks:   <Flame className="w-4 h-4" />,
  immersion: <Zap className="w-4 h-4" />,
  social:    <Users className="w-4 h-4" />,
  secret:    <Eye className="w-4 h-4" />,
};

export default function AchievementsScreen() {
  const { username: routeUsername } = useParams<{ username?: string }>();
  const { user: loggedUser } = useUserDataStore();
  const username = routeUsername ?? loggedUser?.username;
  const isOwner = !routeUsername || routeUsername === loggedUser?.username;

  const [filterCategory, setFilterCategory] = useState<AchievementCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'earned' | 'locked'>('all');
  const [sortBy, setSortBy] = useState<'order' | 'rarity' | 'earned'>('order');
  const [search, setSearch] = useState('');
  const [grouped, setGrouped] = useState(true);
  const [isPendingGroup, startGroupTransition] = useTransition();

  // Update document title
  useEffect(() => {
    document.title = username
      ? `${username}'s Achievements — NihongoTracker`
      : 'My Achievements — NihongoTracker';
    return () => { document.title = 'NihongoTracker'; };
  }, [username]);

  const queryFn = isOwner ? getMyAchievementsFn : () => getUserAchievementsFn(username!);
  const queryKey = isOwner ? ['myAchievements'] : ['userAchievements', username];

  const { data: achievements, isLoading, error } = useQuery({
    queryKey,
    queryFn,
    enabled: Boolean(username),
  });

  // Stats
  const earned = achievements?.filter((a) => a.isEarned) ?? [];
  const visible = achievements?.filter((a) => !a.isHidden) ?? [];
  const totalPoints = earned.reduce((sum, a) => sum + (a.points ?? 0), 0);
  const rarityBreakdown = RARITY_ORDER.map((r) => ({
    rarity: r,
    earned: earned.filter((a) => a.rarity === r).length,
    total: visible.filter((a) => a.rarity === r).length,
  }));

  // Filter and sort
  let filtered = (achievements ?? []).filter((a) => {
    if (filterCategory !== 'all' && a.category !== filterCategory) return false;
    if (filterStatus === 'earned' && !a.isEarned) return false;
    if (filterStatus === 'locked' && a.isEarned) return false;
    if (search) {
      const q = search.toLowerCase();
      if (a.isHidden && !a.isEarned) return false;
      return (
        a.name?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.key?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'rarity') {
      return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    }
    if (sortBy === 'earned') {
      if (a.isEarned && !b.isEarned) return -1;
      if (!a.isEarned && b.isEarned) return 1;
      return 0;
    }
    return (a.order ?? 99) - (b.order ?? 99);
  });

  const groupedAchievements = (() => {
    const shouldGroup = grouped && !search.trim();
    if (!shouldGroup) return { ungrouped: filtered };

    const groups: Partial<Record<AchievementRarity, typeof filtered>> = {};
    filtered.forEach((a) => {
      if (!groups[a.rarity]) groups[a.rarity] = [];
      groups[a.rarity]!.push(a);
    });

    const ordered: Record<string, typeof filtered> = {};
    RARITY_ORDER.forEach((r) => {
      if (groups[r]?.length) ordered[r] = groups[r]!;
    });
    return ordered;
  })();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3 opacity-60">
        <p>Failed to load achievements.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {routeUsername ? `${routeUsername}'s Achievements` : 'Achievements'}
        </h1>
        <p className="text-sm opacity-50 mt-1">
          Track your immersion milestones and unlock hidden secrets.
        </p>
      </div>

      {/* Stats summary bar */}
      {achievements && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-4 border border-base-300 bg-base-200/50">
            <p className="text-2xl font-extrabold">{earned.length}</p>
            <p className="text-xs opacity-50 mt-0.5">Earned</p>
          </div>
          <div className="rounded-xl p-4 border border-base-300 bg-base-200/50">
            <p className="text-2xl font-extrabold">{visible.length}</p>
            <p className="text-xs opacity-50 mt-0.5">Total</p>
          </div>
          <div className="rounded-xl p-4 border border-base-300 bg-base-200/50">
            <p className="text-2xl font-extrabold">{totalPoints.toLocaleString()}</p>
            <p className="text-xs opacity-50 mt-0.5">Points</p>
          </div>
          <div className="rounded-xl p-4 border border-base-300 bg-base-200/50">
            <p className="text-2xl font-extrabold">
              {visible.length > 0 ? Math.round((earned.length / visible.length) * 100) : 0}%
            </p>
            <p className="text-xs opacity-50 mt-0.5">Completion</p>
          </div>
        </div>
      )}

      {/* Rarity breakdown */}
      {achievements && (
        <div className="flex gap-3 flex-wrap">
          {rarityBreakdown.map(({ rarity, earned: e, total: t }) => (
            t > 0 && (
              <div
                key={rarity}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold border"
                style={{
                  borderColor: rarityTint(rarity, '40'),
                  color: RARITY_COLOR[rarity],
                  background: rarityTint(rarity, '10'),
                }}
              >
                <span className="capitalize">{rarity}</span>
                <span className="opacity-60">{e}/{t}</span>
              </div>
            )
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <label className="input input-bordered flex items-center gap-2 w-full">
          <Search className="w-4 h-4 opacity-60 shrink-0" />
          <input
            type="text"
            className="grow"
            placeholder="Search achievements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </label>

        {/* Dropdowns row */}
        <div className="flex flex-col sm:flex-row gap-3">

          {/* Category filter */}
          <div className="dropdown flex-1 sm:flex-none relative z-40">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
            >
              <Tag className="w-4 h-4" />
              Category:{' '}
              {CATEGORIES.find((c) => c.value === filterCategory)?.label ?? 'All'}
              <ChevronDown className="w-4 h-4 ml-1 hidden sm:block" />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 mt-1"
            >
              {CATEGORIES.map((c) => (
                <li key={c.value}>
                  <button
                    className={filterCategory === c.value ? 'active' : ''}
                    onClick={() => setFilterCategory(c.value)}
                  >
                    {CATEGORY_ICONS[c.value]}
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Status filter */}
          <div className="dropdown flex-1 sm:flex-none relative z-40">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
            >
              <CircleCheck className="w-4 h-4" />
              Status:{' '}
              {filterStatus === 'all' ? 'All' : filterStatus === 'earned' ? 'Earned' : 'Locked'}
              <ChevronDown className="w-4 h-4 ml-1 hidden sm:block" />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-48 border border-base-300 mt-1"
            >
              {[
                { value: 'all',    label: 'All',    icon: <Layers className="w-4 h-4" /> },
                { value: 'earned', label: 'Earned', icon: <Trophy className="w-4 h-4" /> },
                { value: 'locked', label: 'Locked', icon: <Lock className="w-4 h-4" /> },
              ].map((o) => (
                <li key={o.value}>
                  <button
                    className={filterStatus === o.value ? 'active' : ''}
                    onClick={() => setFilterStatus(o.value as typeof filterStatus)}
                  >
                    {o.icon}
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Sort */}
          <div className="dropdown dropdown-end flex-1 sm:flex-none relative z-40">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-outline gap-2 w-full sm:w-auto justify-start"
            >
              <ListFilter className="w-4 h-4" />
              Sort:{' '}
              {sortBy === 'order' ? 'Default' : sortBy === 'rarity' ? 'Rarity' : 'Earned first'}
              <ChevronDown className="w-4 h-4 ml-1 hidden sm:block" />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 mt-1"
            >
              {[
                { value: 'order',  label: 'Default order',  icon: <Layers className="w-4 h-4" /> },
                { value: 'rarity', label: 'By rarity',      icon: <Sparkles className="w-4 h-4" /> },
                { value: 'earned', label: 'Earned first',   icon: <Trophy className="w-4 h-4" /> },
              ].map((o) => (
                <li key={o.value}>
                  <button
                    className={sortBy === o.value ? 'active' : ''}
                    onClick={() => setSortBy(o.value as typeof sortBy)}
                  >
                    {o.icon}
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Group toggle */}
          <button
            type="button"
            className={`btn gap-2 ${grouped ? 'btn-active' : 'btn-outline'}`}
            onClick={() =>
              startGroupTransition(() => setGrouped((prev) => !prev))
            }
            title={grouped ? 'Ungroup by rarity' : 'Group by rarity'}
          >
            {isPendingGroup ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Layers className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {grouped ? 'Grouped' : 'Ungrouped'}
            </span>
          </button>
        </div>
      </div>

      {/* Achievement grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 opacity-40">
          <Lock className="text-4xl mb-3 mx-auto" />
          <p className="text-sm">No achievements match your filters.</p>
        </div>
      ) : sortBy === 'rarity' ? (
        <div className="space-y-6">
          {RARITY_ORDER.map((rarity) => {
            const group = filtered.filter((a) => a.rarity === rarity);
            if (group.length === 0) return null;
            return (
              <div key={rarity}>
                <div
                  className="flex items-center gap-2 mb-3 text-sm font-bold capitalize"
                  style={{ color: RARITY_COLOR[rarity] }}
                >
                  <Sparkles className="w-4 h-4" />
                  {rarity}
                  <span className="opacity-50 font-normal">({group.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.map((a) => (
                    <AchievementCard key={a._id} achievement={a} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={`transition-opacity duration-200 ${isPendingGroup ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {'ungrouped' in groupedAchievements ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groupedAchievements.ungrouped.map((a) => (
                <AchievementCard key={a._id} achievement={a} />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedAchievements).map(([rarity, items]) => {
                const config = RARITY_CONFIG[rarity as AchievementRarity];
                const RarityIcon = config.icon;
                const earnedCount = items.filter((a) => a.isEarned).length;
                return (
                  <div key={rarity} className="space-y-4">
                    <div className="flex items-center gap-3 pb-2 border-b border-base-300">
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          color: RARITY_COLOR[rarity as AchievementRarity],
                          background: rarityTint(rarity as AchievementRarity, '1a'),
                        }}
                      >
                        <RarityIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">{config.label}</h2>
                        <p className="text-sm text-base-content/60">
                          {earnedCount}/{items.length} earned
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((a) => (
                        <AchievementCard key={a._id} achievement={a} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* game-icons.net attribution (required by CC BY 3.0) */}
      <p className="text-xs opacity-30 text-center">
        Achievement icons by{' '}
        <a
          href="https://game-icons.net"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          game-icons.net
        </a>{' '}
        under{' '}
        <a
          href="https://creativecommons.org/licenses/by/3.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          CC BY 3.0
        </a>
        .
      </p>
    </div>
  );
}
