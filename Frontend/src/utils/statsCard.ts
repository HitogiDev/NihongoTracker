import type { IUser, IUserStats, IUserStatsTopMedia } from '../types';
import type { ThemeColors } from '../hooks/useThemeColors';
import { getCardImageFn } from '../api/trackerApi';
import { getMediaTypeColor } from '../constants/mediaColors';

export type StatsCardFormat = 'portrait' | 'square' | 'story';
export type StatsCardStyle =
  | 'classic'
  | 'seigaiha'
  | 'nightSky'
  | 'sakura'
  | 'halftone';
export type StatsCardPalette = 'theme' | 'midnight' | 'paper';
export type StatsCardTitleLanguage = 'native' | 'romaji' | 'english';

export const STATS_CARD_STYLES: StatsCardStyle[] = [
  'classic',
  'seigaiha',
  'nightSky',
  'sakura',
  'halftone',
];
export const STATS_CARD_PALETTES: StatsCardPalette[] = [
  'theme',
  'midnight',
  'paper',
];

export interface StatsCardDesign {
  format: StatsCardFormat;
  style: StatsCardStyle;
  palette: StatsCardPalette;
  accent: string;
  caption: string;
  showBanner: boolean;
  showBadge: boolean;
  showTopMedia: boolean;
  topMediaCount: number;
  titleLanguage: StatsCardTitleLanguage;
}

export const DEFAULT_STATS_CARD_DESIGN: StatsCardDesign = {
  format: 'portrait',
  style: 'classic',
  palette: 'theme',
  accent: '',
  caption: '',
  showBanner: false,
  showBadge: true,
  showTopMedia: true,
  topMediaCount: 3,
  titleLanguage: 'native',
};

const MAX_TOP_MEDIA: Record<StatsCardFormat, number> = {
  square: 3,
  portrait: 4,
  story: 5,
};

export function maxTopMedia(format: StatsCardFormat) {
  return MAX_TOP_MEDIA[format];
}

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
  const format: StatsCardFormat =
    design.format === 'square' || design.format === 'story'
      ? design.format
      : 'portrait';
  const count = Math.trunc(Number(design.topMediaCount) || 0);
  return {
    format,
    style:
      supporter && STATS_CARD_STYLES.includes(design.style as StatsCardStyle)
        ? design.style!
        : 'classic',
    palette:
      supporter &&
      STATS_CARD_PALETTES.includes(design.palette as StatsCardPalette)
        ? design.palette!
        : 'theme',
    accent:
      supporter && /^#[\da-f]{6}$/i.test(design.accent ?? '')
        ? design.accent!
        : '',
    caption: supporter ? (design.caption ?? '').trim().slice(0, 60) : '',
    showBanner: supporter && Boolean(design.showBanner),
    showBadge: design.showBadge !== false,
    showTopMedia: design.showTopMedia !== false,
    topMediaCount: Math.min(MAX_TOP_MEDIA[format], Math.max(1, count || 3)),
    titleLanguage:
      design.titleLanguage === 'romaji' || design.titleLanguage === 'english'
        ? design.titleLanguage
        : 'native',
  };
}

export interface StatsCardLabels {
  heading: string;
  hours: string;
  total: string;
  reading: string;
  listening: string;
  dailyAverage: string;
  characters: string;
  charsUnit: string;
  episodesUnit: string;
  streak: string;
  days: string;
  logs: string;
  supporter: string;
  topMedia: string;
  mediaTypes: Record<string, string>;
}

export interface StatsCardData {
  user: Pick<IUser, 'username' | 'avatar' | 'banner' | 'patreon'>;
  stats: Pick<IUserStats, 'totals' | 'streaks' | 'topMedia'>;
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
  covers?: Array<CanvasImageSource | null>;
};
type Context = CanvasRenderingContext2D;
type Palette = Pick<
  ThemeColors,
  'base100' | 'base200' | 'base300' | 'baseContent' | 'secondary'
>;

