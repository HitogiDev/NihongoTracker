import constellations from '../assets/avatar-frames/constellations.svg?raw';
import type { AvatarFrame } from '../types';
import { resizeAvatarCanvas } from './avatarCanvas';
import { DEFAULT_CONSTELLATION_COLOR, getConstellationColor } from './constellationColors';

const turn = Math.PI * 2;
const starInterval = 0.28;
const starFadeDuration = 0.18;
const lineFadeDuration = 0.75;
const constellationHoldDuration = 1.3;
const constellationFadeDuration = 0.65;
const constellationGap = 0.25;

interface Star {
  id: string;
  size: number;
  angle: number;
  radius: number;
  cluster: string | null;
}

interface Ring {
  radius: number;
  color: string;
  width: number;
  opacity: number;
}

interface Artwork {
  star: Path2D;
  stars: Star[];
  rings: Ring[];
  connections: { from: number; to: number }[];
  sequences: {
    starOrder: number[];
    start: number;
    fadeStart: number;
    end: number;
  }[];
  cycleDuration: number;
}

let artwork: Artwork | undefined;

export function isCanvasAvatarFrame(
  frame?: AvatarFrame | null
): frame is 'constellations' {
  return frame === 'constellations';
}

function loadArtwork(): Artwork {
  if (artwork) return artwork;
  const svg = new DOMParser().parseFromString(constellations, 'image/svg+xml');
  const root = svg.documentElement;
  const star = new Path2D(
    root.querySelector('#star path')?.getAttribute('d') ?? ''
  );
  const stars = Array.from(
    root.querySelectorAll('[data-canvas-layer="stars"] use')
  ).map((node) => {
    const x = Number(node.getAttribute('x')) - 120;
    const y = Number(node.getAttribute('y')) - 120;
    return {
      id: node.id,
      size: Number(node.getAttribute('data-size') ?? 0.7),
      angle: Math.atan2(y, x),
      radius: Math.hypot(x, y),
      cluster: node.getAttribute('data-cluster'),
    };
  });
  const indices = new Map(stars.map((star, index) => [star.id, index]));
  const connections = Array.from(root.querySelectorAll('[data-stars]')).flatMap(
    (node) => {
      const route = (node.getAttribute('data-stars') ?? '').split(/\s+/);
      return route.slice(1).flatMap((id, index) => {
        const from = indices.get(route[index]);
        const to = indices.get(id);
        return from === undefined || to === undefined ? [] : [{ from, to }];
      });
    }
  );
  const rings = Array.from(root.children)
    .filter((node) => node.tagName === 'circle')
    .map((node) => ({
      radius: Number(node.getAttribute('r')),
      color: node.getAttribute('stroke') ?? '#7b9bd7',
      width: Number(node.getAttribute('stroke-width')),
      opacity: Number(node.getAttribute('opacity') ?? 1),
    }));
  let cycleDuration = 0;
  const sequences = ['1', '2', '3'].map((cluster) => {
    const starOrder = Array.from(
      new Set(
        connections
          .flatMap(({ from, to }) => [from, to])
          .filter((index) => stars[index].cluster === cluster)
      )
    );
    const start = cycleDuration;
    const fadeStart =
      start +
      (starOrder.length - 1) * starInterval +
      Math.max(starFadeDuration, lineFadeDuration) +
      constellationHoldDuration;
    const end = fadeStart + constellationFadeDuration;
    cycleDuration = end + constellationGap;
    return { starOrder, start, fadeStart, end };
  });
  artwork = { star, stars, rings, connections, sequences, cycleDuration };
  return artwork;
}

function smoothStep(value: number): number {
  const progress = Math.max(0, Math.min(1, value));
  return progress * progress * (3 - 2 * progress);
}

