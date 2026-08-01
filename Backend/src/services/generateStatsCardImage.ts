import { createCanvas, loadImage, Image } from 'canvas';
import { IUser } from '../types.js';

export interface StatsCardTiles {
  timeSpentHours: number;
  dailyAvgHours: number;
  readingHours: number;
  listeningHours: number;
  chars: number;
  streakDays: number;
}

export interface StatsCardOptions {
  user: Pick<IUser, 'username' | 'avatar' | 'banner'>;
  dateLabel: string;
  tiles: StatsCardTiles;
}

// ── Canvas ────────────────────────────────────────────────────────────────────
// Layout is authored in logical units (W×H); the canvas is rendered at SCALE× the
// pixel density (2× => 1280×1920 output) so the shareable PNG stays crisp. All
// drawing below stays in logical coords — ctx.scale(SCALE) maps them to device px.
const W = 640;
const H = 960;
const PAD = 40;
const SCALE = 2;

// ── DaisyUI dark palette (matches generateOgImage.ts) ────────────────────────
const C_BASE100 = '#1d232a';
const C_BASE200 = '#12161b';
const C_CONTENT = '#ecf9ff';
const C_MUTED = '#a6adbb';
const C_PRIMARY = '#7480ff';
const C_SECONDARY = '#f43098';
const C_WARNING = '#ffbe00';
const C_ACCENT = '#00bfaa';
const C_SUCCESS = '#00a96e';

type IconKind =
  | 'clock'
  | 'stopwatch'
  | 'book'
  | 'headphones'
  | 'chars'
  | 'flame';

interface Tile {
  label: string;
  value: string;
  color: string;
  icon: IconKind;
}

function fmtHours(h: number, decimals = 1): string {
  const n = Number.isFinite(h) ? Math.max(0, h) : 0;
  const s = n.toFixed(decimals);
  // Trim trailing zeros / dot: 36.0 -> 36, 66.10 -> 66.1
  const trimmed = s.replace(/\.?0+$/, '');
  const [int, frac] = trimmed.split('.');
  const grouped = Number(int).toLocaleString('en-US');
  return `${frac ? `${grouped}.${frac}` : grouped} h`;
}

// Big counts are abbreviated (1,300,000 -> 1.3M) so the value never outgrows its
// tile. Precision shrinks as the magnitude grows: 1.01M, 12.3M, 123M.
function fmtCompact(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  const units: Array<{ limit: number; suffix: string }> = [
    { limit: 1e12, suffix: 'T' },
    { limit: 1e9, suffix: 'B' },
    { limit: 1e6, suffix: 'M' },
  ];
  for (const { limit, suffix } of units) {
    if (v < limit) continue;
    const scaled = v / limit;
    const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    // Trim trailing zeros / dot: 1.30 -> 1.3, 5.00 -> 5
    const s = scaled.toFixed(decimals).replace(/\.?0+$/, '');
    return `${s}${suffix}`;
  }
  return v.toLocaleString('en-US');
}

function buildTiles(t: StatsCardTiles): Tile[] {
  return [
    {
      label: 'TIME SPENT',
      value: fmtHours(t.timeSpentHours),
      color: C_SECONDARY,
      icon: 'clock',
    },
    {
      label: 'DAILY AVERAGE',
      value: fmtHours(t.dailyAvgHours, 2),
      color: C_SECONDARY,
      icon: 'stopwatch',
    },
    {
      label: 'READING TIME',
      value: fmtHours(t.readingHours),
      color: C_ACCENT,
      icon: 'book',
    },
    {
      label: 'LISTENING TIME',
      value: fmtHours(t.listeningHours),
      color: C_SUCCESS,
      icon: 'headphones',
    },
    {
      label: 'CHARACTERS READ',
      value: fmtCompact(t.chars),
      color: C_PRIMARY,
      icon: 'chars',
    },
    {
      label: 'CURRENT STREAK',
      value: `${Math.max(0, Math.round(t.streakDays) || 0)}d`,
      color: C_WARNING,
      icon: 'flame',
    },
  ];
}

