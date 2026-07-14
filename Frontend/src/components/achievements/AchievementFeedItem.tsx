import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import type { IPendingAchievement } from '../../types';

export const RARITY_COLOR: Record<string, string> = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#a855f7',
  legendary: '#fbbf24',
  secret:    '#7c3aed',
};

export const CARD_BG: Record<string, string> = {
  common:    'linear-gradient(135deg, oklch(25% 0.01 250), oklch(30% 0.015 250))',
  rare:      'linear-gradient(135deg, oklch(20% 0.04 250), oklch(25% 0.06 240))',
  epic:      'linear-gradient(135deg, oklch(18% 0.06 290), oklch(22% 0.08 280))',
  legendary: 'linear-gradient(135deg, oklch(20% 0.05 60),  oklch(25% 0.07 50))',
  secret:    'linear-gradient(135deg, oklch(15% 0.08 295), oklch(20% 0.1 285))',
};

export const CARD_BORDER: Record<string, string> = {
  common:    'rgba(156, 163, 175, 0.35)',
  rare:      'rgba(59, 130, 246, 0.45)',
  epic:      'rgba(168, 85, 247, 0.5)',
  legendary: 'rgba(251, 191, 36, 0.55)',
  secret:    'rgba(109, 40, 217, 0.6)',
};

export const BADGE_BG: Record<string, string> = {
  common:    '#374151',
  rare:      '#1e3a5f',
  epic:      '#3b0764',
  legendary: '#451a03',
  secret:    '#1e0a3a',
};

export const TEXT_COLOR: Record<string, string> = {
  common:    '#e5e7eb',
  rare:      '#bfdbfe',
  epic:      '#e9d5ff',
  legendary: '#fef3c7',
  secret:    '#ede9fe',
};

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
  const a = item.achievement;
  const rarity = a.rarity ?? 'common';
  const color = RARITY_COLOR[rarity] ?? RARITY_COLOR.common;
  const textColor = TEXT_COLOR[rarity] ?? TEXT_COLOR.common;
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
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 border transition-all hover:brightness-110"
      style={{
        background:  CARD_BG[rarity]     ?? CARD_BG.common,
        borderColor: CARD_BORDER[rarity] ?? CARD_BORDER.common,
      }}
    >
      {/* User avatar (global feed) */}
      {showUser && user?.username && (
        <Link to={`/user/${user.username}`} className="shrink-0">
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
            style={{ opacity: 0.9, filter: `drop-shadow(0 0 4px ${color}66)` }}
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
              className="font-semibold hover:underline"
              style={{ color }}
            >
              {user.username}
            </Link>
          ) : null}
          <span className="text-base-content/60 text-xs">
            {showUser ? 'earned' : 'Logro desbloqueado:'}
          </span>
          <span className="font-medium text-sm" style={{ color: textColor }}>
            {a.name ?? 'Secret Achievement'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs px-1.5 py-0.5 rounded font-semibold capitalize"
            style={{ background: BADGE_BG[rarity] ?? BADGE_BG.common, color }}
          >
            {rarity}
          </span>
          <span className="text-xs opacity-50" style={{ color: textColor }}>
            {dateLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
