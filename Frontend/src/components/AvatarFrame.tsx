import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { AvatarFrame as Frame, IUserCustomization } from '../types';
import {
  getAvatarFrameClass,
  getAvatarFrameStyle,
  hasAvatarFrame,
} from '../utils/customization';
import {
  drawProceduralFrame,
  isProceduralFrame,
} from '../utils/proceduralAvatarFrames';
import {
  isDecorativeFrame,
  mountAvatarFrameLayers,
} from '../utils/avatarFrameLayers';
import {
  isCanvasAvatarFrame,
  mountCanvasAvatarFrame,
} from '../utils/canvasAvatarFrames';
import {
  observeAvatarCanvasResolution,
  resizeAvatarCanvas,
} from '../utils/avatarCanvas';
import { getConstellationColor } from '../utils/constellationColors';

type FrameScene = Awaited<
  ReturnType<typeof mountAvatarFrameLayers | typeof mountCanvasAvatarFrame>
>;

interface AvatarFrameProps {
  frame?: Frame | null;
  className?: string;
  preview?: boolean;
  customization?: IUserCustomization;
  children: ReactNode;
}

export default function AvatarFrame({
  frame,
  className = '',
  preview = false,
  customization,
  children,
}: AvatarFrameProps) {
  const wrapper = useRef<HTMLSpanElement>(null);
  const overlay = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textPathId = useId();
  const constellationColor = frame === 'constellations'
    ? getConstellationColor(customization?.frameColor1)
    : undefined;

  useEffect(() => {
    const host = overlay.current;
    const container = wrapper.current;
    if (!container) return;
    let disposed = false;
    let visible = false;
    let tick = 0;
    let previous = 0;
    let seconds = 0;
    const paint = (now: number) => {
      const elapsed = previous ? now - previous : 0;
      if (!previous || elapsed >= 28) {
        seconds += Math.min(elapsed, 50) / 1000;
        if (canvas.current && frame)
          drawProceduralFrame(canvas.current, frame, seconds);
        previous = now;
      }
      tick = requestAnimationFrame(paint);
    };
    let scene: FrameScene | undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      const playing = visible && !document.hidden && !reducedMotion.matches;
      container.dataset.frameActive = String(playing);
      cancelAnimationFrame(tick);
      previous = 0;
      if (playing && canvas.current) tick = requestAnimationFrame(paint);
      if (!scene || !host) return;
      scene.root.classList.toggle('avatar-frame-scene--playing', playing);
      if ('setPlaying' in scene) scene.setPlaying(playing);
      for (const animation of scene.animations) {
        if (playing) animation.play();
        else animation.pause();
      }
      // The original SVG supplies its unanimated state for reduced motion.
      container.dataset.frameLayers = reducedMotion.matches
        ? 'fallback'
        : 'ready';
      host.hidden = reducedMotion.matches;
    };
    const resize = () => {
      const referenceScale = container.clientWidth / 130;
      const glow =
        frame === 'gradient'
          ? 15
          : frame === 'segmented'
            ? 14
            : frame === 'rainbow'
              ? 16
              : 12;
      container.style.setProperty(
        '--frame-glow-radius',
        `${referenceScale * glow}px`
      );
      container.style.setProperty(
        '--frame-effect-scale',
        String(container.clientWidth / 120)
      );
      if (scene && host) {
        if ('resize' in scene) scene.resize();
        else scene.root.style.transform = `scale(${host.clientWidth / 240})`;
      }
      if (canvas.current && frame) {
        resizeAvatarCanvas(canvas.current);
        drawProceduralFrame(canvas.current, frame, seconds);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    const sizeObserver = new ResizeObserver(resize);
    // Use the option tile so small preview bounds do not pause visible options.
    observer.observe(
      preview ? (container.closest('button') ?? container) : container
    );
    if (host) sizeObserver.observe(host);
    sizeObserver.observe(container);
    resize();
    const stopResolutionObserver = canvas.current || isCanvasAvatarFrame(frame)
      ? observeAvatarCanvasResolution(resize)
      : () => {};
    reducedMotion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    if (host && (isDecorativeFrame(frame) || isCanvasAvatarFrame(frame)))
      void (
        isCanvasAvatarFrame(frame)
          ? mountCanvasAvatarFrame(host, constellationColor)
          : mountAvatarFrameLayers(host, frame)
      )
        .then((mounted: FrameScene) => {
          if (disposed) {
            if ('dispose' in mounted && typeof mounted.dispose === 'function')
              mounted.dispose();
            mounted.animations.forEach((animation) => animation.cancel());
            mounted.root.remove();
            return;
          }
          scene = mounted;
          resize();
          update();
        })
        .catch(() => {
          // Keep the SVG background when layer preparation is unavailable.
        });
    return () => {
      disposed = true;
      cancelAnimationFrame(tick);
      observer.disconnect();
      sizeObserver.disconnect();
      stopResolutionObserver();
      reducedMotion.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      scene?.animations.forEach((animation) => animation.cancel());
      if (scene && 'dispose' in scene) scene.dispose();
      scene?.root.remove();
      delete container.dataset.frameLayers;
      delete container.dataset.frameActive;
      if (host) host.hidden = false;
    };
  }, [frame, preview, constellationColor]);

  if (!hasAvatarFrame(frame)) return <>{children}</>;

  return (
    <span
      ref={wrapper}
      className={`${getAvatarFrameClass(frame)} ${className}`}
      style={getAvatarFrameStyle(frame, customization)}
    >
      {children}
      {isProceduralFrame(frame) && (
        <canvas
          ref={canvas}
          className="avatar-frame-canvas"
          aria-hidden="true"
        />
      )}
      {frame === 'crystal' && (
        <span className="avatar-frame-glass" aria-hidden="true" />
      )}
      {frame === 'text' && (
        <svg
          className="avatar-frame-text"
          viewBox="0 0 240 240"
          aria-hidden="true"
        >
          <defs>
            <path
              id={textPathId}
              d="M120 22 a98 98 0 1 1 0 196 a98 98 0 1 1 0 -196"
            />
          </defs>
          <text>
            <textPath
              href={`#${textPathId}`}
              textLength="600"
              lengthAdjust="spacingAndGlyphs"
            >
              {`${customization?.frameText?.trim() || '日本語を楽しもう'} ✦ ${customization?.frameText?.trim() || '日本語を楽しもう'} ✦ `}
            </textPath>
          </text>
        </svg>
      )}
      {(isDecorativeFrame(frame) || isCanvasAvatarFrame(frame)) && (
        <span
          ref={overlay}
          className="avatar-frame-overlay"
          aria-hidden="true"
        />
      )}
    </span>
  );
}
