import type { IUser, IUserStats } from '../types';
import type { ThemeColors } from '../hooks/useThemeColors';

export type StatsCardFormat = 'portrait' | 'square';
export type StatsCardStyle = 'classic' | 'aurora' | 'constellations';

export interface StatsCardDesign {
  format: StatsCardFormat;
  style: StatsCardStyle;
  accent: string;
  caption: string;
  showBanner: boolean;
  showBadge: boolean;
}

export const DEFAULT_STATS_CARD_DESIGN: StatsCardDesign = {
  format: 'portrait',
  style: 'classic',
  accent: '',
  caption: '',
  showBanner: false,
  showBadge: true,
};

export function canCustomizeStatsCard(
  user?: Pick<IUser, 'roles' | 'patreon'> | null
) {
  return Boolean(
    user?.roles?.includes('admin') ||
      (user?.patreon?.isActive && user.patreon.tier)
  );
}

export function normalizeStatsCardDesign(
  design: Partial<StatsCardDesign>,
  supporter: boolean
): StatsCardDesign {
  return {
    format: design.format === 'square' ? 'square' : 'portrait',
    style:
      supporter &&
      (design.style === 'aurora' || design.style === 'constellations')
        ? design.style
        : 'classic',
    accent:
      supporter && /^#[\da-f]{6}$/i.test(design.accent ?? '')
        ? design.accent!
        : '',
    caption: supporter ? (design.caption ?? '').trim().slice(0, 60) : '',
    showBanner: supporter && Boolean(design.showBanner),
    showBadge: design.showBadge !== false,
  };
}

export interface StatsCardLabels {
  heading: string;
  hours: string;
  reading: string;
  listening: string;
  dailyAverage: string;
  characters: string;
  streak: string;
  days: string;
  logs: string;
  supporter: string;
}

export interface StatsCardData {
  user: Pick<IUser, 'username' | 'avatar' | 'banner' | 'patreon'>;
  stats: Pick<IUserStats, 'totals' | 'streaks'>;
  dateLabel: string;
  labels: StatsCardLabels;
  locale: string;
  colors: ThemeColors;
  design: StatsCardDesign;
}

type CardAssets = {
  avatar?: CanvasImageSource | null;
  banner?: CanvasImageSource | null;
  logo?: CanvasImageSource | null;
};
type Context = CanvasRenderingContext2D;

export function statsCardSize(format: StatsCardFormat) {
  return { width: 720, height: format === 'square' ? 720 : 900, scale: 1.5 };
}

const safeNumber = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

