import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { IAchievement, AchievementRarity } from '../../types';
import { createPortal } from 'react-dom';
import { RARITY_COLOR, rarityTint } from './rarity';

/* ─── Icon sub-component ────────────────────────────────────────────────── */

interface AchievementIconProps {
  iconSlug?: string;
  rarity: AchievementRarity;
  isEarned?: boolean;
  size?: number;
}

function AchievementIcon({ iconSlug, rarity, isEarned = false, size = 32 }: AchievementIconProps) {
  if (!iconSlug) {
    return (
      <span
        className={`font-black ${isEarned ? '' : 'text-base-content/30'}`}
        style={{
          fontSize: size * 0.6,
          color: isEarned ? RARITY_COLOR[rarity] : undefined,
        }}
      >
        ?
      </span>
    );
  }

  return (
    <span className={isEarned ? '' : 'text-base-content/30'}>
      <Icon
        icon={`game-icons:${iconSlug}`}
        width={size}
        height={size}
        color={isEarned ? RARITY_COLOR[rarity] : 'currentColor'}
        style={{ display: 'block' }}
      />
    </span>
  );
}

/* ─── Rarity badge ──────────────────────────────────────────────────────── */

function RarityBadge({ rarity, size = 'sm' }: { rarity: AchievementRarity; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold capitalize ${
        size === 'md' ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5'
      }`}
      style={{
        borderColor: rarityTint(rarity, '40'),
        background: rarityTint(rarity, '10'),
        color: RARITY_COLOR[rarity],
      }}
    >
      {rarity}
    </span>
  );
}

/* ─── Progress bar ──────────────────────────────────────────────────────── */

function AchievementProgress({
  achievement,
  compact = false,
}: {
  achievement: IAchievement;
  compact?: boolean;
}) {
  const threshold = achievement.condition?.threshold;
  const progress = achievement.progress ?? 0;
  if (!threshold || progress <= 0) return null;

  return (
    <div className="w-full">
      <div className={`flex justify-between text-xs text-base-content/60 ${compact ? 'mb-1' : 'mb-2'}`}>
        <span>{progress.toLocaleString()}</span>
        <span>{threshold.toLocaleString()}</span>
      </div>
      <div className={`${compact ? 'h-1' : 'h-1.5'} rounded-full bg-base-300 overflow-hidden`}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, (progress / threshold) * 100)}%`,
            background: RARITY_COLOR[achievement.rarity],
          }}
        />
      </div>
    </div>
  );
}

/* ─── Detail Modal ──────────────────────────────────────────────────────── */

interface DetailModalProps {
  achievement: IAchievement;
  onClose: () => void;
}

