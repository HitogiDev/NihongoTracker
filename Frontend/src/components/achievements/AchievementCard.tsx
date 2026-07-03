import { Icon } from '@iconify/react';
import { useRef, useCallback } from 'react';
import { IAchievement, AchievementRarity } from '../../types';

const RARITY_COLOR: Record<AchievementRarity, string> = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#a855f7',
  legendary: '#fbbf24',
  secret:    '#7c3aed',
};

interface AchievementIconProps {
  iconSlug?: string;
  rarity: AchievementRarity;
  isEarned?: boolean;
  size?: number;
}

function AchievementIcon({ iconSlug, rarity, isEarned = false, size = 56 }: AchievementIconProps) {
  const color = isEarned ? RARITY_COLOR[rarity] : '#4b5563';

  if (!iconSlug) {
    return (
      <div
        style={{ width: size, height: size, color, opacity: isEarned ? 1 : 0.4 }}
        className="flex items-center justify-center text-3xl font-black"
      >
        ?
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        filter: isEarned ? `drop-shadow(0 0 8px ${color}88)` : undefined,
        opacity: isEarned ? 1 : 0.3,
        transition: 'filter 0.3s ease, opacity 0.3s ease',
      }}
    >
      <Icon
        icon={`game-icons:${iconSlug}`}
        width={size}
        height={size}
        color={color}
        style={{ display: 'block' }}
      />
    </div>
  );
}

// ─── Holographic tilt hook ────────────────────────────────────────────────────

function useHolo(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enabled || !ref.current) return;
      cancelAnimationFrame(rafRef.current);
      const rect = ref.current.getBoundingClientRect();
      rafRef.current = requestAnimationFrame(() => {
        if (!ref.current) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const mx = Math.round((x / rect.width) * 100);
        const my = Math.round((y / rect.height) * 100);
        const rx = `${((my - 50) / 5).toFixed(2)}deg`;
        const ry = `${((50 - mx) / 5).toFixed(2)}deg`;
        const hyp = (Math.sqrt((mx - 50) ** 2 + (my - 50) ** 2) / 50).toFixed(3);
        const el = ref.current;
        el.style.setProperty('--rx', rx);
        el.style.setProperty('--ry', ry);
        el.style.setProperty('--mx', `${mx}%`);
        el.style.setProperty('--my', `${my}%`);
        el.style.setProperty('--hyp', hyp);
      });
    },
    [enabled]
  );

  const onMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (!ref.current) return;
    const el = ref.current;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
    el.style.setProperty('--hyp', '0');
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}

function getHoloFoilClass(rarity: AchievementRarity): string {
  switch (rarity) {
    case 'legendary': return 'achievement-holo-foil-rainbow achievement-holo-foil-legendary';
    case 'epic':      return 'achievement-holo-foil-rainbow';
    case 'rare':      return 'achievement-holo-foil-rainbow';
    case 'secret':    return 'achievement-holo-foil-secret';
    default:          return '';
  }
}



interface RarityConfig {
  label: string;
  cardBg: string;
  borderColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
  animationClass: string;
  overlayClass: string;
}

