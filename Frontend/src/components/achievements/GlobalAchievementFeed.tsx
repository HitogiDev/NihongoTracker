import { useQuery } from '@tanstack/react-query';
import { getAchievementFeedFn } from '../../api/trackerApi';
import { BADGE_BG, BADGE_TEXT } from './AchievementCard';
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
        const rarityColors: Record<string, string> = {
          common: '#9ca3af',
          rare: '#60a5fa',
          epic: '#a855f7',
          legendary: '#fbbf24',
          secret: '#7c3aed',
        };
        const rarityColor = rarityColors[a.rarity] ?? '#9ca3af';
        const user = (item as any).user;
        const cardBg: Record<string, string> = {
          common:    'linear-gradient(135deg, oklch(25% 0.01 250), oklch(30% 0.015 250))',
          rare:      'linear-gradient(135deg, oklch(20% 0.04 250), oklch(25% 0.06 240))',
          epic:      'linear-gradient(135deg, oklch(18% 0.06 290), oklch(22% 0.08 280))',
          legendary: 'linear-gradient(135deg, oklch(20% 0.05 60),  oklch(25% 0.07 50))',
          secret:    'linear-gradient(135deg, oklch(15% 0.08 295), oklch(20% 0.1 285))',
        };
        const cardBorderColor: Record<string, string> = {
          common:    'rgba(156, 163, 175, 0.35)',
          rare:      'rgba(59, 130, 246, 0.45)',
          epic:      'rgba(168, 85, 247, 0.5)',
          legendary: 'rgba(251, 191, 36, 0.55)',
          secret:    'rgba(109, 40, 217, 0.6)',
        };
        const textColor: Record<string, string> = {
          common: '#e5e7eb', rare: '#bfdbfe', epic: '#e9d5ff',
          legendary: '#fef3c7', secret: '#ede9fe',
        };

        return (
          <div
            key={item.userAchievementId}
            className="flex items-center gap-3 rounded-xl px-3 py-2 border transition-all hover:brightness-110"
            style={{
              background: cardBg[a.rarity] ?? cardBg.common,
              borderColor: cardBorderColor[a.rarity] ?? cardBorderColor.common,
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
                  style={{
                    opacity: 0.9,
                    filter: `drop-shadow(0 0 4px ${rarityColor}66)`,
                  }}
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
                <span className="opacity-60" style={{ color: textColor[a.rarity] ?? textColor.common }}>
                  earned
                </span>
                <span className="font-semibold" style={{ color: textColor[a.rarity] ?? textColor.common }}>
                  {a.name ?? 'Secret Achievement'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-semibold capitalize"
                  style={{ background: BADGE_BG[a.rarity as keyof typeof BADGE_BG] ?? BADGE_BG.common, color: BADGE_TEXT[a.rarity as keyof typeof BADGE_TEXT] ?? BADGE_TEXT.common }}
                >
                  {a.rarity}
                </span>
                <span className="text-xs opacity-40" style={{ color: textColor[a.rarity] ?? textColor.common }}>
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
