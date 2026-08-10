import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { BannerEffect } from '../types';
import { BANNER_EFFECT_PARTICLES } from '../utils/customization';

interface BannerEffectOverlayProps {
  effect?: BannerEffect | null;
  /** Stable seed so the particle layout doesn't reshuffle on every render. */
  seed?: string;
}

/** Deterministic 0–1 pseudo-random from a string seed and an index. */
function pseudoRandom(seed: string, index: number): number {
  let hash = 2166136261;
  const input = `${seed}:${index}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

/**
 * Ambient particles drawn over the profile banner (sakura petals, snow, stars,
 * fireflies). Purely decorative, so it is hidden from assistive tech and never
 * intercepts pointer events.
 */
export default function BannerEffectOverlay({
  effect,
  seed = 'banner',
}: BannerEffectOverlayProps) {
  const particles = useMemo(() => {
    if (!effect || effect === 'none') return [];

    const count = BANNER_EFFECT_PARTICLES[effect] ?? 0;

    return Array.from({ length: count }, (_, index) => {
      const left = pseudoRandom(seed, index) * 100;
      const top = pseudoRandom(seed, index + 500) * 100;
      const duration = 5 + pseudoRandom(seed, index + 1500) * 9;
      // Negative, and spread over a whole cycle: a positive delay parks every
      // particle at its start frame until it fires, so they come down in
      // visible waves. Starting each one mid-cycle scatters them from the
      // first paint and keeps the fall continuous.
      const delay = -pseudoRandom(seed, index + 1000) * duration;
      const scale = 0.6 + pseudoRandom(seed, index + 2000) * 0.8;
      // Per-particle path, otherwise every petal traces the same arc.
      const drift = -30 + pseudoRandom(seed, index + 2500) * 80;
      const spin = 180 + pseudoRandom(seed, index + 3000) * 360;

      // `top` is set for every effect, not just the static ones: the falling
      // keyframes override it while animating, and it is what keeps the
      // particles on screen for visitors who asked for reduced motion (where
      // the animation is disabled and the CSS start position would be above
      // the banner).
      const style: CSSProperties = {
        left: `${left}%`,
        top: `${top}%`,
        animationDelay: `${delay.toFixed(2)}s`,
        animationDuration: `${duration.toFixed(2)}s`,
        scale: `${scale.toFixed(2)}`,
        '--drift': `${drift.toFixed(0)}px`,
        '--spin': `${spin.toFixed(0)}deg`,
      } as CSSProperties;

      return { key: `${effect}-${index}`, style };
    });
  }, [effect, seed]);

  if (!particles.length) return null;

  return (
    <div className="banner-effect" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.key}
          className={`banner-particle banner-particle--${effect}`}
          style={particle.style}
        />
      ))}
    </div>
  );
}
