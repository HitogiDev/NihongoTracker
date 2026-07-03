import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { IPendingAchievement } from '../../types';
import { getRarityConfig } from './AchievementCard';
import { Icon } from '@iconify/react';

interface AchievementRevealModalProps {
  achievements: IPendingAchievement[];
  onClose: () => void;
}

export default function AchievementRevealModal({
  achievements,
  onClose,
}: AchievementRevealModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const rarityRef = useRef<HTMLSpanElement>(null);
  const unlockTextRef = useRef<HTMLDivElement>(null);

  const current = achievements[currentIndex];
  const a = current?.achievement;

  const isLast = currentIndex === achievements.length - 1;

  useEffect(() => {
    if (!a) return;

    setIsFlipped(false);
    setShowContent(false);

    // Animate overlay in
    const tl = gsap.timeline();
    tl.fromTo(
      overlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3 }
    );

    // Brief pause, then flip
    tl.call(() => {
      setIsFlipped(true);
    }, [], '+=0.6');

    // After flip completes (0.8s CSS transition), show content
    tl.call(() => {
      setShowContent(true);

      // Flash the rarity color
      if (flashRef.current) {
        const flashClass = `achievement-flash-${a.rarity}`;
        flashRef.current.className = `pointer-events-none fixed inset-0 z-[9998] ${flashClass}`;
      }

      // Animate text elements in
      gsap.fromTo(
        [titleRef.current, rarityRef.current, descRef.current, unlockTextRef.current],
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }
      );
    }, [], '+=1.0');
  }, [currentIndex, a?._id]);

  const handleNext = () => {
    if (isLast) {
      handleDismiss();
      return;
    }
    setCurrentIndex((i) => i + 1);
  };

  const handleDismiss = () => {
    gsap.to(overlayRef.current, {
      opacity: 0,
      duration: 0.25,
      onComplete: onClose,
    });
  };

  if (!a) return null;

  const cfg = getRarityConfig(a.rarity, true);

  const rarityColors: Record<string, string> = {
    common: '#9ca3af',
    rare: '#60a5fa',
    epic: '#a855f7',
    legendary: '#fbbf24',
    secret: '#7c3aed',
  };
  const rarityColor = rarityColors[a.rarity] ?? '#9ca3af';

  return (
    <>
      {/* Rarity flash overlay */}
      <div ref={flashRef} className="pointer-events-none fixed inset-0 z-[9998]" />

      {/* Main modal overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          opacity: 0,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleDismiss();
        }}
      >
        {/* Count indicator */}
        {achievements.length > 1 && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2">
            {achievements.map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  background: i === currentIndex ? rarityColor : 'rgba(255,255,255,0.25)',
                  transform: i === currentIndex ? 'scale(1.3)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        )}

        {/* Card container */}
        <div className="flex flex-col items-center gap-6 px-4 max-w-sm w-full">
          {/* Achievement unlocked label */}
          <div
            className="text-xs font-bold uppercase tracking-widest opacity-70"
            style={{ color: rarityColor }}
          >
            Achievement Unlocked!
          </div>

          {/* 3D flip card */}
          <div className="achievement-flip-scene w-48 h-48">
            <div className={`achievement-flip-card ${isFlipped ? 'flipped' : ''}`}>
              {/* Front — secret ? card */}
              <div
                className="achievement-flip-front rounded-2xl border flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, oklch(10% 0.04 295) 0%, oklch(13% 0.06 290) 100%)',
                  borderColor: 'rgba(76, 29, 149, 0.4)',
                }}
              >
                <span className="text-7xl font-black text-purple-800/60">?</span>
              </div>

              {/* Back — real achievement */}
              <div
                className={`achievement-flip-back rounded-2xl border flex items-center justify-center relative overflow-hidden ${cfg.animationClass}`}
                style={{
                  background: cfg.cardBg,
                  borderColor: cfg.borderColor,
                }}
              >
              {a.iconSlug ? (
                  <Icon
                    icon={`game-icons:${a.iconSlug}`}
                    width={96}
                    height={96}
                    color={rarityColor}
                    style={{ filter: `drop-shadow(0 0 16px ${rarityColor}99)` }}
                  />
                ) : (
                  <span className="text-6xl">🏆</span>
                )}
              </div>
            </div>
          </div>

          {/* Achievement info */}
          {showContent && (
            <div className="text-center flex flex-col gap-2">
              <h2
                ref={titleRef}
                className="text-2xl font-extrabold"
                style={{ color: rarityColor, opacity: 0 }}
              >
                {a.name ?? 'Secret Achievement'}
              </h2>

              <span
                ref={rarityRef}
                className="self-center text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                style={{
                  background: cfg.badgeBg,
                  color: cfg.badgeText,
                  opacity: 0,
                }}
              >
                {cfg.label}
              </span>

              <p
                ref={descRef}
                className="text-sm opacity-75 mt-1 max-w-xs"
                style={{ color: cfg.textColor, opacity: 0 }}
              >
                {a.description ?? ''}
              </p>

              <div
                ref={unlockTextRef}
                className="text-xs opacity-40 mt-2"
                style={{ color: cfg.textColor, opacity: 0 }}
              >
                {a.rarityPercent !== undefined && `${a.rarityPercent}% of users • `}
                {a.points > 0 && `${a.points} pts`}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleNext}
              className="btn btn-sm font-semibold px-6"
              style={{
                background: rarityColor,
                color: '#000',
                border: 'none',
              }}
            >
              {isLast ? 'Awesome!' : `Next (${currentIndex + 1}/${achievements.length})`}
            </button>
            {!isLast && (
              <button
                onClick={handleDismiss}
                className="btn btn-sm btn-ghost opacity-50"
              >
                Skip all
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
