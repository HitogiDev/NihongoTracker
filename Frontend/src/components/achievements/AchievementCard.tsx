import { Icon } from '@iconify/react';
import { useRef, useCallback, useEffect, useState } from 'react';
import { IAchievement, AchievementRarity } from '../../types';
import { createPortal } from 'react-dom';

/* ─── Colour palette ────────────────────────────────────────────────────── */

const RARITY_TEXT: Record<AchievementRarity, string> = {
  common:    '#e5e7eb',
  rare:      '#bfdbfe',
  epic:      '#e9d5ff',
  legendary: '#fef3c7',
  secret:    '#ede9fe',
};

const RARITY_DIM: Record<AchievementRarity, string> = {
  common:    '#6b7280',
  rare:      '#6b7280',
  epic:      '#6b7280',
  legendary: '#6b7280',
  secret:    '#6b7280',
};

const BADGE_BG: Record<AchievementRarity, string> = {
  common:    '#374151',
  rare:      '#1e3a5f',
  epic:      '#3b0764',
  legendary: '#451a03',
  secret:    '#1e0a3a',
};

const BADGE_TEXT: Record<AchievementRarity, string> = {
  common:    '#9ca3af',
  rare:      '#93c5fd',
  epic:      '#c084fc',
  legendary: '#fbbf24',
  secret:    '#a78bfa',
};

const RARITY_GLOW: Record<AchievementRarity, string> = {
  common:    'rgba(156, 163, 175, 0.15)',
  rare:      'rgba(59, 130, 246, 0.25)',
  epic:      'rgba(168, 85, 247, 0.3)',
  legendary: 'rgba(251, 191, 36, 0.35)',
  secret:    'rgba(109, 40, 217, 0.4)',
};

/** Card background gradient for each rarity + earned state */
function cardBg(rarity: AchievementRarity, earned: boolean): string {
  if (!earned) {
    return {
      common:    'linear-gradient(135deg, oklch(18% 0.005 250), oklch(22% 0.008 250))',
      rare:      'linear-gradient(135deg, oklch(15% 0.02 250), oklch(18% 0.03 250))',
      epic:      'linear-gradient(135deg, oklch(13% 0.03 290), oklch(16% 0.04 285))',
      legendary: 'linear-gradient(135deg, oklch(14% 0.025 60), oklch(18% 0.035 55))',
      secret:    'linear-gradient(135deg, oklch(10% 0.04 295), oklch(13% 0.06 290))',
    }[rarity];
  }
  return {
    common:    'linear-gradient(135deg, oklch(25% 0.01 250), oklch(30% 0.015 250))',
    rare:      'linear-gradient(135deg, oklch(20% 0.04 250), oklch(25% 0.06 240))',
    epic:      'linear-gradient(135deg, oklch(18% 0.06 290), oklch(22% 0.08 280))',
    legendary: 'linear-gradient(135deg, oklch(20% 0.05 60),  oklch(25% 0.07 50))',
    secret:    'linear-gradient(135deg, oklch(15% 0.08 295), oklch(20% 0.1 285))',
  }[rarity];
}

function borderColor(rarity: AchievementRarity, earned: boolean): string {
  if (!earned) {
    return {
      common:    'rgba(75, 85, 99, 0.3)',
      rare:      'rgba(37, 99, 235, 0.2)',
      epic:      'rgba(109, 40, 217, 0.2)',
      legendary: 'rgba(180, 130, 20, 0.2)',
      secret:    'rgba(76, 29, 149, 0.3)',
    }[rarity];
  }
  return {
    common:    'rgba(156, 163, 175, 0.35)',
    rare:      'rgba(59, 130, 246, 0.45)',
    epic:      'rgba(168, 85, 247, 0.5)',
    legendary: 'rgba(251, 191, 36, 0.55)',
    secret:    'rgba(109, 40, 217, 0.6)',
  }[rarity];
}