export async function generateStatsCardImage(
  options: StatsCardOptions
): Promise<Buffer> {
  const { user, dateLabel, tiles } = options;
  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx = canvas.getContext('2d') as any;
  ctx.scale(SCALE, SCALE);

  // 1 ── Background + 日 watermark ─────────────────────────────────────────────
  drawFlatBg(ctx);

  // 2 ── Header: avatar + username + date range ───────────────────────────────
  const AV_R = 56;
  const AV_CX = PAD + AV_R;
  const AV_CY = 104;

  // Backing + fill disc
  ctx.save();
  ctx.beginPath();
  ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI * 2);
  ctx.fillStyle = C_BASE100;
  ctx.fill();
  ctx.restore();

  if (user.avatar) {
    try {
      const img = await loadImage(user.avatar);
      ctx.save();
      ctx.beginPath();
      ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, AV_CX - AV_R, AV_CY - AV_R, AV_R * 2, AV_R * 2);
      ctx.restore();
    } catch {
      drawInitials(ctx, user.username, AV_CX, AV_CY);
    }
  } else {
    drawInitials(ctx, user.username, AV_CX, AV_CY);
  }

  // Ring around avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI * 2);
  ctx.strokeStyle = C_PRIMARY;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  const textX = AV_CX + AV_R + 28;

  // Username
  ctx.save();
  ctx.fillStyle = C_CONTENT;
  ctx.font = 'bold 50px sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const maxNameW = W - textX - PAD;
  let displayName = user.username;
  while (ctx.measureText(displayName).width > maxNameW && displayName.length > 2) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== user.username) displayName += '…';
  ctx.fillText(displayName, textX, AV_CY - 4);
  ctx.restore();

  // Date range label
  ctx.save();
  ctx.fillStyle = C_MUTED;
  ctx.font = 'bold 22px sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(clampLabel(dateLabel), textX, AV_CY + 34);
  ctx.restore();

  // 3 ── Tiles grid (2 × 3) ────────────────────────────────────────────────────
  const list = buildTiles(tiles);
  const iconImages = await Promise.all(
    list.map((t) => loadIconImage(t.icon, t.color))
  );
  const GAP = 24;
  const gridTop = 220;
  const gridBottom = H - 96;
  const tileW = (W - 2 * PAD - GAP) / 2;
  const tileH = (gridBottom - gridTop - 2 * GAP) / 3;

  list.forEach((tile, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const tx = PAD + col * (tileW + GAP);
    const ty = gridTop + row * (tileH + GAP);

    // Tile background
    ctx.fillStyle = C_BASE100;
    rrect(ctx, tx, ty, tileW, tileH, 22);
    ctx.fill();

    // Icon badge
    const badge = 46;
    const bx = tx + 26;
    const by = ty + 26;
    ctx.fillStyle = withAlpha(tile.color, 0.16);
    rrect(ctx, bx, by, badge, badge, 13);
    ctx.fill();
    drawIcon(
      ctx,
      iconImages[i],
      tile.icon,
      bx + badge / 2,
      by + badge / 2,
      tile.color
    );

    // Label (right of badge)
    ctx.save();
    ctx.fillStyle = C_MUTED;
    ctx.font = 'bold 16px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(tile.label, bx + badge + 16, by + badge / 2 + 1);
    ctx.restore();

    // Value (big, coloured). Shrunk to fit the tile's inner width so an unusually
    // long value can never bleed past the tile edge.
    const valuePad = 28;
    ctx.save();
    ctx.fillStyle = tile.color;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    fitFont(ctx, tile.value, tileW - valuePad * 2, 48, 24);
    ctx.fillText(tile.value, tx + valuePad, ty + tileH - 32);
    ctx.restore();
  });

  // 4 ── Footer branding ───────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = C_MUTED;
  ctx.globalAlpha = 0.7;
  ctx.font = '20px sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillText(`nihongotracker.app/user/${user.username}`, W / 2, H - 40);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

// ── Icons ─────────────────────────────────────────────────────────────────────
// Exact lucide-react inner SVG (viewBox 0 0 24 24), matching the icons used on the
// Stats page: Clock3, Timer, BookOpen, Headphones, Flame. Rendered via librsvg
// (loadImage of an SVG buffer) so the shareable card mirrors the in-app tiles.
// 'chars' is drawn as the 字 glyph, matching the Stats "Characters Read" tile.
const ICON_SVG: Record<Exclude<IconKind, 'chars'>, string> = {
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6h4"/>',
  stopwatch:
    '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  headphones:
    '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  flame: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
};

// Preload a coloured lucide glyph as a raster Image (null for the text glyph).
async function loadIconImage(
  kind: IconKind,
  color: string
): Promise<Image | null> {
  if (kind === 'chars') return null;
  // Rasterize at SCALE× the logical box so the icon stays sharp once ctx.scale()
  // maps the 24-unit draw box to 24*SCALE device px.
  const px = 24 * SCALE;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${ICON_SVG[kind]}</svg>`;
  return loadImage(Buffer.from(svg));
}

// Draw a preloaded icon (or the 字 glyph) centred on (cx, cy).
function drawIcon(
  ctx: any,
  img: Image | null,
  kind: IconKind,
  cx: number,
  cy: number,
  color: string
): void {
  ctx.save();
  if (img) {
    const size = 24;
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  } else if (kind === 'chars') {
    ctx.fillStyle = color;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('字', cx, cy + 1);
  }
  ctx.restore();
}

// ── Flat dark background + 日 watermark (from generateOgImage.ts) ─────────────
function drawFlatBg(ctx: any): void {
  ctx.fillStyle = C_BASE200;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = C_CONTENT;
  ctx.font = 'bold 52px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const step = 115;
  for (let row = 0; row * step < H + step; row++) {
    const offset = (row % 2) * (step / 2);
    for (let col = 0; col * step < W + step; col++) {
      ctx.fillText('日', col * step + offset, row * step);
    }
  }
  ctx.restore();
}

function drawInitials(
  ctx: any,
  username: string,
  cx: number,
  cy: number
): void {
  const initials = (username || '?').slice(0, 2).toUpperCase();
  ctx.save();
  ctx.fillStyle = C_CONTENT;
  ctx.font = `bold ${initials.length === 1 ? 46 : 38}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(initials, cx, cy);
  ctx.restore();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rrect(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Set the largest bold size in [minPx, maxPx] whose rendered width fits maxWidth.
function fitFont(
  ctx: any,
  text: string,
  maxWidth: number,
  maxPx: number,
  minPx: number
): void {
  let size = maxPx;
  ctx.font = `bold ${size}px sans-serif`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `bold ${size}px sans-serif`;
  }
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clampLabel(label: string): string {
  const s = (label || '').trim();
  return s.length > 40 ? s.slice(0, 39) + '…' : s;
}
