import type { AvatarFrame } from '../types';

type EffectCanvas = HTMLCanvasElement;

export function isProceduralFrame(frame?: AvatarFrame | null): boolean {
  return frame === 'electric' || frame === 'petals';
}

export function drawProceduralFrame(
  canvas: HTMLCanvasElement,
  frame: AvatarFrame,
  seconds: number,
): void {
  if (frame === 'petals')
    updateSakuraCanvas(canvas, seconds * 0.54, [
      '#ff94c2',
      '#ffb8d9',
      '#ffffff',
    ]);
  else if (frame === 'electric') drawElectric(canvas);
}

function drawElectric(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(canvas.width / 180, canvas.height / 180);
  const colors = ['#00f2fe', '#a855f7'];
  for (let layer = 0; layer < 2; layer++) {
    const crest = layer === 0 ? 7 : 4;
    const path = new Path2D();
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const jitter =
        Math.random() < 0.22
          ? Math.random() * crest * 0.7 + crest * 0.35
          : (Math.random() - (layer === 0 ? 0.4 : 0.5)) *
            crest *
            (layer === 0 ? 0.45 : 0.5);
      const radius = 64 + jitter;
      const x = 90 + radius * Math.cos(angle);
      const y = 90 + radius * Math.sin(angle);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
    ctx.strokeStyle = colors[layer];
    ctx.lineWidth = layer === 0 ? 2.2 : 1.4;
    ctx.lineJoin = 'bevel';
    ctx.lineCap = 'round';
    ctx.globalAlpha = layer === 0 ? 1 : 0.85;
    ctx.shadowColor = colors[layer];
    ctx.shadowBlur = layer === 0 ? 10 : 3;
    ctx.stroke(path);
    ctx.shadowBlur = 4;
    ctx.stroke(path);
  }
  ctx.restore();
}

const SAKURA_PETAL_PRESETS = [
  {
    baseAngle: 0.2,
    rOffset: -2.5,
    size: 7.0,
    phase: 0.0,
    colorIdx: 0,
    flutterSpeed: 1.8,
  },
  {
    baseAngle: 0.38,
    rOffset: 2.0,
    size: 5.4,
    phase: 0.8,
    colorIdx: 1,
    flutterSpeed: 2.1,
  },

  {
    baseAngle: 1.25,
    rOffset: 1.5,
    size: 6.4,
    phase: 2.1,
    colorIdx: 0,
    flutterSpeed: 1.6,
  },

  {
    baseAngle: 2.15,
    rOffset: 3.0,
    size: 7.2,
    phase: 3.3,
    colorIdx: 1,
    flutterSpeed: 1.9,
  },
  {
    baseAngle: 2.36,
    rOffset: -1.8,
    size: 5.2,
    phase: 4.2,
    colorIdx: 0,
    flutterSpeed: 2.0,
  },

  {
    baseAngle: 3.2,
    rOffset: -3.0,
    size: 4.8,
    phase: 5.0,
    colorIdx: 1,
    flutterSpeed: 2.2,
  },

  {
    baseAngle: 4.05,
    rOffset: -2.0,
    size: 6.8,
    phase: 1.4,
    colorIdx: 0,
    flutterSpeed: 1.7,
  },
  {
    baseAngle: 4.26,
    rOffset: 1.8,
    size: 5.6,
    phase: 2.5,
    colorIdx: 1,
    flutterSpeed: 2.0,
  },

  {
    baseAngle: 5.0,
    rOffset: 2.5,
    size: 6.2,
    phase: 3.7,
    colorIdx: 0,
    flutterSpeed: 1.8,
  },
  {
    baseAngle: 5.75,
    rOffset: -1.0,
    size: 5.0,
    phase: 4.8,
    colorIdx: 1,
    flutterSpeed: 2.0,
  },
];

const sakuraPollen: {
  baseAngle: number;
  baseR: number;
  phase: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
}[] = [];

function initSakuraPollen() {
  sakuraPollen.length = 0;
  const totalCount = 32;
  for (let i = 0; i < totalCount; i++) {
    const isPair = i % 2 === 1;
    const baseAngle = isPair
      ? sakuraPollen[i - 1].baseAngle + 0.14
      : (i / totalCount) * Math.PI * 2 + ((i * 1.37) % 0.8);
    const baseR = 60 + ((i * 7) % 15);
    sakuraPollen.push({
      baseAngle,
      baseR,
      phase: i * 1.5,
      size: 0.9 + ((i * 3) % 4) * 0.3,
      opacity: 0.35 + ((i * 5) % 5) * 0.12,
      twinkleSpeed: 2.0 + ((i * 7) % 4) * 0.6,
    });
  }
}

function updateSakuraCanvas(
  canvas: EffectCanvas,
  time: number,
  colors: string[],
  orbitRadius = 66,
) {
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  const dpr = canvas.width / 180;
  if (dpr !== 1) ctx.scale(dpr, dpr);

  const Cx = 90;
  const Cy = 90;
  const R = orbitRadius !== undefined ? orbitRadius : 66;

  SAKURA_PETAL_PRESETS.forEach((p) => {
    const localTime = time * (p.colorIdx === 0 ? 1.08 : 0.88);
    const orbitAngle = localTime * 0.5 + p.baseAngle;
    const currentR = R + p.rOffset + Math.sin(localTime * 1.4 + p.phase) * 3.5;
    const px = Cx + currentR * Math.cos(orbitAngle);
    const py = Cy + currentR * Math.sin(orbitAngle);
    const flutter =
      orbitAngle +
      Math.sin(localTime * p.flutterSpeed + p.phase) * 0.45 +
      Math.PI / 4;

    const petalColor =
      p.colorIdx === 0 ? colors[0] || '#ff94c2' : colors[1] || '#ffb8d9';
    drawSakuraPetal(ctx, px, py, p.size, flutter, petalColor);
  });

  if (!sakuraPollen.length) initSakuraPollen();

  sakuraPollen.forEach((p) => {
    const angle =
      time * 0.5 + p.baseAngle + Math.sin(time * 0.7 + p.phase) * 0.14;
    const currentR = R + (p.baseR - 66) + Math.sin(time * 1.3 + p.phase) * 3.5;

    const x = Cx + currentR * Math.cos(angle);
    const y = Cy + currentR * Math.sin(angle);

    ctx.save();
    ctx.globalAlpha =
      p.opacity * (0.55 + Math.sin(time * p.twinkleSpeed + angle * 2.0) * 0.45);
    ctx.fillStyle = colors[2] || '#ffffff';
    ctx.shadowColor = colors[1] || '#ffb8d9';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}

function drawSakuraPetal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  color: string,
  strokeColor?: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.0;
  }
  ctx.shadowColor = 'rgba(255, 148, 194, 0.45)';
  ctx.shadowBlur = 4;
  ctx.beginPath();

  ctx.moveTo(0, size * 0.7);
  ctx.bezierCurveTo(
    -size * 0.65,
    size * 0.25,
    -size * 0.55,
    -size * 0.65,
    -size * 0.22,
    -size,
  );
  ctx.quadraticCurveTo(0, -size * 0.75, size * 0.22, -size);
  ctx.bezierCurveTo(
    size * 0.55,
    -size * 0.65,
    size * 0.65,
    size * 0.25,
    0,
    size * 0.7,
  );
  ctx.closePath();
  ctx.fill();
  if (strokeColor) ctx.stroke();
  ctx.restore();
}