/** Maps rarity → the CSS class that drives the holo foil effect */
function holoClass(rarity: AchievementRarity): string {
  switch (rarity) {
    case 'rare':      return 'ac-holo-rare';
    case 'epic':      return 'ac-holo-epic';
    case 'legendary': return 'ac-holo-legendary';
    case 'secret':    return 'ac-holo-secret';
    default:          return '';
  }
}

/* ─── Icon sub-component ────────────────────────────────────────────────── */

interface AchievementIconProps {
  iconSlug?: string;
  rarity: AchievementRarity;
  isEarned?: boolean;
  size?: number;
}

function AchievementIcon({ iconSlug, rarity, isEarned = false, size = 56 }: AchievementIconProps) {
  const color = isEarned ? BADGE_TEXT[rarity] : '#4b5563';

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

/* ─── Pokemon-card pointermove hook ─────────────────────────────────────── */

function usePokemonCard(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const clamp = (v: number, lo = 0, hi = 100) => Math.min(Math.max(v, lo), hi);
  const round = (v: number, p = 3) => parseFloat(v.toFixed(p));
  const adjust = (v: number, flo: number, fhi: number, tlo: number, thi: number) =>
    round(tlo + (thi - tlo) * (v - flo) / (fhi - flo));

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || !ref.current) return;
      cancelAnimationFrame(rafRef.current);

      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x   = clamp(round((100 / rect.width)  * (e.clientX - rect.left)));
      const y   = clamp(round((100 / rect.height) * (e.clientY - rect.top)));
      const cx  = x - 50;
      const cy  = y - 50;
      const fc  = clamp(Math.sqrt(cx * cx + cy * cy) / 50, 0, 1);

      rafRef.current = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty('--pointer-x',   `${x}%`);
        el.style.setProperty('--pointer-y',   `${y}%`);
        el.style.setProperty('--background-x', `${adjust(x, 0, 100, 37, 63)}%`);
        el.style.setProperty('--background-y', `${adjust(y, 0, 100, 33, 67)}%`);
        el.style.setProperty('--pointer-from-center', `${round(fc)}`);
        el.style.setProperty('--card-opacity', '1');
        el.style.setProperty('--rotate-x',    `${round(cy  / 3.5)}deg`);
        el.style.setProperty('--rotate-y',    `${round(-(cx / 3.5))}deg`);
      });
    },
    [enabled]
  );

  const onPointerLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--pointer-x',   '50%');
    el.style.setProperty('--pointer-y',   '50%');
    el.style.setProperty('--background-x', '50%');
    el.style.setProperty('--background-y', '50%');
    el.style.setProperty('--pointer-from-center', '0');
    el.style.setProperty('--card-opacity', '0');
    el.style.setProperty('--rotate-x',    '0deg');
    el.style.setProperty('--rotate-y',    '0deg');
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return { ref, onPointerMove, onPointerLeave };
}

/* ─── Detail Modal ──────────────────────────────────────────────────────── */

interface DetailModalProps {
  achievement: IAchievement;
  onClose: () => void;
}

