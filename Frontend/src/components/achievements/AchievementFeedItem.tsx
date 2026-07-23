import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import type { IPendingAchievement } from '../../types';
import { RARITY_COLOR, rarityTint } from './rarity';
import { AchievementDetailModal } from './AchievementCard';

interface AchievementFeedItemProps {
  item: IPendingAchievement;
  /** Whether to show the user's avatar/username (global feed). Default false (profile feed). */
  showUser?: boolean;
  /** Optional formatted relative date string. */
  relativeDate?: string;
}

export default function AchievementFeedItem({
  item,
  showUser = false,
  relativeDate,
}: AchievementFeedItemProps) {
  const [showDetail, setShowDetail] = useState(false);
  const a = item.achievement;
  const rarity = a.rarity ?? 'common';
  const color = RARITY_COLOR[rarity] ?? RARITY_COLOR.common;
  const user = item.user as { username: string; avatar?: string } | undefined;

  const dateLabel = relativeDate
    ? relativeDate
    : item.unlockedAt
    ? new Date(item.unlockedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setShowDetail(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setShowDetail(true);
        }
      }}
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-base-200/60 border border-base-300 cursor-pointer hover:border-primary/40 hover:bg-base-200 transition"
    >
      {/* User avatar (global feed) */}
      {showUser && user?.username && (
        <Link
          to={`/user/${user.username}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center text-sm font-bold overflow-hidden border border-base-300">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{user.username[0]?.toUpperCase()}</span>
            )}
          </div>
        </Link>
      )}

      {/* Achievement icon */}
      <div className="shrink-0">
        {a.iconSlug ? (
          <Icon
            icon={`game-icons:${a.iconSlug}`}
            width={26}
            height={26}
            color={color}
          />
        ) : (
          <span className="text-xl">🏆</span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {showUser && user?.username ? (
            <Link
              to={`/user/${user.username}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold hover:underline"
            >
              {user.username}
            </Link>
          ) : null}
          <span className="text-base-content/60 text-xs">
            {showUser ? 'earned' : 'Logro desbloqueado:'}
          </span>
          <span className="font-medium text-sm">
            {a.name ?? 'Secret Achievement'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs px-1.5 py-0.5 rounded-full border font-semibold capitalize"
            style={{
              borderColor: rarityTint(rarity, '40'),
              background: rarityTint(rarity, '10'),
              color,
            }}
          >
            {rarity}
          </span>
          <span className="text-xs text-base-content/50">{dateLabel}</span>
        </div>
      </div>

      {showDetail && (
        <AchievementDetailModal
          achievement={{
            ...a,
            isEarned: true,
            unlockedAt: a.unlockedAt ?? item.unlockedAt,
            rarityPercent: a.rarityPercent ?? item.rarityPercent,
          }}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}
