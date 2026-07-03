import { useQuery } from '@tanstack/react-query';
import { getAchievementFeedFn } from '../../api/trackerApi';
import { getRarityConfig } from './AchievementCard';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

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
        const cfg = getRarityConfig(a.rarity, true);
        const user = (item as any).user;

        const rarityColors: Record<string, string> = {
          common: '#9ca3af',
          rare: '#60a5fa',
          epic: '#a855f7',
          legendary: '#fbbf24',
          secret: '#7c3aed',
        };
        const rarityColor = rarityColors[a.rarity] ?? '#9ca3af';

        return (
          <div
            key={item.userAchievementId}
            className="flex items-center gap-3 rounded-xl px-3 py-2 border transition-all hover:brightness-110"
            style={{
              background: cfg.cardBg,
              borderColor: cfg.borderColor,
            }}
          >
            {/* Icon */}
            <div className="shrink-0">
              {a.iconSlug ? (
                <Icon
                  icon={`game-icons:${a.iconSlug}`}
                  width={28}
                  height={28}
                  color={rarityColor}
                  style={{ opacity: 0.9 }}
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
                    style={{ color: rarityColor }}
                  >
                    {user.username}
                  </Link>
                )}
                <span className="opacity-60" style={{ color: cfg.textColor }}>
                  earned
                </span>
                <span className="font-semibold" style={{ color: cfg.textColor }}>
                  {a.name ?? 'Secret Achievement'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-semibold capitalize"
                  style={{ background: cfg.badgeBg, color: cfg.badgeText }}
                >
                  {a.rarity}
                </span>
                <span className="text-xs opacity-40" style={{ color: cfg.textColor }}>
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
