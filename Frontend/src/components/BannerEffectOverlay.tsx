import { useEffect, useId, useMemo, useRef } from 'react';
import type { BannerEffect } from '../types';
import {
  observeAvatarCanvasResolution,
  resizeAvatarCanvas,
} from '../utils/avatarCanvas';
import {
  BANNER_PETAL_PATH,
  BANNER_SNOW_PATH,
  BANNER_STAR_PATH,
  createBannerParticles,
  createBannerRenderer,
} from '../utils/bannerEffects';

interface BannerEffectOverlayProps {
  effect?: BannerEffect | null;
  seed?: string;
}

export default function BannerEffectOverlay({
  effect,
  seed = 'banner',
}: BannerEffectOverlayProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const lightId = useId();
  const particles = useMemo(
    () =>
      effect && effect !== 'none' ? createBannerParticles(effect, seed) : [],
    [effect, seed],
  );

  useEffect(() => {
    const root = host.current;
    const surface = canvas.current;
    if (!root || !surface || !effect || effect === 'none') return;
    let render: ReturnType<typeof createBannerRenderer>;
    try {
      const ctx = surface.getContext('2d', { alpha: true });
      if (!ctx) return;
      render = createBannerRenderer(ctx, effect, particles);
    } catch {
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let request = 0;
    let time = 0;
    let previous = 0;
    let width = 1;
    let height = 1;
    let failed = false;
    const draw = () => {
      try {
        render(width, height, time);
      } catch {
        failed = true;
        delete root.dataset.canvasReady;
      }
    };
    const tick = (now: number) => {
      if (failed) return;
      if (now - previous >= 1000 / 30) {
        time += Math.min(now - previous, 100) / 1000;
        previous = now;
        draw();
      }
      request = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(request);
      if (reduced.matches || failed) delete root.dataset.canvasReady;
      else root.dataset.canvasReady = 'true';
      if (visible && !document.hidden && !reduced.matches && !failed) {
        previous = performance.now();
        request = requestAnimationFrame(tick);
      }
    };
    const resize = () => {
      resizeAvatarCanvas(surface);
      const bounds = surface.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      draw();
      update();
    };
    const contextLost = () => {
      failed = true;
      update();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    const sizes = new ResizeObserver(resize);
    intersection.observe(root);
    sizes.observe(root);
    const stopResolution = observeAvatarCanvasResolution(resize);
    reduced.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    surface.addEventListener('contextlost', contextLost);
    resize();
    return () => {
      cancelAnimationFrame(request);
      intersection.disconnect();
      sizes.disconnect();
      stopResolution();
      reduced.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      surface.removeEventListener('contextlost', contextLost);
      delete root.dataset.canvasReady;
    };
  }, [effect, particles]);

  if (!effect || effect === 'none') return null;
  return (
    <div ref={host} className="banner-effect" aria-hidden="true">
      <div className="banner-effect-fallback">
        {particles.map((p, i) => (
          <svg
            key={i}
            viewBox="-12 -12 24 24"
            className="banner-effect-vector"
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              width: p.size * 24,
              height: p.size * 24,
            }}
          >
            <defs>
              <radialGradient id={`${lightId}-${i}`}>
                <stop
                  stopColor={effect === 'fireflies' ? '#72ff76' : '#85bfff'}
                  stopOpacity=".65"
                />
                <stop
                  offset="1"
                  stopColor={effect === 'fireflies' ? '#36e353' : '#85bfff'}
                  stopOpacity="0"
                />
              </radialGradient>
            </defs>
            {effect !== 'sakura' && (
              <circle
                r={effect === 'fireflies' ? 11 : 6}
                fill={`url(#${lightId}-${i})`}
              />
            )}
            {effect === 'fireflies' && (
              <>
                <circle r="2.8" fill="#8bff9c" />
                <circle r="1.4" fill="#d7ffd3" />
              </>
            )}
            {effect === 'stars' && (
              <>
                <path d={BANNER_STAR_PATH} fill="#f4f8ff" />
                <circle r="1.1" fill="#f4f8ff" />
              </>
            )}
            {effect === 'sakura' && (
              <path
                d={BANNER_PETAL_PATH}
                fill={p.color}
                transform={`rotate(${(p.phase * 180) / Math.PI})`}
              />
            )}
            {effect === 'snow' &&
              (i % 3 === 0 ? (
                <path
                  d={BANNER_SNOW_PATH}
                  stroke="#edf7ff"
                  strokeWidth=".8"
                  strokeLinecap="round"
                />
              ) : (
                <circle r="1.5" fill="#f4faff" />
              ))}
          </svg>
        ))}
      </div>
      <canvas ref={canvas} className="banner-effect-canvas" />
    </div>
  );
}