function box(
  ctx: Context,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 20
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function text(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  maxWidth = 640,
  weight = 600
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Inter Variable", Inter, sans-serif`;
  const letters = Array.from(value);
  while (letters.length && ctx.measureText(letters.join('')).width > maxWidth)
    letters.pop();
  const fitted =
    letters.length < Array.from(value).length
      ? `${letters.slice(0, -1).join('')}…`
      : value;
  ctx.fillText(fitted, x, y);
}

function valueText(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  maxSize: number,
  color: string,
  width: number
) {
  let size = maxSize;
  while (size > 20) {
    ctx.font = `700 ${size}px "Inter Variable", Inter, sans-serif`;
    if (ctx.measureText(value).width <= width) break;
    size -= 2;
  }
  text(ctx, value, x, y, size, color, width, 700);
}

function cover(
  ctx: Context,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const asset = image as HTMLImageElement;
  const iw = asset.naturalWidth || Number(asset.width);
  const ih = asset.naturalHeight || Number(asset.height);
  const scale = Math.max(w / iw, h / ih);
  ctx.drawImage(
    image,
    x + (w - iw * scale) / 2,
    y + (h - ih * scale) / 2,
    iw * scale,
    ih * scale
  );
}

export function drawStatsCard(
  ctx: Context,
  data: StatsCardData,
  assets: CardAssets = {}
) {
  const { colors: c, labels: l, design: d, user, stats } = data;
  const { width: w, height: h } = statsCardSize(d.format);
  const square = d.format === 'square';
  const accent = d.accent || c.primary;
  const number = (n: number, digits = 1) =>
    new Intl.NumberFormat(data.locale, {
      maximumFractionDigits: digits,
    }).format(safeNumber(n));
  const compact = (n: number) =>
    new Intl.NumberFormat(data.locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(safeNumber(n));
  const hours = (n: number) => `${number(n)} h`;

  ctx.fillStyle = c.base100;
  ctx.fillRect(0, 0, w, h);
  if (d.showBanner && assets.banner) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    cover(ctx, assets.banner, 0, 0, w, 420);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, 0, 0, 420);
    fade.addColorStop(0, 'transparent');
    fade.addColorStop(1, c.base100);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, 420);
  }
  if (d.style === 'aurora') {
    ctx.save();
    ctx.globalAlpha = 0.13;
    const glow = ctx.createRadialGradient(w, 0, 0, w, 0, w);
    glow.addColorStop(0, accent);
    glow.addColorStop(0.55, c.secondary);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else if (d.style === 'constellations') {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    const points = [
      [478, 84],
      [570, 38],
      [662, 106],
      [608, 190],
      [694, 270],
    ];
    points.forEach(([x, y], index) => {
      if (index) {
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.moveTo(...(points[index - 1] as [number, number]));
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  if (assets.logo) ctx.drawImage(assets.logo, 40, 34, 30, 30);
  text(ctx, 'NihongoTracker', assets.logo ? 80 : 40, 56, 20, c.baseContent);
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.textAlign = 'right';
  text(
    ctx,
    square && d.caption ? d.caption : l.heading,
    680,
    56,
    14,
    c.baseContent,
    320
  );
  ctx.restore();

  const avatarY = square ? 132 : 140;
  ctx.save();
  ctx.beginPath();
  ctx.arc(78, avatarY, 38, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = c.base200;
  ctx.fillRect(40, avatarY - 38, 76, 76);
  if (assets.avatar) cover(ctx, assets.avatar, 40, avatarY - 38, 76, 76);
  else {
    ctx.textAlign = 'center';
    text(
      ctx,
      Array.from(user.username).slice(0, 2).join('').toUpperCase(),
      78,
      avatarY + 10,
      26,
      accent,
      70
    );
  }
  ctx.restore();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(78, avatarY, 39, 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, user.username, 138, avatarY - 4, 30, c.baseContent, 410, 700);
  ctx.save();
  ctx.globalAlpha = 0.65;
  text(ctx, data.dateLabel, 138, avatarY + 26, 16, c.baseContent, 530, 400);
  ctx.restore();
  if (
    d.showBadge &&
    user.patreon?.isActive &&
    user.patreon.tier &&
    !user.patreon?.hideBadge
  ) {
    ctx.save();
    ctx.textAlign = 'right';
    text(ctx, `♥ ${l.supporter}`, 680, avatarY - 5, 13, accent, 120);
    ctx.restore();
  }

  const heroY = square ? 196 : 218;
  const heroH = square ? 132 : 160;
  ctx.fillStyle = c.base200;
  box(ctx, 40, heroY, 640, heroH, 24);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.55;
  text(
    ctx,
    l.hours.toLocaleUpperCase(data.locale),
    64,
    heroY + 34,
    13,
    c.baseContent
  );
  ctx.restore();
  valueText(
    ctx,
    hours(stats.totals.totalTimeHours),
    64,
    heroY + (square ? 103 : 117),
    square ? 64 : 78,
    accent,
    592
  );
  if (!square && d.caption) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    text(ctx, d.caption, 64, heroY + 144, 14, c.baseContent, 592, 400);
    ctx.restore();
  }

  const balanceY = heroY + heroH + 26;
  const barY = balanceY + 12;
  const reading = safeNumber(stats.totals.readingHours);
  const listening = safeNumber(stats.totals.listeningHours);
  const split = reading + listening ? reading / (reading + listening) : 0;
  ctx.save();
  box(ctx, 40, barY, 640, 10, 5);
  ctx.clip();
  ctx.fillStyle = c.base300;
  ctx.fillRect(40, barY, 640, 10);
  if (reading + listening) {
    ctx.fillStyle = c.secondary;
    ctx.fillRect(40, barY, 640, 10);
    ctx.fillStyle = accent;
    ctx.fillRect(40, barY, 640 * split, 10);
  }
  ctx.restore();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(45, barY + 40, 4, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, l.reading, 58, barY + 46, 15, c.baseContent, 270, 400);
  ctx.fillStyle = c.secondary;
  ctx.beginPath();
  ctx.arc(379, barY + 40, 4, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, l.listening, 392, barY + 46, 15, c.baseContent, 270, 400);
  valueText(ctx, hours(reading), 40, barY + 82, 30, c.baseContent, 290);
  valueText(ctx, hours(listening), 374, barY + 82, 30, c.baseContent, 290);

  const gridY = barY + 112;
  const tileH = square ? 74 : 120;
  const metrics = [
    [l.dailyAverage, `${number(stats.totals.dailyAverageHours, 2)} h`],
    [l.characters, compact(stats.totals.totalChars)],
    [l.streak, `${number(stats.streaks.currentStreak, 0)} ${l.days}`],
    [l.logs, number(stats.totals.totalLogs, 0)],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 40 + (index % 2) * 330;
    const y = gridY + Math.floor(index / 2) * (tileH + 14);
    ctx.fillStyle = c.base200;
    box(ctx, x, y, 310, tileH, 18);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.6;
    text(ctx, label, x + 20, y + 26, 13, c.baseContent, 270, 400);
    ctx.restore();
    valueText(
      ctx,
      value,
      x + 20,
      y + tileH - 17,
      square ? 26 : 34,
      c.baseContent,
      270
    );
  });

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = c.baseContent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, h - 62);
  ctx.lineTo(680, h - 62);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.65;
  text(ctx, 'nihongotracker.app', 40, h - 32, 14, c.baseContent, 280, 400);
  ctx.textAlign = 'right';
  text(ctx, `@${user.username}`, 680, h - 32, 14, c.baseContent, 300, 400);
  ctx.restore();
}

function loadCardImage(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => finish(null), 3000);
    const finish = (result: HTMLImageElement | null) => {
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    };
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

export async function generateStatsCard(data: StatsCardData): Promise<Blob> {
  const [avatar, banner, logo] = await Promise.all([
    loadCardImage(data.user.avatar),
    loadCardImage(data.design.showBanner ? data.user.banner : undefined),
    loadCardImage('/favicon.png'),
  ]);
  const canvas = document.createElement('canvas');
  const { width, height, scale } = statsCardSize(data.design.format);
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.scale(scale, scale);
  drawStatsCard(ctx, data, { avatar, banner, logo });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))),
      'image/png'
    )
  );
}
