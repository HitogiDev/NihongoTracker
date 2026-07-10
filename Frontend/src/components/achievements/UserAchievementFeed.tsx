import { useQuery } from '@tanstack/react-query';
import { getUserAchievementActivityFn } from '../../api/trackerApi';
import { Icon } from '@iconify/react';

const RARITY_COLORS: Record<string, string> = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#a855f7',
  legendary: '#fbbf24',
  secret:    '#7c3aed',
};

const BADGE_BG: Record<string, string> = {
  common:    '#374151',
  rare:      '#1e3a5f',
  epic:      '#3b0764',
  legendary: '#451a03',
  secret:    '#1e0a3a',
};

const CARD_BG: Record<string, string> = {
  common:    'linear-gradient(135deg, oklch(25% 0.01 250), oklch(30% 0.015 250))',
  rare:      'linear-gradient(135deg, oklch(20% 0.04 250), oklch(25% 0.06 240))',
  epic:      'linear-gradient(135deg, oklch(18% 0.06 290), oklch(22% 0.08 280))',
  legendary: 'linear-gradient(135deg, oklch(20% 0.05 60),  oklch(25% 0.07 50))',
  secret:    'linear-gradient(135deg, oklch(15% 0.08 295), oklch(20% 0.1 285))',
};

const CARD_BORDER: Record<string, string> = {
  common:    'rgba(156, 163, 175, 0.3)',
  rare:      'rgba(59, 130, 246, 0.45)',
  epic:      'rgba(168, 85, 247, 0.5)',
  legendary: 'rgba(251, 191, 36, 0.55)',
  secret:    'rgba(109, 40, 217, 0.6)',
};

interface UserAchievementFeedProps {
  username: string;
}

export default function UserAchievementFeed({ username }: UserAchievementFeedProps) {
  const { data: activity, isLoading } = useQuery({
    queryKey: ['userAchievementActivity', username],
    queryFn: () => getUserAchievementActivityFn(username, 10),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-12 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!activity || activity.length === 0) return null;

  return (
    <div className="space-y-2">
      {activity.map((item) => {
        const a = item.achievement;
        const rarity = a.rarity ?? 'common';
        const color = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;

        return (
          <div
            key={String(item.userAchievementId)}
            className="flex items-center gap-3 rounded-xl px-3 py-2 border transition-all hover:brightness-110"
            style={{
              background: CARD_BG[rarity] ?? CARD_BG.common,
              borderColor: CARD_BORDER[rarity] ?? CARD_BORDER.common,
            }}
          >
            {/* Icon */}
            <div className="shrink-0">
              {a.iconSlug ? (
                <Icon
                  icon={`game-icons:${a.iconSlug}`}
                  width={24}
                  height={24}
                  color={color}
                  style={{
                    opacity: 0.9,
                    filter: `drop-shadow(0 0 4px ${color}66)`,
                  }}
                />
              ) : (
                <span className="text-lg">🏆</span>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-semibold truncate"
                style={{ color: color }}
              >
                {a.name ?? 'Achievement'}
              </p>
              {item.unlockedAt && (
                <p className="text-xs opacity-40 mt-0.5" style={{ color: color }}>
                  {new Date(item.unlockedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>

            {/* Rarity badge */}
            <span
              className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-md capitalize"
              style={{ background: BADGE_BG[rarity] ?? BADGE_BG.common, color }}
            >
              {rarity}
            </span>
          </div>
        );
      })}
    </div>
  );
}
