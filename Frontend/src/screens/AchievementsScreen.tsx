import React, { useEffect, useState, useTransition } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useUserDataStore } from '../store/userData';
import { getMyAchievementsFn, getUserAchievementsFn } from '../api/trackerApi';
import AchievementCard from '../components/achievements/AchievementCard';
import { Trans, useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import { useDateFormatting } from '../hooks/useDateFormatting';
import {
  getAchievementDescription,
  getAchievementName,
} from '../utils/achievementText';
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

const RARITY_ORDER: AchievementRarity[] = [
  'common',
  'rare',
  'epic',
  'legendary',
  'secret',
];
/**
 * Module scope, so these hold key names rather than text — a literal here
 * would be resolved once at import time and never update on a language change.
 */
const RARITY_CONFIG: Record<
  AchievementRarity,
  {
    labelKey: ParseKeys<'achievements'>;
    icon: React.FC<{ className?: string }>;
  }
> = {
  common: { labelKey: 'rarity.common', icon: Circle },
  rare: { labelKey: 'rarity.rare', icon: Star },
  epic: { labelKey: 'rarity.epic', icon: Zap },
  legendary: { labelKey: 'rarity.legendary', icon: Crown },
  secret: { labelKey: 'rarity.secret', icon: Eye },
};
const CATEGORIES: {
  value: AchievementCategory | 'all';
  labelKey: ParseKeys<'achievements'>;
}[] = [
  { value: 'all', labelKey: 'category.all' },
  { value: 'milestone', labelKey: 'category.milestone' },
  { value: 'streaks', labelKey: 'category.streaks' },
  { value: 'immersion', labelKey: 'category.immersion' },
  { value: 'social', labelKey: 'category.social' },
  { value: 'secret', labelKey: 'category.secret' },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  all: <Layers className="w-4 h-4" />,
  milestone: <Star className="w-4 h-4" />,
  streaks: <Flame className="w-4 h-4" />,
  immersion: <Zap className="w-4 h-4" />,
  social: <Users className="w-4 h-4" />,
  secret: <Eye className="w-4 h-4" />,
};

export default function AchievementsScreen() {
  const { t } = useTranslation('achievements');
  const { formatNumber } = useDateFormatting();
  const { username: routeUsername } = useParams<{ username?: string }>();
  const { user: loggedUser } = useUserDataStore();
  const username = routeUsername ?? loggedUser?.username;
  const isOwner = !routeUsername || routeUsername === loggedUser?.username;

  const [filterCategory, setFilterCategory] = useState<
    AchievementCategory | 'all'
  >('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'earned' | 'locked'>(
    'all'
  );
  const [sortBy, setSortBy] = useState<'order' | 'rarity' | 'earned'>('order');
  const [search, setSearch] = useState('');
  const [grouped, setGrouped] = useState(true);
  const [isPendingGroup, startGroupTransition] = useTransition();

  // Update document title
  useEffect(() => {
    document.title = username
      ? t('screen.documentTitleOther', { username })
      : t('screen.documentTitleOwn');
    return () => {
      document.title = 'NihongoTracker';
    };
  }, [username, t]);

  const queryFn = isOwner
    ? getMyAchievementsFn
    : () => getUserAchievementsFn(username!);
  const queryKey = isOwner
    ? ['myAchievements']
    : ['userAchievements', username];

  const {
    data: achievements,
    isLoading,
    error,
  } = useQuery({
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
      // Match the text the user can actually see, not the English original.
      return (
        getAchievementName(a).toLowerCase().includes(q) ||
        getAchievementDescription(a).toLowerCase().includes(q) ||
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
        <p>{t('screen.loadError')}</p>
      </div>
    );
  }

  return (
    // Mounted both standalone at /achievements and nested under ProfileHeader,
    // which already offsets the fixed navbar with its banner. Only the
    // standalone route needs to clear the header itself.
    <div
      className={`max-w-4xl mx-auto px-4 pb-8 space-y-8 ${
        routeUsername ? 'pt-8' : 'pt-24'
      }`}
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {routeUsername
            ? t('screen.titleOther', { username: routeUsername })
            : t('screen.titleOwn')}
        </h1>
        <p className="text-sm opacity-50 mt-1">{t('screen.subtitle')}</p>
      </div>

      {/* Stats summary bar */}
      {achievements && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-4 border border-base-300 bg-base-200/50">
            <p className="text-2xl font-extrabold">{earned.length}</p>
            <p className="text-xs opacity-50 mt-0.5">
              {t('screen.stats.earned')}
            </p>
          </div>
          <div className="rounded-xl p-4 border border-base-300 bg-base-200/50">
            <p className="text-2xl font-extrabold">{visible.length}</p>
            <p className="text-xs opacity-50 mt-0.5">
              {t('screen.stats.total')}
            </p>
          </div>
          <div className="rounded-xl p-4 border border-base-300 bg-base-200/50">
            <p className="text-2xl font-extrabold">
              {formatNumber(totalPoints)}
            </p>
            <p className="text-xs opacity-50 mt-0.5">
              {t('screen.stats.points')}
            </p>
          </div>
          <div className="rounded-xl p-4 border border-base-300 bg-base-200/50">
            <p className="text-2xl font-extrabold">
              {visible.length > 0
                ? Math.round((earned.length / visible.length) * 100)
                : 0}
              %
            </p>
            <p className="text-xs opacity-50 mt-0.5">
              {t('screen.stats.completion')}
            </p>
          </div>
        </div>
      )}

      {/* Rarity breakdown */}
      {achievements && (
        <div className="flex gap-3 flex-wrap">
          {rarityBreakdown.map(
            ({ rarity, earned: earnedCount, total: totalCount }) =>
              totalCount > 0 && (
                <div
                  key={rarity}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold border"
                  style={{
                    borderColor: rarityTint(rarity, '40'),
                    color: RARITY_COLOR[rarity],
                    background: rarityTint(rarity, '10'),
                  }}
                >
                  <span>{t(RARITY_CONFIG[rarity].labelKey)}</span>
                  <span className="opacity-60">
                    {earnedCount}/{totalCount}
                  </span>
                </div>
              )
          )}
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
            placeholder={t('screen.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => setSearch('')}
              aria-label={t('screen.clearSearch')}
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
              {t('screen.categoryLabel', {
                value: t(
                  CATEGORIES.find((c) => c.value === filterCategory)
                    ?.labelKey ?? 'category.all'
                ),
              })}
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
                    {t(c.labelKey)}
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
              {t('screen.statusLabel', {
                value: t(`screen.status.${filterStatus}`),
              })}
              <ChevronDown className="w-4 h-4 ml-1 hidden sm:block" />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-48 border border-base-300 mt-1"
            >
              {[
                {
                  value: 'all',
                  label: t('screen.status.all'),
                  icon: <Layers className="w-4 h-4" />,
                },
                {
                  value: 'earned',
                  label: t('screen.status.earned'),
                  icon: <Trophy className="w-4 h-4" />,
                },
                {
                  value: 'locked',
                  label: t('screen.status.locked'),
                  icon: <Lock className="w-4 h-4" />,
                },
              ].map((o) => (
                <li key={o.value}>
                  <button
                    className={filterStatus === o.value ? 'active' : ''}
                    onClick={() =>
                      setFilterStatus(o.value as typeof filterStatus)
                    }
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
              {t('screen.sortLabel', { value: t(`screen.sort.${sortBy}`) })}
              <ChevronDown className="w-4 h-4 ml-1 hidden sm:block" />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content z-50 menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 mt-1"
            >
              {[
                {
                  value: 'order',
                  label: t('screen.sort.orderLong'),
                  icon: <Layers className="w-4 h-4" />,
                },
                {
                  value: 'rarity',
                  label: t('screen.sort.rarityLong'),
                  icon: <Sparkles className="w-4 h-4" />,
                },
                {
                  value: 'earned',
                  label: t('screen.sort.earnedLong'),
                  icon: <Trophy className="w-4 h-4" />,
                },
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
            title={grouped ? t('screen.ungroupTitle') : t('screen.groupTitle')}
          >
            {isPendingGroup ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Layers className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {grouped ? t('screen.grouped') : t('screen.ungrouped')}
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
          <p className="text-sm">{t('screen.noMatches')}</p>
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
                  {t(RARITY_CONFIG[rarity].labelKey)}
                  <span className="opacity-50 font-normal">
                    ({group.length})
                  </span>
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
                          background: rarityTint(
                            rarity as AchievementRarity,
                            '1a'
                          ),
                        }}
                      >
                        <RarityIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">
                          {t(config.labelKey)}
                        </h2>
                        <p className="text-sm text-base-content/60">
                          {t('screen.earnedOfTotal', {
                            earned: earnedCount,
                            total: items.length,
                          })}
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
        <Trans
          t={t}
          i18nKey="screen.attribution"
          components={{
            icons: (
              <a
                href="https://game-icons.net"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              />
            ),
            license: (
              <a
                href="https://creativecommons.org/licenses/by/3.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              />
            ),
          }}
        />
      </p>
    </div>
  );
}