const FONT =
  '"Inter Variable", Inter, "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif';
const WIDTH = 720;
const PAD = 40;
const INNER = WIDTH - PAD * 2;

const FIXED_PALETTES: Record<Exclude<StatsCardPalette, 'theme'>, Palette> = {
  midnight: {
    base100: '#0e141c',
    base200: '#17202b',
    base300: '#283443',
    baseContent: '#e6edf5',
    secondary: '#8b9cf7',
  },
  paper: {
    base100: '#faf7f2',
    base200: '#f0ebe2',
    base300: '#ddd5c8',
    baseContent: '#2a241d',
    secondary: '#c98a5a',
  },
};

const SAKURA_PETALS = ['#f8b4cb', '#f49ac1', '#fbd0e0', '#f7a8c4'];

export function statsCardSize(format: StatsCardFormat) {
  const height = format === 'square' ? 720 : format === 'story' ? 1280 : 900;
  return { width: WIDTH, height, scale: 1.5 };
}

const safeNumber = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

let colorProbe: CanvasRenderingContext2D | null | undefined;
const colorCache = new Map<string, [number, number, number]>();

// Theme colors can use oklch, so the browser resolves them to RGB.
function toRgb(color: string): [number, number, number] {
  const cached = colorCache.get(color);
  if (cached) return cached;
  if (colorProbe === undefined) {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    colorProbe = probe.getContext('2d', { willReadFrequently: true });
  }
  let rgb: [number, number, number] = [128, 128, 128];
  if (colorProbe) {
    colorProbe.clearRect(0, 0, 1, 1);
    colorProbe.fillStyle = '#808080';
    colorProbe.fillStyle = color;
    colorProbe.fillRect(0, 0, 1, 1);
    const [r, g, b] = colorProbe.getImageData(0, 0, 1, 1).data;
    rgb = [r, g, b];
  }
  colorCache.set(color, rgb);
  return rgb;
}

function withAlpha(color: string, alpha: number) {
  const [r, g, b] = toRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function readableOn(color: string) {
  const [r, g, b] = toRgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#14110f' : '#ffffff';
}

function seededRandom(seed: string) {
  let state = 2166136261;
  for (const char of seed)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

function setFont(ctx: Context, size: number, weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

function setTracking(ctx: Context, value: string) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = value;
}

function fit(ctx: Context, value: string, maxWidth: number) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  const letters = Array.from(value);
  while (
    letters.length &&
    ctx.measureText(`${letters.join('')}…`).width > maxWidth
  )
    letters.pop();
  return `${letters.join('')}…`;
}

function text(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  maxWidth = INNER,
  weight = 600
) {
  ctx.fillStyle = color;
  setFont(ctx, size, weight);
  const fitted = fit(ctx, value, maxWidth);
  ctx.fillText(fitted, x, y);
  return ctx.measureText(fitted).width;
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
  while (size > 16) {
    setFont(ctx, size, 700);
    if (ctx.measureText(value).width <= width) break;
    size -= 2;
  }
  return text(ctx, value, x, y, size, color, width, 700);
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
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  ctx.drawImage(
    image,
    x + (w - iw * scale) / 2,
    y + (h - ih * scale) / 2,
    iw * scale,
    ih * scale
  );
}

// Downscale and upscale instead of ctx.filter, which some Safari versions ignore.
function blurredCover(
  ctx: Context,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const small = document.createElement('canvas');
  small.width = 6;
  small.height = Math.max(1, Math.round((6 * h) / w));
  const smallCtx = small.getContext('2d');
  if (!smallCtx) return;
  cover(smallCtx, image, 0, 0, small.width, small.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, x, y, w, h);
  ctx.restore();
}

function heart(ctx: Context, x: number, y: number, size: number) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(
    x - s * 1.4,
    y - s * 0.1,
    x - s * 0.7,
    y - s * 1.2,
    x,
    y - s * 0.45
  );
  ctx.bezierCurveTo(
    x + s * 0.7,
    y - s * 1.2,
    x + s * 1.4,
    y - s * 0.1,
    x,
    y + s * 0.9
  );
  ctx.fill();
}

