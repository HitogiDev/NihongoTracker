import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { confetti } from '@tsparticles/confetti';
import { Volume2, VolumeX, TrendingUp, Flame } from 'lucide-react';
import { ILogCelebration } from '../types';
import LevelUpAnimation from './LevelUpAnimation';
import {
  playLogSuccess,
  playXpTick,
  playLevelUp,
  playOvertake,
  isSfxMuted,
  toggleSfx,
} from '../utils/sfx';

type Step = 'xp' | 'levelup' | 'overtake';

interface LogCelebrationProps {
  celebration: ILogCelebration;
  onClose: () => void;
}

export default function LogCelebration({
  celebration,
  onClose,
}: LogCelebrationProps) {
  const { xpGained, streak, levelUp, xp, rank } = celebration;
  const hasOvertake = !!rank && rank.overtaken.length > 0;

  const [step, setStep] = useState<Step>('xp');
  const [muted, setMuted] = useState(isSfxMuted);

  const overlayRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLDivElement>(null);
  const gainedRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLProgressElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);
  const overtakeCardRef = useRef<HTMLDivElement>(null);
  const rankFromRef = useRef<HTMLSpanElement>(null);
  const rankToRef = useRef<HTMLSpanElement>(null);
  const closingRef = useRef(false);

  const steps = useMemo<Step[]>(() => {
    const s: Step[] = ['xp'];
    if (levelUp) s.push('levelup');
    if (hasOvertake) s.push('overtake');
    return s;
  }, [levelUp, hasOvertake]);

  const isLastStep = steps.indexOf(step) === steps.length - 1;

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    gsap.to(overlayRef.current, {
      opacity: 0,
      duration: 0.25,
      onComplete: onClose,
    });
  };

  const handleAdvance = () => {
    const idx = steps.indexOf(step);
    if (idx >= steps.length - 1) {
      handleClose();
    } else {
      setStep(steps[idx + 1]);
    }
  };

  // Overlay fade-in once.
  useEffect(() => {
    gsap.fromTo(
      overlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.25 }
    );
  }, []);

  // ── Step 1: success pop + XP roll-up ────────────────────────────────────
  useEffect(() => {
    if (step !== 'xp') return;

    playLogSuccess();
    navigator.vibrate?.(30);

    // Small burst from the center where the check pops.
    void confetti({
      particleCount: 45,
      spread: 75,
      startVelocity: 28,
      origin: { y: 0.45 },
      zIndex: 10000,
    });

    const tl = gsap.timeline();

    tl.fromTo(
      checkRef.current,
      { scale: 0, rotation: -30 },
      { scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(2.2)' }
    ).fromTo(
      gainedRef.current,
      { opacity: 0, y: 16, scale: 0.85 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power2.out' },
      '-=0.2'
    );

    // XP counter + level progress roll-up.
    const startXp = Math.max(0, xp.current - xpGained);
    const totalForLevel = Math.max(1, xp.toNextLevel - xp.toCurrentLevel);
    const clampPct = (value: number) =>
      Math.max(0, Math.min(100, ((value - xp.toCurrentLevel) / totalForLevel) * 100));

    const counterData = { xp: startXp };
    tl.to(
      counterData,
      {
        xp: xp.current,
        duration: 1.2,
        ease: 'power2.out',
        onUpdate: () => {
          if (counterRef.current) {
            counterRef.current.textContent = Math.floor(
              counterData.xp
            ).toLocaleString();
          }
          if (progressRef.current) {
            progressRef.current.value = clampPct(counterData.xp);
          }
          playXpTick();
        },
      },
      '-=0.1'
    );

    if (streak > 0) {
      tl.fromTo(
        streakRef.current,
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2.5)' },
        '-=0.5'
      );
    }

    return () => {
      tl.kill();
    };
    // Restarting on payload change is intended: batched logs keep the counter
    // climbing toward the newest total.
  }, [step, xp, xpGained, streak]);

  // ── Step 2: level up fanfare (LevelUpAnimation brings its own confetti) ─
  useEffect(() => {
    if (step !== 'levelup') return;
    playLevelUp();
    navigator.vibrate?.([40, 60, 40]);
  }, [step]);

  // ── Step 3: overtake card ───────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'overtake' || !rank) return;

    playOvertake();
    navigator.vibrate?.(40);

    const tl = gsap.timeline();
    tl.fromTo(
      overtakeCardRef.current,
      { opacity: 0, y: 60, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }
    );

    // Rank swap: old rank slides away, new rank punches in.
    tl.fromTo(
      rankFromRef.current,
      { opacity: 1 },
      { opacity: 0.35, duration: 0.35, delay: 0.25 }
    ).fromTo(
      rankToRef.current,
      { scale: 0.6, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.5)' },
      '-=0.15'
    );

    // Side streams celebrate the pass.
    void confetti({
      particleCount: 60,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      zIndex: 10000,
    });
    void confetti({
      particleCount: 60,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      zIndex: 10000,
    });

    return () => {
      tl.kill();
    };
  }, [step, rank]);

  const overtaken = rank?.overtaken ?? [];
  const shownOvertaken = overtaken.slice(0, 3);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleAdvance();
      }}
    >
      {/* Mute toggle */}
      <button
        onClick={() => setMuted(toggleSfx())}
        className="btn btn-circle btn-ghost btn-sm absolute top-4 right-4 text-white/60 hover:text-white"
        aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      {/* Step dots */}
      {steps.length > 1 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2">
          {steps.map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                s === step ? 'bg-white scale-125' : 'bg-white/25'
              }`}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-5 px-4 max-w-md w-full text-center">
        {step === 'xp' && (
          <>
            {/* Success check */}
            <div
              ref={checkRef}
              className="w-20 h-20 rounded-full bg-success flex items-center justify-center shadow-lg shadow-success/40"
              style={{ transform: 'scale(0)' }}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-11 h-11 text-success-content"
                fill="none"
                stroke="currentColor"
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div ref={gainedRef} style={{ opacity: 0 }}>
              <div className="text-3xl font-extrabold text-success">
                +{xpGained.toLocaleString()} XP
              </div>
              <div className="text-sm text-white/60 mt-1">Log successful!</div>
            </div>

            {/* Counter + level progress */}
            <div className="w-full max-w-sm">
              <div className="flex items-baseline justify-center gap-2">
                <span
                  ref={counterRef}
                  className="text-5xl font-extrabold text-white tabular-nums"
                >
                  {Math.max(0, xp.current - xpGained).toLocaleString()}
                </span>
                <span className="text-2xl font-light text-white/50">XP</span>
              </div>
              <div className="flex justify-between text-xs font-medium text-white/60 mt-4 mb-1">
                <span>Level {xp.level}</span>
                <span>
                  {xp.current.toLocaleString()} /{' '}
                  {xp.toNextLevel.toLocaleString()} XP
                </span>
              </div>
              <progress
                ref={progressRef}
                className="progress progress-success w-full h-3"
                value={Math.max(
                  0,
                  Math.min(
                    100,
                    ((xp.current - xpGained - xp.toCurrentLevel) /
                      Math.max(1, xp.toNextLevel - xp.toCurrentLevel)) *
                      100
                  )
                )}
                max={100}
              />
            </div>

            {streak > 0 && (
              <div
                ref={streakRef}
                className="flex items-center gap-1.5 rounded-full bg-orange-500/15 border border-orange-400/30 px-4 py-1.5 text-orange-300 font-bold"
                style={{ opacity: 0 }}
              >
                <Flame size={18} className="fill-orange-400 text-orange-500" />
                {streak} day{streak === 1 ? '' : 's'} streak
              </div>
            )}
          </>
        )}

        {step === 'levelup' && levelUp && (
          <LevelUpAnimation
            initialLevel={levelUp.from}
            finalLevel={levelUp.to}
            xpCurrentLevel={xp.toCurrentLevel}
            xpNextLevel={xp.toNextLevel}
            finalXp={xp.current}
          />
        )}

        {step === 'overtake' && rank && (
          <div
            ref={overtakeCardRef}
            className="w-full max-w-sm rounded-2xl border border-primary/40 bg-base-100/95 shadow-2xl shadow-primary/20 p-6 flex flex-col items-center gap-4"
            style={{ opacity: 0 }}
          >
            <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-xs">
              <TrendingUp size={16} />
              Monthly ranking
            </div>

            {/* Overtaken avatars */}
            <div className="flex -space-x-3">
              {shownOvertaken.map((u) => (
                <div
                  key={u.username}
                  className="w-12 h-12 rounded-full ring-2 ring-base-100 bg-base-300 overflow-hidden"
                >
                  {u.avatar ? (
                    <img
                      src={u.avatar}
                      alt={u.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-base-content/60">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-xl font-extrabold text-base-content">
              You passed{' '}
              <span className="text-primary">
                @{shownOvertaken[0]?.username}
              </span>
              {overtaken.length > 1 && (
                <span className="text-base-content/60 font-semibold">
                  {' '}
                  and {overtaken.length - 1} more
                </span>
              )}
              !
            </div>

            {/* Rank change */}
            <div className="flex items-baseline gap-3 text-3xl font-black">
              <span ref={rankFromRef} className="text-base-content/40">
                #{rank.previousRank}
              </span>
              <span className="text-primary text-2xl self-center">→</span>
              <span ref={rankToRef} className="text-primary" style={{ opacity: 0 }}>
                #{rank.rank}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleAdvance}
          className="btn btn-primary btn-sm px-8 mt-2"
        >
          {isLastStep ? 'Awesome!' : 'Next'}
        </button>
      </div>
    </div>
  );
}