function drawConstellations(
  ctx: CanvasRenderingContext2D,
  art: Artwork,
  time: number,
  color?: string
) {
  const starColor = color ?? DEFAULT_CONSTELLATION_COLOR;
  const lineColor = color ?? '#b6d9ff';
  const glowColor = color ?? '#85bfff';
  const constellationPulse = 0.5 + 0.5 * Math.sin(time * turn / 3);
  for (const ring of art.rings) {
    ctx.globalAlpha = ring.opacity;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.width;
    ctx.beginPath();
    ctx.arc(120, 120, ring.radius, 0, turn);
    ctx.stroke();
  }
  const cycleTime = time % art.cycleDuration;
  const sequence = art.sequences.find(
    ({ start, end }) => cycleTime >= start && cycleTime < end
  );
  const constellationAlpha = new Array<number>(art.stars.length).fill(0);
  const constellationLineAlpha = new Array<number>(art.stars.length).fill(0);
  if (sequence) {
    const fade =
      1 -
      smoothStep(
        (cycleTime - sequence.fadeStart) / constellationFadeDuration
      );
    sequence.starOrder.forEach((index, order) => {
      const age = cycleTime - sequence.start - order * starInterval;
      constellationAlpha[index] =
        smoothStep(age / starFadeDuration) * fade;
      constellationLineAlpha[index] =
        smoothStep(age / lineFadeDuration) * fade;
    });
  }
  const points = art.stars.map((star, i) => {
    const angle = star.angle + (time * turn) / 180;
    const radius =
      star.radius + Math.sin(time * 0.6 + i * 1.7) * (star.cluster ? 0.5 : 2);
    const phase = time * (0.7 + (i % 4) * 0.13) + i * 1.9;
    const pulse = Math.max(0, Math.sin(phase));
    const alpha = star.cluster ? constellationAlpha[i] : 0.2 + pulse * 0.8;
    return {
      x: 120 + Math.cos(angle) * radius,
      y: 120 + Math.sin(angle) * radius,
      size: star.cluster ? star.size : i % 4 === 0 ? 1 : 0.55 + alpha * 0.2,
      alpha,
      cluster: star.cluster,
      glowPulse: star.cluster ? constellationPulse : 0.5 + 0.5 * Math.sin(phase),
    };
  });
  ctx.strokeStyle = lineColor;
  for (const connection of art.connections) {
    const a = points[connection.from];
    const b = points[connection.to];
    if (a.alpha === 0 || b.alpha === 0) continue;
    const alpha =
      Math.min(
        constellationLineAlpha[connection.from],
        constellationLineAlpha[connection.to]
      ) * 0.8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = 3 + constellationPulse * 2;
    ctx.globalAlpha = alpha * (0.12 + constellationPulse * 0.18);
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 3 + constellationPulse * 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 0.85;
    ctx.globalAlpha = alpha;
    ctx.stroke();
  }
  points.forEach((point) => {
    if (point.alpha === 0) return;
    ctx.save();
    ctx.translate(point.x, point.y);
    const scale = point.size;
    ctx.scale(scale, scale);
    const glowRadius = 6 + point.glowPulse * 4;
    ctx.globalAlpha = point.alpha * (0.3 + point.glowPulse * 0.45);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    glow.addColorStop(0, glowColor);
    glow.addColorStop(1, `${glowColor}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, turn);
    ctx.fill();
    ctx.globalAlpha = point.alpha;
    ctx.fillStyle = starColor;
    ctx.fill(art.star);
    ctx.beginPath();
    ctx.arc(0, 0, 1.1, 0, turn);
    ctx.fill();
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

export async function mountCanvasAvatarFrame(host: HTMLElement, starColor?: string) {
  const art = loadArtwork();
  const color = getConstellationColor(starColor);
  const root = document.createElement('canvas');
  root.className = 'avatar-frame-canvas';
  root.setAttribute('aria-hidden', 'true');
  const ctx = root.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Avatar canvas unavailable');
  let request = 0;
  let elapsed = 0;
  let previous = 0;
  let playing = false;
  const draw = () => {
    ctx.setTransform(root.width / 240, 0, 0, root.height / 240, 0, 0);
    ctx.clearRect(0, 0, 240, 240);
    drawConstellations(ctx, art, elapsed, color);
  };
  const tick = (now: number) => {
    if (!playing) return;
    const delta = now - previous;
    if (delta >= 1000 / 30) {
      elapsed += Math.min(delta, 100) / 1000;
      previous = now;
      draw();
    }
    request = requestAnimationFrame(tick);
  };
  const resize = () => {
    resizeAvatarCanvas(root);
    draw();
  };
  const setPlaying = (value: boolean) => {
    if (playing === value) return;
    playing = value;
    cancelAnimationFrame(request);
    if (playing) {
      previous = performance.now();
      request = requestAnimationFrame(tick);
    }
  };
  const dispose = () => {
    setPlaying(false);
    root.remove();
  };
  host.append(root);
  resize();
  return { root, animations: [] as Animation[], resize, setPlaying, dispose };
}