export function getRarityConfig(rarity: AchievementRarity, isEarned: boolean): RarityConfig {
  const configs: Record<AchievementRarity, RarityConfig> = {
    common: {
      label: 'Common',
      cardBg: isEarned
        ? 'linear-gradient(135deg, oklch(25% 0.01 250) 0%, oklch(30% 0.015 250) 100%)'
        : 'linear-gradient(135deg, oklch(18% 0.005 250) 0%, oklch(22% 0.008 250) 100%)',
      borderColor: isEarned ? 'rgba(156, 163, 175, 0.35)' : 'rgba(75, 85, 99, 0.3)',
      textColor: isEarned ? '#e5e7eb' : '#6b7280',
      badgeBg: '#374151',
      badgeText: '#9ca3af',
      animationClass: '',
      overlayClass: '',
    },
    rare: {
      label: 'Rare',
      cardBg: isEarned
        ? 'linear-gradient(135deg, oklch(20% 0.04 250) 0%, oklch(25% 0.06 240) 100%)'
        : 'linear-gradient(135deg, oklch(15% 0.02 250) 0%, oklch(18% 0.03 250) 100%)',
      borderColor: isEarned ? 'rgba(59, 130, 246, 0.45)' : 'rgba(37, 99, 235, 0.2)',
      textColor: isEarned ? '#bfdbfe' : '#6b7280',
      badgeBg: '#1e3a5f',
      badgeText: '#93c5fd',
      animationClass: isEarned ? 'achievement-shimmer-rare' : '',
      overlayClass: isEarned ? 'achievement-earned-glow-rare' : '',
    },
    epic: {
      label: 'Epic',
      cardBg: isEarned
        ? 'linear-gradient(135deg, oklch(18% 0.06 290) 0%, oklch(22% 0.08 280) 100%)'
        : 'linear-gradient(135deg, oklch(13% 0.03 290) 0%, oklch(16% 0.04 285) 100%)',
      borderColor: isEarned ? 'rgba(168, 85, 247, 0.5)' : 'rgba(109, 40, 217, 0.2)',
      textColor: isEarned ? '#e9d5ff' : '#6b7280',
      badgeBg: '#3b0764',
      badgeText: '#c084fc',
      animationClass: isEarned ? 'achievement-glow-epic' : '',
      overlayClass: isEarned ? 'achievement-earned-glow-epic' : '',
    },
    legendary: {
      label: 'Legendary',
      cardBg: isEarned
        ? 'linear-gradient(135deg, oklch(20% 0.05 60) 0%, oklch(25% 0.07 50) 100%)'
        : 'linear-gradient(135deg, oklch(14% 0.025 60) 0%, oklch(18% 0.035 55) 100%)',
      borderColor: isEarned ? 'rgba(251, 191, 36, 0.55)' : 'rgba(180, 130, 20, 0.2)',
      textColor: isEarned ? '#fef3c7' : '#6b7280',
      badgeBg: '#451a03',
      badgeText: '#fbbf24',
      animationClass: isEarned ? 'achievement-glow-legendary achievement-shimmer-legendary achievement-particles-legendary' : '',
      overlayClass: isEarned ? 'achievement-earned-glow-legendary' : '',
    },
    secret: {
      label: 'Secret',
      cardBg: isEarned
        ? 'linear-gradient(135deg, oklch(15% 0.08 295) 0%, oklch(20% 0.1 285) 100%)'
        : 'linear-gradient(135deg, oklch(10% 0.04 295) 0%, oklch(13% 0.06 290) 100%)',
      borderColor: isEarned ? 'rgba(109, 40, 217, 0.6)' : 'rgba(76, 29, 149, 0.3)',
      textColor: isEarned ? '#ede9fe' : '#6b7280',
      badgeBg: '#1e0a3a',
      badgeText: '#a78bfa',
      animationClass: isEarned ? 'achievement-glow-secret' : '',
      overlayClass: isEarned ? 'achievement-earned-glow-secret' : '',
    },
  };

  return configs[rarity] ?? configs.common;
}

// ─── AchievementCard ─────────────────────────────────────────────────────────

interface AchievementCardProps {
  achievement: IAchievement;
  onClick?: () => void;
  compact?: boolean;
}

