import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useUserDataStore } from '../store/userData';

interface XpAnimationProps {
  initialXp: number;
  finalXp: number;
  duration?: number;
}

const XpAnimation: React.FC<XpAnimationProps> = ({
  initialXp,
  finalXp,
  duration = 1.5,
}) => {
  const xpRef = useRef<HTMLDivElement>(null);
  const gainedXpRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLProgressElement>(null);
  const { user } = useUserDataStore();

  const gainedXp = finalXp - initialXp;

  useEffect(() => {
    if (!user?.stats) return;

    const { userXpToCurrentLevel, userXpToNextLevel } = user.stats;
    const totalXpForLevel = userXpToNextLevel - userXpToCurrentLevel;

    const initialProgress =
      ((initialXp - userXpToCurrentLevel) / totalXpForLevel) * 100;
    const finalProgress =
      ((finalXp - userXpToCurrentLevel) / totalXpForLevel) * 100;

    const animationData = {
      xp: initialXp,
      progress: initialProgress,
    };

    const tl = gsap.timeline();

    tl.to(animationData, {
      xp: finalXp,
      progress: finalProgress,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (xpRef.current) {
          xpRef.current.textContent = Math.floor(
            animationData.xp
          ).toLocaleString();
        }
        if (progressBarRef.current) {
          progressBarRef.current.value = animationData.progress;
        }
      },
    });

    if (gainedXp > 0 && gainedXpRef.current) {
      gsap.fromTo(
        gainedXpRef.current,
        { y: 20, opacity: 0, scale: 0.8 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.5,
          ease: 'power2.out',
          delay: 0.2,
        }
      );
    }
  }, [initialXp, finalXp, duration, gainedXp, user?.stats]);

  if (!user?.stats) return null;

  const { userLevel, userXpToNextLevel } = user.stats;

  return (
    <div className="text-center p-4 text-white w-full max-w-md">
      <h2 className="text-3xl font-bold mb-2">Log Successful!</h2>
      <div
        ref={gainedXpRef}
        className="text-xl font-semibold text-success opacity-0"
      >
        +{gainedXp.toLocaleString()} XP
      </div>
      <div className="flex items-center justify-center gap-2 mt-4">
        <div
          ref={xpRef}
          className="text-6xl font-bold text-success"
          style={{ minWidth: '50px' }}
        >
          {initialXp.toLocaleString()}
        </div>
        <span className="text-4xl font-light opacity-70">XP</span>
      </div>
      <div className="mt-6 w-full">
        <div className="flex justify-between text-sm font-medium mb-1 opacity-80">
          <span>Level {userLevel}</span>
          <span>
            {finalXp.toLocaleString()} / {userXpToNextLevel.toLocaleString()} XP
          </span>
        </div>
        <progress
          ref={progressBarRef}
          className="progress progress-success w-full"
          value={
            ((initialXp - user.stats.userXpToCurrentLevel) /
              (user.stats.userXpToNextLevel -
                user.stats.userXpToCurrentLevel)) *
            100
          }
          max="100"
        />
      </div>
    </div>
  );
};

export default XpAnimation;