function sparkle(ctx: Context, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y);
  ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.fill();
}

function petal(ctx: Context, size: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    -0.55 * size,
    -0.25 * size,
    -0.5 * size,
    -0.85 * size,
    -0.14 * size,
    -size
  );
  ctx.lineTo(0, -0.86 * size);
  ctx.lineTo(0.14 * size, -size);
  ctx.bezierCurveTo(0.5 * size, -0.85 * size, 0.55 * size, -0.25 * size, 0, 0);
  ctx.fill();
}

function drawSeigaiha(
  ctx: Context,
  p: Palette,
  accent: string,
  w: number,
  h: number
) {
  const radius = 34;
  ctx.save();
  ctx.lineWidth = 1.5;
  for (let row = 0, y = 0; y < h + radius; row += 1, y += radius / 2) {
    const offset = row % 2 ? radius : 0;
    for (let x = -radius + offset; x < w + radius; x += radius * 2) {
      ctx.fillStyle = p.base100;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(accent, 0.2);
      for (const factor of [1, 0.74, 0.48, 0.22]) {
        ctx.beginPath();
        ctx.arc(x, y, radius * factor, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  const fade = ctx.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, withAlpha(p.base100, 1));
  fade.addColorStop(0.35, withAlpha(p.base100, 0.92));
  fade.addColorStop(1, withAlpha(p.base100, 0.2));
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawNightSky(
  ctx: Context,
  p: Palette,
  accent: string,
  w: number,
  h: number,
  seed: string
) {
  const random = seededRandom(`${seed}:sky`);
  ctx.save();
  for (let i = 0; i < 180; i += 1) {
    const x = random() * w;
    const y = random() ** 1.5 * h;
    const r = 0.45 + random() ** 3 * 1.5;
    ctx.globalAlpha = 0.18 + random() * 0.6 * (1 - y / h / 1.6);
    ctx.fillStyle = random() < 0.25 ? accent : p.baseContent;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A dense diagonal band of faint stars suggests the Milky Way without a gradient.
  for (let i = 0; i < 260; i += 1) {
    const t = random();
    const spread = (random() + random() + random() - 1.5) * 70;
    const x = t * w + spread * 0.5;
    const y = h * 0.62 - t * h * 0.55 + spread;
    ctx.globalAlpha = 0.08 + random() * 0.28;
    ctx.fillStyle = random() < 0.4 ? accent : p.baseContent;
    ctx.beginPath();
    ctx.arc(x, y, 0.35 + random() * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  for (let i = 0; i < 9; i += 1) {
    const x = PAD / 2 + random() * (w - PAD);
    const y = 20 + random() ** 1.3 * h * 0.85;
    const size = 4 + random() * 7;
    ctx.globalAlpha = 0.55 + random() * 0.35;
    ctx.shadowBlur = size * 1.6;
    sparkle(ctx, x, y, size);
  }
  ctx.restore();
}

function drawSakura(ctx: Context, w: number, h: number, seed: string) {
  const random = seededRandom(`${seed}:sakura`);
  ctx.save();
  for (let i = 0; i < 30; i += 1) {
    // Petals gather near the top right and bottom left corners.
    const corner = random() < 0.6;
    const x = corner
      ? w - random() ** 1.8 * w * 0.7
      : random() ** 1.8 * w * 0.6;
    const y = corner
      ? random() ** 1.6 * h * 0.6
      : h - random() ** 1.6 * h * 0.55;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(random() * Math.PI * 2);
    ctx.globalAlpha = 0.22 + random() * 0.4;
    ctx.fillStyle = SAKURA_PETALS[Math.floor(random() * SAKURA_PETALS.length)];
    petal(ctx, 11 + random() ** 2 * 20);
    ctx.restore();
  }
  ctx.restore();
}

function drawHalftone(ctx: Context, accent: string, w: number, h: number) {
  const step = 18;
  const reach = Math.hypot(w, h) * 0.62;
  ctx.save();
  ctx.fillStyle = withAlpha(accent, 0.32);
  // Keep the footer text clear of dots.
  for (let y = step / 2; y < h - 76; y += step) {
    for (let x = step / 2; x < w; x += step) {
      const fromTop = 1 - Math.hypot(w - x, y) / reach;
      const fromBottom = 1 - Math.hypot(x, h - y) / (reach * 0.55);
      const strength = Math.max(fromTop, fromBottom);
      if (strength <= 0) continue;
      ctx.beginPath();
      ctx.arc(x, y, strength * step * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function mediaTitle(
  item: IUserStatsTopMedia,
  language: StatsCardTitleLanguage
) {
  const title = item.title;
  const native = title?.contentTitleNative;
  const romaji = title?.contentTitleRomaji;
  const english = title?.contentTitleEnglish;
  const order =
    language === 'english'
      ? [english, romaji, native]
      : language === 'romaji'
        ? [romaji, english, native]
        : [native, romaji, english];
  return order.find((value) => value?.trim()) ?? item.mediaId;
}

function supporterTierLabel(
  tier: NonNullable<IUser['patreon']>['tier'],
  fallback: string
) {
  if (tier === 'consumer') return 'Avid Consumer';
  if (tier === 'enthusiast') return 'Immersion Enthusiast';
  if (tier === 'donator') return 'Donator';
  return fallback;
}

export function drawStatsCard(
  ctx: Context,
  data: StatsCardData,
  assets: CardAssets = {}
) {
  const { labels: l, design: d, user, stats } = data;
  const p: Palette =
    d.palette === 'theme' ? data.colors : FIXED_PALETTES[d.palette];
  const { width: w, height: h } = statsCardSize(d.format);
  const square = d.format === 'square';
  const story = d.format === 'story';
  const accent = d.accent || data.colors.primary;
  const decorated = d.style !== 'classic';
  const tileFill = decorated ? withAlpha(p.base200, 0.88) : p.base200;
  const tileStroke = withAlpha(p.baseContent, 0.07);
  const muted = withAlpha(p.baseContent, 0.62);
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
  const tile = (x: number, y: number, tw: number, th: number, radius = 18) => {
    ctx.fillStyle = tileFill;
    box(ctx, x, y, tw, th, radius);
    ctx.fill();
    ctx.strokeStyle = tileStroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  const label = (
    value: string,
    x: number,
    y: number,
    size = 13,
    maxWidth = INNER
  ) => {
    ctx.save();
    setTracking(ctx, '1.5px');
    text(
      ctx,
      value.toLocaleUpperCase(data.locale),
      x,
      y,
      size,
      muted,
      maxWidth,
      700
    );
    ctx.restore();
  };

  ctx.fillStyle = p.base100;
  ctx.fillRect(0, 0, w, h);
  if (d.style === 'seigaiha') drawSeigaiha(ctx, p, accent, w, h);
  else if (d.style === 'nightSky')
    drawNightSky(ctx, p, accent, w, h, user.username);
  else if (d.style === 'sakura') drawSakura(ctx, w, h, user.username);
  else if (d.style === 'halftone') drawHalftone(ctx, accent, w, h);

  const top = story ? 70 : 0;
  const avatarSize = square ? 96 : 112;
  const avatarY = 92 + top;
  const profileBottom = avatarY + avatarSize;
  const withBanner = d.showBanner && Boolean(assets.banner);

  if (withBanner && assets.banner) {
    const bannerH = profileBottom + 24;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, bannerH);
    ctx.clip();
    cover(ctx, assets.banner, 0, 0, w, bannerH);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, 0, 0, bannerH);
    fade.addColorStop(0, withAlpha(p.base100, 0.15));
    fade.addColorStop(0.5, withAlpha(p.base100, 0.4));
    fade.addColorStop(1, withAlpha(p.base100, 1));
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, bannerH);
  }

  ctx.save();
  if (withBanner) {
    ctx.shadowColor = withAlpha(p.base100, 0.9);
    ctx.shadowBlur = 10;
  }
  if (assets.logo) ctx.drawImage(assets.logo, PAD, 34 + top, 30, 30);
  text(
    ctx,
    'NihongoTracker',
    assets.logo ? 80 : PAD,
    56 + top,
    20,
    p.baseContent
  );
  ctx.textAlign = 'right';
  text(ctx, l.heading, w - PAD, 56 + top, 14, muted, 300, 500);
  ctx.restore();

  const supporterBadge =
    d.showBadge &&
    Boolean(user.patreon?.isActive && user.patreon.tier) &&
    !user.patreon?.hideBadge;
  const avatarCx = PAD + avatarSize / 2;
  const avatarCy = avatarY + avatarSize / 2;
  ctx.save();
  ctx.fillStyle = p.base100;
  if (supporterBadge) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 22;
  }
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarSize / 2 + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = p.base300;
  ctx.fillRect(PAD, avatarY, avatarSize, avatarSize);
  if (assets.avatar)
    cover(ctx, assets.avatar, PAD, avatarY, avatarSize, avatarSize);
  else {
    ctx.textAlign = 'center';
    text(
      ctx,
      Array.from(user.username).slice(0, 2).join('').toUpperCase(),
      avatarCx,
      avatarCy + 12,
      34,
      accent,
      avatarSize
    );
  }
  ctx.restore();
  ctx.strokeStyle = accent;
  ctx.lineWidth = supporterBadge ? 4 : 3;
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarSize / 2 + 3, 0, Math.PI * 2);
  ctx.stroke();

  const infoX = PAD + avatarSize + 26;
  const infoWidth = w - PAD - infoX;
  const hasCaption = Boolean(d.caption);
  const shift = hasCaption ? 0 : 14;
  ctx.save();
  if (withBanner) {
    ctx.shadowColor = withAlpha(p.base100, 0.9);
    ctx.shadowBlur = 10;
  }
  ctx.save();
  setTracking(ctx, '1.5px');
  text(
    ctx,
    data.dateLabel.toLocaleUpperCase(data.locale),
    infoX,
    avatarCy - 28 + shift,
    13,
    accent,
    infoWidth,
    700
  );
  ctx.restore();

  let badgeWidth = 0;
  let badgeLabel = '';
  if (supporterBadge) {
    badgeLabel = supporterTierLabel(user.patreon?.tier ?? null, l.supporter);
    setFont(ctx, 14, 700);
    badgeWidth = Math.min(220, ctx.measureText(badgeLabel).width + 50);
  }
  const nameY = avatarCy + 10 + shift;
  const nameWidth = text(
    ctx,
    user.username,
    infoX,
    nameY,
    36,
    p.baseContent,
    infoWidth - (badgeWidth ? badgeWidth + 14 : 0),
    800
  );
  if (hasCaption) {
    text(
      ctx,
      `“${d.caption}”`,
      infoX,
      avatarCy + 42,
      16,
      muted,
      infoWidth,
      500
    );
  }
  ctx.restore();

  if (supporterBadge) {
    const bx = infoX + nameWidth + 14;
    const by = nameY - 24;
    ctx.save();
    ctx.shadowColor = withAlpha(accent, 0.55);
    ctx.shadowBlur = 14;
    ctx.fillStyle = accent;
    box(ctx, bx, by, badgeWidth, 30, 15);
    ctx.fill();
    ctx.restore();
    const ink = readableOn(accent);
    ctx.fillStyle = ink;
    heart(ctx, bx + 19, by + 15, 14);
    text(ctx, badgeLabel, bx + 32, by + 20, 14, ink, badgeWidth - 44, 700);
  }

  const totals = stats.totals;
  const reading = safeNumber(totals.readingHours);
  const listening = safeNumber(totals.listeningHours);
  const topMedia = d.showTopMedia
    ? (stats.topMedia ?? []).slice(0, d.topMediaCount)
    : [];
  const footerTop = h - 62;

  // Center the label and the value as one block. Cap height is about 0.72 of the font size.
  const stacked = (
    y: number,
    height: number,
    valueSize: number,
    gap: number
  ) => {
    const blockH = 10 + gap + valueSize * 0.72;
    const top = y + (height - blockH) / 2;
    return { labelY: top + 10, valueY: top + blockH };
  };
  const hero = (y: number, height: number, valueSize: number) => {
    tile(PAD, y, INNER, height, 24);
    ctx.fillStyle = accent;
    box(ctx, PAD, y + 24, 5, height - 48, 3);
    ctx.fill();
    const { labelY, valueY } = stacked(y, height, valueSize, 22);
    label(l.hours, PAD + 28, labelY);
    valueText(
      ctx,
      hours(totals.totalTimeHours),
      PAD + 28,
      valueY,
      valueSize,
      accent,
      INNER - 56
    );
  };

  if (!topMedia.length) {
    const heroY = profileBottom + 30;
    const heroH = square ? 120 : story ? 260 : 168;
    hero(heroY, heroH, square ? 62 : story ? 118 : 86);

    const barY = heroY + heroH + 30;
    const split = reading + listening ? reading / (reading + listening) : 0;
    ctx.save();
    box(ctx, PAD, barY, INNER, 10, 5);
    ctx.clip();
    ctx.fillStyle = withAlpha(p.baseContent, 0.1);
    ctx.fillRect(PAD, barY, INNER, 10);
    if (reading + listening) {
      ctx.fillStyle = p.secondary;
      ctx.fillRect(PAD, barY, INNER, 10);
      ctx.fillStyle = accent;
      ctx.fillRect(PAD, barY, INNER * split, 10);
    }
    ctx.restore();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(PAD + 5, barY + 40, 5, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, l.reading, PAD + 18, barY + 46, 15, muted, 270, 500);
    ctx.fillStyle = p.secondary;
    ctx.beginPath();
    ctx.arc(379, barY + 40, 5, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, l.listening, 392, barY + 46, 15, muted, 270, 500);
    valueText(ctx, hours(reading), PAD, barY + 82, 30, p.baseContent, 290);
    valueText(ctx, hours(listening), 374, barY + 82, 30, p.baseContent, 290);

    const gridY = barY + 112;
    const tileH = square ? 74 : story ? 200 : 112;
    const metrics = [
      [l.dailyAverage, `${number(totals.dailyAverageHours, 2)} h`],
      [l.characters, compact(totals.totalChars)],
      [l.streak, `${number(stats.streaks.currentStreak, 0)} ${l.days}`],
      [l.logs, number(totals.totalLogs, 0)],
    ];
    metrics.forEach(([name, value], index) => {
      const x = PAD + (index % 2) * 330;
      const y = gridY + Math.floor(index / 2) * (tileH + 14);
      const valueSize = square ? 26 : story ? 48 : 34;
      const { labelY, valueY } = stacked(y, tileH, valueSize, square ? 10 : 16);
      tile(x, y, 310, tileH);
      text(ctx, name, x + 20, labelY, 14, muted, 270, 500);
      valueText(ctx, value, x + 20, valueY, valueSize, p.baseContent, 270);
    });
  } else {
    let y = profileBottom + 30;
    if (story) {
      hero(y, 140, 74);
      y += 164;
    }
    const pills: Array<[string, string]> = story
      ? [
          [l.reading, hours(reading)],
          [l.listening, hours(listening)],
          [l.characters, compact(totals.totalChars)],
          [l.streak, `${number(stats.streaks.currentStreak, 0)} ${l.days}`],
        ]
      : [
          [l.total, hours(totals.totalTimeHours)],
          [l.characters, compact(totals.totalChars)],
          [l.reading, hours(reading)],
          [l.listening, hours(listening)],
          ...(!square && topMedia.length <= 3
            ? ([
                [
                  l.streak,
                  `${number(stats.streaks.currentStreak, 0)} ${l.days}`,
                ],
                [l.dailyAverage, `${number(totals.dailyAverageHours, 2)} h`],
              ] as Array<[string, string]>)
            : []),
        ];
    const pillW = (INNER - 12) / 2;
    pills.forEach(([name, value], index) => {
      const x = PAD + (index % 2) * (pillW + 12);
      const py = y + Math.floor(index / 2) * 64;
      tile(x, py, pillW, 52, 14);
      text(ctx, name, x + 18, py + 32, 15, muted, pillW * 0.5, 500);
      ctx.save();
      ctx.textAlign = 'right';
      valueText(
        ctx,
        value,
        x + pillW - 18,
        py + 34,
        20,
        index === 0 && !story ? accent : p.baseContent,
        pillW * 0.45
      );
      ctx.restore();
    });
    y += Math.ceil(pills.length / 2) * 64 - 12 + 40;
    label(l.topMedia, PAD, y);
    y += 18;

    const gap = 12;
    const available = footerTop - 20 - y;
    const rowH = Math.min(
      story ? 124 : 108,
      (available - gap * (topMedia.length - 1)) / topMedia.length
    );
    topMedia.forEach((item, index) => {
      const ry = y + index * (rowH + gap);
      const typeColor = getMediaTypeColor(item.type);
      const coverW = Math.round(rowH * 0.72);
      const title = mediaTitle(item, d.titleLanguage);
      tile(PAD, ry, INNER, rowH, 18);

      ctx.save();
      box(ctx, PAD, ry, INNER, rowH, 18);
      ctx.clip();
      const image = assets.covers?.[index];
      ctx.fillStyle = withAlpha(typeColor, 0.22);
      ctx.fillRect(PAD, ry, coverW, rowH);
      if (image) {
        // Wide covers scale to the row height, so keep them inside the cover column.
        ctx.beginPath();
        ctx.rect(PAD, ry, coverW, rowH);
        ctx.clip();
        if (item.isAdultImage) blurredCover(ctx, image, PAD, ry, coverW, rowH);
        else cover(ctx, image, PAD, ry, coverW, rowH);
      } else {
        ctx.textAlign = 'center';
        text(
          ctx,
          Array.from(title)[0] ?? '?',
          PAD + coverW / 2,
          ry + rowH / 2 + 12,
          32,
          typeColor,
          coverW,
          800
        );
      }
      ctx.restore();

      const rankSize = rowH < 90 ? 18 : 24;
      ctx.fillStyle = p.base100;
      box(ctx, PAD + 5, ry + 5, rankSize, rankSize, rankSize / 3);
      ctx.fill();
      ctx.save();
      ctx.textAlign = 'center';
      text(
        ctx,
        String(index + 1),
        PAD + 5 + rankSize / 2,
        ry + 5 + rankSize / 2 + rankSize * 0.2,
        rankSize * 0.54,
        accent,
        rankSize,
        800
      );
      ctx.restore();

      const typeLabel = l.mediaTypes[item.type] ?? item.type;
      setFont(ctx, 12, 800);
      const typeW = ctx.measureText(typeLabel).width + 20;
      const typeX = PAD + INNER - 16 - typeW;
      ctx.fillStyle = typeColor;
      box(ctx, typeX, ry + 14, typeW, 22, 7);
      ctx.fill();
      text(ctx, typeLabel, typeX + 10, ry + 29.5, 12, '#ffffff', typeW, 800);

      const contentX = PAD + coverW + 20;
      const titleSize = Math.max(15, Math.min(21, rowH * 0.2));
      const chipH = Math.max(20, Math.min(28, rowH * 0.26));
      const titleY = ry + Math.max(26, rowH * 0.4);
      text(
        ctx,
        title,
        contentX,
        titleY,
        titleSize,
        p.baseContent,
        typeX - contentX - 12,
        700
      );

      const chips: Array<[string, boolean]> = [];
      if (item.hours > 0) chips.push([hours(item.hours), true]);
      if (item.chars > 0)
        chips.push([`${compact(item.chars)} ${l.charsUnit}`, false]);
      else if (item.episodes > 0)
        chips.push([`${number(item.episodes, 0)} ${l.episodesUnit}`, false]);
      let chipX = contentX;
      const chipY = titleY + Math.max(8, rowH * 0.12);
      const chipFont = Math.max(12, chipH * 0.52);
      chips.forEach(([value, highlighted]) => {
        setFont(ctx, chipFont, 700);
        const chipW = ctx.measureText(value).width + 22;
        if (chipX + chipW > PAD + INNER - 12) return;
        ctx.fillStyle = highlighted
          ? withAlpha(accent, 0.16)
          : withAlpha(p.baseContent, 0.06);
        box(ctx, chipX, chipY, chipW, chipH, 8);
        ctx.fill();
        ctx.strokeStyle = highlighted
          ? withAlpha(accent, 0.45)
          : withAlpha(p.baseContent, 0.14);
        ctx.lineWidth = 1;
        ctx.stroke();
        text(
          ctx,
          value,
          chipX + 11,
          chipY + chipH / 2 + chipFont * 0.36,
          chipFont,
          highlighted ? accent : p.baseContent,
          chipW,
          700
        );
        chipX += chipW + 8;
      });
    });
  }

  ctx.save();
  ctx.strokeStyle = withAlpha(p.baseContent, 0.12);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, footerTop);
  ctx.lineTo(w - PAD, footerTop);
  ctx.stroke();
  ctx.restore();
  text(ctx, 'nihongotracker.app', PAD, h - 32, 14, muted, 280, 500);
  ctx.save();
  ctx.textAlign = 'right';
  text(ctx, `@${user.username}`, w - PAD, h - 32, 14, muted, 300, 500);
  ctx.restore();
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

function decodeImage(src: string, crossOrigin: boolean) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => finish(null), 6000);
    function finish(result: HTMLImageElement | null) {
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    }
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = src;
  });
}

// Remote hosts often omit CORS headers, which taints the canvas and blocks the PNG export.
// The backend proxy returns the same image as an authenticated blob.
async function fetchCardImage(url: string) {
  if (/^(blob|data):/.test(url)) return decodeImage(url, false);
  const resolved = new URL(url, window.location.href);
  if (resolved.origin === window.location.origin)
    return decodeImage(resolved.href, false);
  try {
    const blob = await getCardImageFn(resolved.href);
    const objectUrl = URL.createObjectURL(blob);
    const img = await decodeImage(objectUrl, false);
    URL.revokeObjectURL(objectUrl);
    if (img) return img;
  } catch {
    // Fall back to a direct CORS request for hosts outside the proxy allowlist.
  }
  return decodeImage(resolved.href, true);
}

export function loadCardImage(
  url?: string | null
): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  let pending = imageCache.get(url);
  if (!pending) {
    pending = fetchCardImage(url).catch(() => null);
    if (imageCache.size > 60) imageCache.clear();
    imageCache.set(url, pending);
    void pending.then((img) => {
      if (!img) imageCache.delete(url);
    });
  }
  return pending;
}

export async function generateStatsCard(data: StatsCardData): Promise<Blob> {
  const topMedia = data.design.showTopMedia
    ? (data.stats.topMedia ?? []).slice(0, data.design.topMediaCount)
    : [];
  const [avatar, banner, logo, ...covers] = await Promise.all([
    loadCardImage(data.user.avatar),
    loadCardImage(data.design.showBanner ? data.user.banner : undefined),
    loadCardImage('/favicon.png'),
    ...topMedia.map((item) => loadCardImage(item.image)),
  ]);
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const { width, height, scale } = statsCardSize(data.design.format);
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.scale(scale, scale);
  drawStatsCard(ctx, data, { avatar, banner, logo, covers });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))),
      'image/png'
    )
  );
}
