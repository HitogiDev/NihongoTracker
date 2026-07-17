import { useQuery } from '@tanstack/react-query';
import { getAchievementFeedFn } from '../../api/trackerApi';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { RARITY_COLOR, rarityTint } from './rarity';

export default function GlobalAchievementFeed() {
  const { data: feed, isLoading } = useQuery({
    queryKey: ['achievementFeed'],
    queryFn: () => getAchievementFeedFn(20),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-12 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!feed || feed.length === 0) return null;

  return (
    <div className="space-y-2">
      {feed.map((item) => {
        const a = item.achievement;
        const rarity = a.rarity ?? 'common';
        const rarityColor = RARITY_COLOR[rarity] ?? RARITY_COLOR.common;
        const user = (item as any).user;

        return (
          <div
            key={item.userAchievementId}
            className="flex items-center gap-3 rounded-xl px-3 py-2 bg-base-200/60 border border-base-300 hover:border-primary/40 transition"
          >
            {/* Icon */}
            <div className="shrink-0">
              {a.iconSlug ? (
                <Icon
                  icon={`game-icons:${a.iconSlug}`}
                  width={28}
                  height={28}
                  color={rarityColor}
                />
              ) : (
                <span className="text-xl">🏆</span>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap text-xs">
                {user?.username && (
                  <Link
                    to={`/user/${user.username}`}
                    className="font-bold hover:underline"
                  >
                    {user.username}
                  </Link>
                )}
                <span className="text-base-content/60">earned</span>
                <span className="font-semibold">
                  {a.name ?? 'Secret Achievement'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full border font-semibold capitalize"
                  style={{
                    borderColor: rarityTint(rarity, '40'),
                    background: rarityTint(rarity, '10'),
                    color: rarityColor,
                  }}
                >
                  {rarity}
                </span>
                <span className="text-xs text-base-content/50">
                  {item.unlockedAt
                    ? new Date(item.unlockedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : ''}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
