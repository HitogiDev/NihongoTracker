import { useQuery } from '@tanstack/react-query';
import { getUserAchievementActivityFn } from '../../api/trackerApi';
import { Icon } from '@iconify/react';
import { RARITY_COLOR, rarityTint } from './rarity';

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
        const color = RARITY_COLOR[rarity] ?? RARITY_COLOR.common;

        return (
          <div
            key={String(item.userAchievementId)}
            className="flex items-center gap-3 rounded-xl px-3 py-2 bg-base-200/60 border border-base-300 hover:border-primary/40 transition"
          >
            {/* Icon */}
            <div className="shrink-0">
              {a.iconSlug ? (
                <Icon
                  icon={`game-icons:${a.iconSlug}`}
                  width={24}
                  height={24}
                  color={color}
                />
              ) : (
                <span className="text-lg">🏆</span>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">
                {a.name ?? 'Achievement'}
              </p>
              {item.unlockedAt && (
                <p className="text-xs text-base-content/50 mt-0.5">
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
              className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-full border capitalize"
              style={{
                borderColor: rarityTint(rarity, '40'),
                background: rarityTint(rarity, '10'),
                color,
              }}
            >
              {rarity}
            </span>
          </div>
        );
      })}
    </div>
  );
}