function AchievementDetailModal({ achievement, onClose }: DetailModalProps) {
  const isEarned  = achievement.isEarned ?? false;
  const rarity    = achievement.rarity;
  const isSecret  = achievement.isSecret && !isEarned;
  const textColor = isEarned ? RARITY_TEXT[rarity] : RARITY_DIM[rarity];
  const hClass    = isEarned ? holoClass(rarity) : '';
  const { ref, onPointerMove, onPointerLeave } = usePokemonCard(isEarned);

  // Entering animation — remove the class after the keyframe completes
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 520);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const content = (
    <div
      className="ac-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* × close button — top right of backdrop */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 z-10"
        aria-label="Close"
      >
        <Icon icon="mdi:close" width={20} height={20} />
      </button>

      {/* Big card */}

      <div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className={[
          'ac-card relative rounded-2xl border overflow-hidden',
          'w-full max-w-md',
          hClass,
          isEarned ? 'ac-earned' : '',
          entering ? 'ac-modal-card-entering' : '',
        ].filter(Boolean).join(' ')}
        style={{
          background: cardBg(rarity, isEarned),
          borderColor: borderColor(rarity, isEarned),
          padding: '32px',
          boxShadow: `0 0 60px 4px ${RARITY_GLOW[rarity]}, 0 24px 48px -8px rgba(0,0,0,0.7)`,
        }}
      >
        {isEarned && hClass && <div className="ac-shine" />}
        {isEarned && <div className="ac-glare" />}

        <div className="relative z-10 flex flex-col items-center text-center gap-5">
          {/* Big icon */}
          <div className="relative">
            <div
              className="rounded-2xl flex items-center justify-center"
              style={{
                width: 100,
                height: 100,
                background: `${BADGE_BG[rarity]}cc`,
                boxShadow: isEarned ? `0 0 32px 4px ${BADGE_TEXT[rarity]}44` : undefined,
              }}
            >
              <AchievementIcon
                iconSlug={isSecret ? undefined : achievement.iconSlug}
                rarity={rarity}
                isEarned={isEarned}
                size={64}
              />
            </div>

            {/* Earned checkmark badge */}
            {isEarned && (
              <div
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-black text-xs font-black"
                style={{ background: BADGE_TEXT[rarity] }}
              >
                ✓
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <h2 className="text-2xl font-extrabold mb-1" style={{ color: textColor }}>
              {isSecret ? '???' : (achievement.name ?? 'Secret Achievement')}
            </h2>

            {/* Rarity pill */}
            <span
              className="inline-block text-sm font-bold px-3 py-1 rounded-full capitalize"
              style={{ background: BADGE_BG[rarity], color: BADGE_TEXT[rarity] }}
            >
              {rarity}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed opacity-80 max-w-xs" style={{ color: textColor }}>
            {isSecret
              ? (achievement.hint || 'Complete a secret condition to reveal this achievement.')
              : (achievement.description ?? '')}
          </p>

          {/* Divider */}
          <div className="w-full h-px" style={{ background: borderColor(rarity, isEarned) }} />

          {/* Meta stats grid */}
          <div className="w-full grid grid-cols-3 gap-4 text-center">
            {achievement.points > 0 && (
              <div>
                <div className="text-xl font-black" style={{ color: BADGE_TEXT[rarity] }}>
                  {achievement.points}
                </div>
                <div className="text-xs opacity-50 mt-0.5" style={{ color: textColor }}>points</div>
              </div>
            )}
            {achievement.rarityPercent !== undefined && (
              <div>
                <div className="text-xl font-black" style={{ color: BADGE_TEXT[rarity] }}>
                  {achievement.rarityPercent}%
                </div>
                <div className="text-xs opacity-50 mt-0.5" style={{ color: textColor }}>of users</div>
              </div>
            )}
            {isEarned && achievement.unlockedAt && (
              <div>
                <div className="text-sm font-bold" style={{ color: BADGE_TEXT[rarity] }}>
                  {new Date(achievement.unlockedAt).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </div>
                <div className="text-xs opacity-50 mt-0.5" style={{ color: textColor }}>unlocked</div>
              </div>
            )}
          </div>

          {/* Progress bar for locked achievements */}
          {!isEarned && !isSecret && achievement.condition?.threshold && (achievement.progress ?? 0) > 0 && (
            <div className="w-full">
              <div className="flex justify-between text-xs mb-2" style={{ color: textColor, opacity: 0.7 }}>
                <span>{achievement.progress?.toLocaleString()}</span>
                <span>{achievement.condition.threshold.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, ((achievement.progress ?? 0) / achievement.condition.threshold) * 100)}%`,
                    background: BADGE_TEXT[rarity],
                    boxShadow: `0 0 8px ${BADGE_TEXT[rarity]}88`,
                  }}
                />
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/* ─── AchievementCard ───────────────────────────────────────────────────── */

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
  const [showDetail, setShowDetail] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const isEarned   = achievement.isEarned ?? false;
  const rarity     = achievement.rarity;
  const hClass     = isEarned ? holoClass(rarity) : '';
  const { ref, onPointerMove, onPointerLeave } = usePokemonCard(isEarned && !flipping);

  const textColor  = isEarned ? RARITY_TEXT[rarity] : RARITY_DIM[rarity];
  const bg         = cardBg(rarity, isEarned);
  const border     = borderColor(rarity, isEarned);

  const handleClick = () => {
    if (onClick) { onClick(); return; }
    if (flipping) return;
    // 1. Trigger the 360° spin on the small card
    setFlipping(true);
    // 2. Open the modal at ~midpoint (card is edge-on), creating the illusion
    //    that it "flew off" and became the big card
    setTimeout(() => setShowDetail(true), 280);
    // 3. Remove the animation class once it completes
    setTimeout(() => setFlipping(false), 560);
  };

  /* ── Hidden stub ──────────────────────────────────────────────────────── */
  if (achievement.isHidden && !isEarned) {
    return (
      <div
        onClick={handleClick}
        className="relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer hover:scale-[1.02]"
        style={{
          background: cardBg('secret', false),
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
    <>
      <div
        ref={ref}
        onClick={handleClick}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className={[
          'ac-card',
          'relative rounded-xl border cursor-pointer',
          flipping ? '' : 'transition-all duration-300',
          hClass,
          isEarned ? 'ac-earned' : '',
          !isEarned && !isSecret ? 'opacity-60' : '',
          flipping ? 'ac-flipping' : '',
        ].filter(Boolean).join(' ')}
        style={{
          background: bg,
          borderColor: border,
          padding: compact ? '12px' : '20px',
        }}
      >
        {/* Shine layer */}
        {isEarned && hClass && <div className="ac-shine" />}
        {/* Glare overlay */}
        {isEarned && <div className="ac-glare" />}

        {/* Card content */}
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

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={`font-bold truncate ${compact ? 'text-sm' : 'text-base'}`}
                style={{ color: textColor }}
              >
                {isSecret ? '???' : (achievement.name ?? 'Secret Achievement')}
              </h3>

              {/* Rarity badge */}
              <span
                className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-md capitalize"
                style={{ background: BADGE_BG[rarity], color: BADGE_TEXT[rarity] }}
              >
                {rarity}
              </span>

              {/* Earned ✓ */}
              {isEarned && (
                <span className="shrink-0 text-xs" style={{ color: BADGE_TEXT[rarity] }}>✓</span>
              )}
            </div>

            {/* Description / hint */}
            {!compact && (
              <p className="text-xs mt-1 line-clamp-2 opacity-75" style={{ color: textColor }}>
                {isSecret
                  ? (achievement.hint || 'Complete a secret condition to reveal this achievement.')
                  : (achievement.description ?? '')}
              </p>
            )}

            {/* Progress bar */}
            {!isEarned && !isSecret && achievement.condition?.threshold && (achievement.progress ?? 0) > 0 && (
              <div className="mt-2">
                <div
                  className="flex justify-between text-xs mb-1"
                  style={{ color: textColor, opacity: 0.7 }}
                >
                  <span>{achievement.progress?.toLocaleString()}</span>
                  <span>{achievement.condition.threshold.toLocaleString()}</span>
                </div>
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, ((achievement.progress ?? 0) / achievement.condition.threshold) * 100)}%`,
                      background: border,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Meta row: rarity %, unlock date, points */}
            {!compact && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {achievement.rarityPercent !== undefined && (
                  <span className="text-xs opacity-50" style={{ color: textColor }}>
                    {achievement.rarityPercent}% of users
                  </span>
                )}
                {isEarned && achievement.unlockedAt && (
                  <span className="text-xs opacity-50" style={{ color: textColor }}>
                    {new Date(achievement.unlockedAt).toLocaleDateString()}
                  </span>
                )}
                {achievement.points > 0 && (
                  <span className="text-xs font-semibold opacity-60" style={{ color: BADGE_TEXT[rarity] }}>
                    {achievement.points} pts
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal — rendered via portal so it escapes any overflow:hidden parent */}
      {showDetail && (
        <AchievementDetailModal
          achievement={achievement}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}

/* Named exports used by other achievement components */
export { BADGE_BG, BADGE_TEXT };