export function AchievementDetailModal({ achievement, onClose }: DetailModalProps) {
  const isEarned = achievement.isEarned ?? false;
  const rarity = achievement.rarity;
  const isSecret = achievement.isSecret && !isEarned;

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const content = (
    <dialog
      open
      className="modal modal-open"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-box max-w-md">
        <button
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          aria-label="Close"
        >
          <Icon icon="mdi:close" width={18} height={18} />
        </button>

        <div className="flex flex-col items-center text-center gap-4 py-2">
          {/* Icon */}
          <div className="relative">
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center border"
              style={{
                borderColor: isEarned ? rarityTint(rarity, '40') : 'transparent',
                background: isEarned
                  ? rarityTint(rarity, '14')
                  : 'color-mix(in oklab, var(--color-base-content) 6%, transparent)',
              }}
            >
              <AchievementIcon
                iconSlug={isSecret ? undefined : achievement.iconSlug}
                rarity={rarity}
                isEarned={isEarned}
                size={56}
              />
            </div>

            {isEarned && (
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-success text-success-content flex items-center justify-center">
                <Icon icon="mdi:check" width={14} height={14} />
              </div>
            )}
          </div>

          {/* Name + rarity */}
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold">
              {isSecret ? '???' : (achievement.name ?? 'Secret Achievement')}
            </h2>
            <RarityBadge rarity={rarity} size="md" />
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed text-base-content/70 max-w-xs">
            {isSecret
              ? (achievement.hint || 'Complete a secret condition to reveal this achievement.')
              : (achievement.description ?? '')}
          </p>

          <div className="divider my-0" />

          {/* Meta stats */}
          <div className="w-full grid grid-cols-3 gap-4 text-center">
            {achievement.points > 0 && (
              <div>
                <div className="text-xl font-extrabold">{achievement.points}</div>
                <div className="text-xs text-base-content/50 mt-0.5">points</div>
              </div>
            )}
            {achievement.rarityPercent !== undefined && (
              <div>
                <div className="text-xl font-extrabold">{achievement.rarityPercent}%</div>
                <div className="text-xs text-base-content/50 mt-0.5">of users</div>
              </div>
            )}
            {isEarned && achievement.unlockedAt && (
              <div>
                <div className="text-sm font-bold mt-1.5">
                  {new Date(achievement.unlockedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-xs text-base-content/50 mt-0.5">unlocked</div>
              </div>
            )}
          </div>

          {/* Progress bar for locked achievements */}
          {!isEarned && !isSecret && <AchievementProgress achievement={achievement} />}
        </div>
      </div>

      {/* Backdrop click to close */}
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
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
  const isEarned = achievement.isEarned ?? false;
  const rarity = achievement.rarity;

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    setShowDetail(true);
  };

  /* ── Hidden stub ──────────────────────────────────────────────────────── */
  if (achievement.isHidden && !isEarned) {
    return (
      <div
        onClick={handleClick}
        className={`rounded-xl border border-dashed border-base-300 bg-base-200/50 cursor-pointer hover:bg-base-200 transition-colors ${
          compact ? 'p-3' : 'p-5'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-lg bg-base-300/60 text-xl font-black text-base-content/30"
            style={{ width: compact ? 40 : 56, height: compact ? 40 : 56 }}
          >
            ?
          </div>
          <div>
            <p className="font-semibold text-sm text-base-content/60">Hidden Achievement</p>
            <p className="text-xs text-base-content/40 mt-0.5">Unlock to reveal</p>
          </div>
        </div>
      </div>
    );
  }

  const isSecret = achievement.isSecret && !isEarned;

  return (
    <>
      <div
        onClick={handleClick}
        className={`rounded-xl border cursor-pointer transition-all duration-200 ${
          isEarned
            ? 'bg-base-100 border-base-300 shadow-sm hover:shadow-md'
            : 'bg-base-200/50 border-base-300 hover:bg-base-200'
        } ${compact ? 'p-3' : 'p-5'}`}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="shrink-0 flex items-center justify-center rounded-lg"
            style={{
              width: compact ? 40 : 56,
              height: compact ? 40 : 56,
              background: isEarned
                ? rarityTint(rarity, '14')
                : 'color-mix(in oklab, var(--color-base-content) 6%, transparent)',
            }}
          >
            <AchievementIcon
              iconSlug={isSecret ? undefined : achievement.iconSlug}
              rarity={rarity}
              isEarned={isEarned}
              size={compact ? 24 : 32}
            />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={`font-bold truncate ${compact ? 'text-sm' : 'text-base'} ${
                  isEarned ? 'text-base-content' : 'text-base-content/60'
                }`}
              >
                {isSecret ? '???' : (achievement.name ?? 'Secret Achievement')}
              </h3>

              <RarityBadge rarity={rarity} />

              {isEarned && (
                <Icon
                  icon="mdi:check-circle"
                  className="shrink-0 text-success"
                  width={14}
                  height={14}
                />
              )}
            </div>

            {/* Description / hint */}
            {!compact && (
              <p
                className={`text-xs mt-1 line-clamp-2 ${
                  isEarned ? 'text-base-content/70' : 'text-base-content/50'
                }`}
              >
                {isSecret
                  ? (achievement.hint || 'Complete a secret condition to reveal this achievement.')
                  : (achievement.description ?? '')}
              </p>
            )}

            {/* Progress bar */}
            {!isEarned && !isSecret && (
              <div className="mt-2">
                <AchievementProgress achievement={achievement} compact />
              </div>
            )}

            {/* Meta row: rarity %, unlock date, points */}
            {!compact && (
              <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-base-content/50">
                {achievement.rarityPercent !== undefined && (
                  <span>{achievement.rarityPercent}% of users</span>
                )}
                {isEarned && achievement.unlockedAt && (
                  <span>{new Date(achievement.unlockedAt).toLocaleDateString()}</span>
                )}
                {achievement.points > 0 && (
                  <span className="font-semibold">{achievement.points} pts</span>
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
