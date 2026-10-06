import constellations from '../assets/avatar-frames/constellations.svg?raw';
import type { BannerEffect } from '../types';

export type ActiveBannerEffect = Exclude<BannerEffect, 'none'>;
export const BANNER_STAR_PATH =
  constellations.match(/<g id="star"[^>]*>\s*<path d="([^"]+)"/)?.[1] ?? '';
export const BANNER_PETAL_PATH =
  'M0 4.9 C-4.55 1.75 -3.85 -4.55 -1.54 -7 Q0 -5.25 1.54 -7 C3.85 -4.55 4.55 1.75 0 4.9Z';
export const BANNER_SNOW_PATH = Array.from({ length: 6 }, (_, i) => {
  const a = (i * Math.PI) / 3;
  const point = (x: number, y: number) =>
    `${x * Math.cos(a) - y * Math.sin(a)} ${x * Math.sin(a) + y * Math.cos(a)}`;
  return `M0 0 L${point(5, 0)} M${point(3, 0)} L${point(4, 1.3)} M${point(3, 0)} L${point(4, -1.3)}`;
}).join(' ');

export interface BannerParticle {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  direction: number;
  color: string;
}

export function createBannerParticles(
  effect: ActiveBannerEffect,
  seed: string,
): BannerParticle[] {
  let hash = 2166136261;
  for (const character of seed)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const random = () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
    return ((hash ^= hash >>> 16) >>> 0) / 4294967296;
  };
  const counts = { sakura: 36, snow: 64, stars: 44, fireflies: 24 };
  return Array.from({ length: counts[effect] }, (_, i) => ({
    x: random(),
    y: random(),
    size: 0.45 + random() * 0.85,
    phase: random() * Math.PI * 2,
    speed: 0.6 + random() * 1.1,
    direction: i % 2 ? -1 : 1,
    color: i % 2 ? '#ffb8d9' : '#ff94c2',
  }));
}

export function createBannerRenderer(
  ctx: CanvasRenderingContext2D,
  effect: ActiveBannerEffect,
  particles: BannerParticle[],
) {
  const star = new Path2D(BANNER_STAR_PATH);
  const petal = new Path2D(BANNER_PETAL_PATH);
  const snow = new Path2D(BANNER_SNOW_PATH);
  const circle = (radius: number, color: string | CanvasGradient) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  const halo = (radius: number, center: string, edge: string) => {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, center);
    gradient.addColorStop(1, edge);
    circle(radius, gradient);
  };
  const wrap = (value: number, span: number) => ((value % span) + span) % span;
  return (width: number, height: number, seconds: number) => {
    ctx.setTransform(
      ctx.canvas.width / width,
      0,
      0,
      ctx.canvas.height / height,
      0,
      0,
    );
    ctx.clearRect(0, 0, width, height);
    particles.forEach((p, i) => {
      const time = seconds * p.speed;
      let x = p.x * width;
      let y = p.y * height;
      if (effect === 'snow' || effect === 'sakura') {
        const fall = effect === 'snow' ? 13 : 18;
        x =
          wrap(
            x +
              time * 8 * p.direction +
              Math.sin(time * 0.65 + p.phase) * 20 +
              20,
            width + 40,
          ) - 20;
        y = wrap(y + time * fall * p.size + 20, height + 40) - 20;
      } else if (effect === 'fireflies') {
        x +=
          Math.cos(time * 0.32 * p.direction + p.phase) *
          Math.min(45, width * 0.1);
        y +=
          Math.sin(time * 0.48 * p.direction + p.phase) *
          Math.min(28, height * 0.12);
      } else {
        x += Math.sin(time * 0.12 + p.phase) * 5;
        y += Math.cos(time * 0.15 + p.phase) * 4;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(p.size, p.size);
      if (effect === 'fireflies') {
        ctx.globalAlpha = 0.4 + (Math.sin(time * 1.7 + p.phase) + 1) * 0.3;
        const light = ctx.createRadialGradient(0, 0, 0, 0, 0, 11);
        light.addColorStop(0, 'rgba(114,255,118,.9)');
        light.addColorStop(0.3, 'rgba(83,246,107,.55)');
        light.addColorStop(1, 'rgba(54,227,83,0)');
        circle(11, light);
        circle(2.8, '#8bff9c');
        circle(1.4, '#d7ffd3');
      } else if (effect === 'stars') {
        ctx.globalAlpha =
          0.12 + Math.pow((Math.sin(time + p.phase) + 1) / 2, 2) * 0.88;
        halo(6, 'rgba(133,191,255,.45)', 'rgba(133,191,255,0)');
        ctx.fillStyle = '#f4f8ff';
        ctx.fill(star);
        circle(1.1, '#f4f8ff');
      } else if (effect === 'sakura') {
        ctx.rotate(
          time * 0.35 * p.direction +
            p.phase +
            Math.sin(time * 1.8 + p.phase) * 0.45,
        );
        ctx.scale(0.65 + Math.sin(time * 1.2 + p.phase) * 0.3, 1);
        halo(9, 'rgba(255,148,194,.22)', 'rgba(255,148,194,0)');
        ctx.fillStyle = p.color;
        ctx.fill(petal);
      } else {
        ctx.globalAlpha = 0.45 + p.size * 0.35;
        halo(7, 'rgba(199,228,255,.25)', 'rgba(199,228,255,0)');
        if (i % 3 === 0) {
          ctx.rotate(time * 0.2 * p.direction + p.phase);
          ctx.strokeStyle = '#edf7ff';
          ctx.lineWidth = 0.8;
          ctx.lineCap = 'round';
          ctx.stroke(snow);
        } else circle(1.5, '#f4faff');
      }
      ctx.restore();
    });
  };
}