export default function AchievementCard({
  achievement,
  onClick,
  compact = false,
}: AchievementCardProps) {
  const isEarned = achievement.isEarned ?? false;
  const rarity = achievement.rarity;
  const cfg = getRarityConfig(rarity, isEarned);
  const holoEnabled = isEarned;
  const { ref: holoRef, onMouseMove, onMouseLeave } = useHolo(holoEnabled);
  const foilClass = isEarned ? getHoloFoilClass(rarity) : '';

  // Pure hidden stub — only shows ? and count
  if (achievement.isHidden && !isEarned) {
    return (
      <div
        onClick={onClick}
        className={`relative overflow-hidden rounded-xl border cursor-default transition-all duration-300 ${
          onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
        }`}
        style={{
          background: 'linear-gradient(135deg, oklch(10% 0.04 295) 0%, oklch(13% 0.06 290) 100%)',
          borderColor: 'rgba(76, 29, 149, 0.3)',
          padding: compact ? '12px' : '20px',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-lg text-2xl font-black text-purple-800"
            style={{ width: compact ? 40 : 56, height: compact ? 40 : 56, background: 'rgba(76, 29, 149, 0.15)' }}
          >
            ?
          </div>
          <div>
            <p className="font-semibold text-purple-900/60 text-sm">Hidden Achievement</p>
            <p className="text-xs text-purple-900/40 mt-0.5">Unlock to reveal</p>
          </div>
        </div>
      </div>
    );
  }

  const isSecret = achievement.isSecret && !isEarned;

  return (
    <div
      ref={holoRef}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${cfg.animationClass} ${cfg.overlayClass} ${
        isEarned ? 'achievement-holo-card' : ''
      } ${
        onClick ? 'cursor-pointer hover:scale-[1.02] hover:brightness-110' : ''
      } ${!isEarned && !isSecret ? 'opacity-60' : ''}`}
      style={{
        background: cfg.cardBg,
        borderColor: cfg.borderColor,
        padding: compact ? '12px' : '20px',
      }}
      title={achievement.name}
    >
      {/* Glare layer — all earned */}
      {isEarned && <div className="achievement-holo-glare" />}

      {/* Foil layer — rare / epic / legendary / secret */}
      {isEarned && foilClass && <div className={foilClass} />}

      <div className="relative z-10 flex items-start gap-3">
        {/* Icon */}
        <div className="shrink-0">
          <AchievementIcon
            iconSlug={isSecret ? undefined : achievement.iconSlug}
            rarity={rarity}
            isEarned={isEarned}
            size={compact ? 40 : 56}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className={`font-bold truncate ${compact ? 'text-sm' : 'text-base'}`}
              style={{ color: cfg.textColor }}
            >
              {isSecret ? '???' : (achievement.name ?? 'Secret Achievement')}
            </h3>

            {/* Rarity badge */}
            <span
              className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-md capitalize"
              style={{ background: cfg.badgeBg, color: cfg.badgeText }}
            >
              {cfg.label}
            </span>

            {/* Earned checkmark */}
            {isEarned && (
              <span className="shrink-0 text-xs">✓</span>
            )}
          </div>

          {/* Description / hint */}
          {!compact && (
            <p
              className="text-xs mt-1 line-clamp-2 opacity-75"
              style={{ color: cfg.textColor }}
            >
              {isSecret
                ? (achievement.hint || 'Complete a secret condition to reveal this achievement.')
                : (achievement.description ?? '')}
            </p>
          )}

          {/* Progress bar for countable achievements */}
          {!isEarned && !isSecret && achievement.condition?.threshold && (achievement.progress ?? 0) > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1" style={{ color: cfg.textColor, opacity: 0.7 }}>
                <span>{achievement.progress?.toLocaleString()}</span>
                <span>{achievement.condition.threshold.toLocaleString()}</span>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, ((achievement.progress ?? 0) / achievement.condition.threshold) * 100)}%`,
                    background: cfg.borderColor,
                  }}
                />
              </div>
            </div>
          )}

          {/* Rarity % + unlock date */}
          {!compact && (
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {achievement.rarityPercent !== undefined && (
                <span className="text-xs opacity-50" style={{ color: cfg.textColor }}>
                  {achievement.rarityPercent}% of users
                </span>
              )}
              {isEarned && achievement.unlockedAt && (
                <span className="text-xs opacity-50" style={{ color: cfg.textColor }}>
                  {new Date(achievement.unlockedAt).toLocaleDateString()}
                </span>
              )}
              {achievement.points > 0 && (
                <span className="text-xs font-semibold opacity-60" style={{ color: cfg.badgeText }}>
                  {achievement.points} pts
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
