import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { IPendingAchievement } from '../../types';
import { Icon } from '@iconify/react';
import { RARITY_COLOR, rarityTint } from './rarity';

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

  const rarity = a.rarity ?? 'common';
  const rarityColor = RARITY_COLOR[rarity] ?? RARITY_COLOR.common;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ opacity: 0 }}
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
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentIndex ? 'bg-white scale-125' : 'bg-white/25'
              }`}
            />
          ))}
        </div>
      )}

      {/* Card container */}
      <div className="flex flex-col items-center gap-6 px-4 max-w-sm w-full">
        {/* Achievement unlocked label */}
        <div className="text-xs font-bold uppercase tracking-widest text-white/70">
          Achievement Unlocked!
        </div>

        {/* 3D flip card */}
        <div className="achievement-flip-scene w-48 h-48">
          <div className={`achievement-flip-card ${isFlipped ? 'flipped' : ''}`}>
            {/* Front — unrevealed ? card */}
            <div className="achievement-flip-front rounded-2xl border border-base-300 bg-base-200 flex items-center justify-center">
              <span className="text-7xl font-black text-base-content/20">?</span>
            </div>

            {/* Back — real achievement */}
            <div
              className="achievement-flip-back rounded-2xl border bg-base-100 flex items-center justify-center"
              style={{ borderColor: rarityTint(rarity, '66') }}
            >
              {a.iconSlug ? (
                <Icon
                  icon={`game-icons:${a.iconSlug}`}
                  width={96}
                  height={96}
                  color={rarityColor}
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
              className="text-2xl font-extrabold text-white"
              style={{ opacity: 0 }}
            >
              {a.name ?? 'Secret Achievement'}
            </h2>

            <span
              ref={rarityRef}
              className="self-center text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border"
              style={{
                borderColor: rarityTint(rarity, '40'),
                background: rarityTint(rarity, '1a'),
                color: rarityColor,
                opacity: 0,
              }}
            >
              {rarity}
            </span>

            <p
              ref={descRef}
              className="text-sm text-white/70 mt-1 max-w-xs"
              style={{ opacity: 0 }}
            >
              {a.description ?? ''}
            </p>

            <div
              ref={unlockTextRef}
              className="text-xs text-white/40 mt-2"
              style={{ opacity: 0 }}
            >
              {a.rarityPercent !== undefined && `${a.rarityPercent}% of users • `}
              {a.points > 0 && `${a.points} pts`}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-2">
          <button onClick={handleNext} className="btn btn-sm btn-primary px-6">
            {isLast ? 'Awesome!' : `Next (${currentIndex + 1}/${achievements.length})`}
          </button>
          {!isLast && (
            <button
              onClick={handleDismiss}
              className="btn btn-sm btn-ghost text-white/60 hover:text-white"
            >
              Skip all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
