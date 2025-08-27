import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { confetti } from '@tsparticles/confetti';

interface LevelUpAnimationProps {
  initialLevel: number;
  finalLevel: number;
  // thresholds and xp at the moment after logging (for the new level)
  xpCurrentLevel: number; // user.stats.userXpToCurrentLevel
  xpNextLevel: number; // user.stats.userXpToNextLevel
  finalXp: number; // user.stats.userXp
}

function LevelUpAnimation({
  initialLevel,
  finalLevel,
  xpCurrentLevel,
  xpNextLevel,
  finalXp,
}: LevelUpAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const oldLevelRef = useRef<HTMLSpanElement>(null);
  const newLevelRef = useRef<HTMLSpanElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const congratsRef = useRef<HTMLHeadingElement>(null);
  const xpBlockRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLProgressElement>(null);
  const xpTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();

    const totalForLevel = Math.max(1, xpNextLevel - xpCurrentLevel);
    const progressInLevel = Math.max(
      0,
      Math.min(finalXp - xpCurrentLevel, totalForLevel)
    );
    const percent = (progressInLevel / totalForLevel) * 100;

    // Initial state
    gsap.set(
      [
        oldLevelRef.current,
        newLevelRef.current,
        arrowRef.current,
        congratsRef.current,
        xpBlockRef.current,
        xpTextRef.current,
      ],
      {
        opacity: 0,
      }
    );

    // Animation sequence
    tl.to(oldLevelRef.current, { opacity: 1, duration: 0.45 })
      // nudge left within its cell, then bring it back to center to avoid overflow
      .to(oldLevelRef.current, { x: -20, duration: 0.35, delay: 0.25 })
      .to(
        [arrowRef.current, newLevelRef.current],
        { opacity: 1, duration: 0.4, stagger: 0.05 },
        '<'
      )
      .to(
        oldLevelRef.current,
        { x: 0, duration: 0.3, ease: 'power2.out' },
        '>-0.05'
      )
      .to(congratsRef.current, { opacity: 1, y: -12, duration: 0.5 })
      // Show XP block and animate progress
      .to(xpBlockRef.current, { opacity: 1, duration: 0.4, delay: 0.2 })
      .to(progressRef.current, {
        duration: 1.0,
        value: percent,
        ease: 'power2.out',
      })
      .to(xpTextRef.current, { opacity: 1, duration: 0.3 }, '-=0.6');

    // Confetti
    const particleCount = Math.min(200 + finalLevel * 10, 800);

    // Side streams from both edges for a short duration
    const sideDuration = 1500; // ms
    const perTick = Math.min(6 + Math.floor(finalLevel * 0.2), 14);
    const streamInterval = setInterval(() => {
      confetti({
        particleCount: perTick,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.6 },
        zIndex: 10000,
      });
      confetti({
        particleCount: perTick,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.6 },
        zIndex: 10000,
      });
    }, 120);
    const stopStream = setTimeout(
      () => clearInterval(streamInterval),
      sideDuration
    );

    // Central celebratory burst
    confetti({
      particleCount,
      spread: 180,
      origin: { y: 0.35 },
      zIndex: 10000,
    });

    // cleanup on unmount
    return () => {
      clearInterval(streamInterval);
      clearTimeout(stopStream);
    };
  }, [finalLevel, finalXp, xpCurrentLevel, xpNextLevel]);

  return (
    <div
      ref={containerRef}
      className="text-center text-white p-6 sm:p-8 rounded-lg"
    >
      <div className="flex flex-col items-center gap-4">
        <h2
          ref={congratsRef}
          className="text-3xl sm:text-4xl font-extrabold text-yellow-400"
          style={{ opacity: 0 }}
        >
          Congratulations! Level Up!
        </h2>

        <div
          className="grid grid-cols-3 items-center justify-items-center text-5xl sm:text-6xl font-extrabold w-full max-w-[32rem]"
          style={{ columnGap: '1.5rem' }}
        >
          <span
            ref={oldLevelRef}
            className="inline-block"
            style={{ opacity: 0 }}
          >
            Lv.{initialLevel}
          </span>
          <span ref={arrowRef} className="inline-block" style={{ opacity: 0 }}>
            &gt;
          </span>
          <span
            ref={newLevelRef}
            className="text-success inline-block"
            style={{ opacity: 0 }}
          >
            Lv.{finalLevel}
          </span>
        </div>

        {/* XP progress in the new level */}
        <div ref={xpBlockRef} className="mt-4" style={{ opacity: 0 }}>
          <div className="mb-2 text-base sm:text-lg opacity-90">
            Progress in Lv.{finalLevel}
          </div>
          <progress
            ref={progressRef}
            className="progress progress-success w-72 sm:w-96"
            value={0}
            max={100}
          />
          <div
            ref={xpTextRef}
            className="mt-2 text-sm sm:text-base"
            style={{ opacity: 0 }}
          >
            {Math.max(0, finalXp - xpCurrentLevel).toLocaleString()} /{' '}
            {Math.max(1, xpNextLevel - xpCurrentLevel).toLocaleString()} XP
          </div>
        </div>
      </div>
    </div>
  );
}

export default LevelUpAnimation;
