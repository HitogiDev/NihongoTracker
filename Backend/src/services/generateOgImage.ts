import { createCanvas, loadImage } from 'canvas';
import { IUser } from '../types.js';

export interface ProfileOgImageOptions {
  user: Pick<IUser, 'username' | 'avatar' | 'banner' | 'stats'> | IUser;
}

// ── Canvas ────────────────────────────────────────────────────────────────────
const W = 1200;
const H = 630;
const SPLIT = 390; // y of the separator line (same as the reference layout)

// ── Avatar (straddles the divider line) ──────────────────────────────────────
const AV_R = 72;
const AV_CX = 116;
const AV_CY = SPLIT - 6;

// ── DaisyUI dark palette ─────────────────────────────────────────────────────
const C_BASE100 = '#1d232a';
const C_BASE200 = '#191e24';
const C_CONTENT = '#ecf9ff';
const C_MUTED = '#a6adbb';
const C_PRIMARY = '#7480ff';
const C_SECONDARY = '#f43098';
const C_WARNING = '#ffbe00';
const C_ACCENT = '#00bfaa';
const C_SUCCESS = '#00a96e';

function buildStats(user: ProfileOgImageOptions['user']) {
  return [
    { label: 'LEVEL', value: String(user.stats.userLevel), color: C_PRIMARY },
    { label: 'TOTAL XP', value: fmtNum(user.stats.userXp), color: C_SECONDARY },
    {
      label: 'STREAK',
      value: `${user.stats.currentStreak}d`,
      color: C_WARNING,
    },
    {
      label: 'READING LV',
      value: `Lv ${user.stats.readingLevel}`,
      color: C_ACCENT,
    },
    {
      label: 'LISTENING LV',
      value: `Lv ${user.stats.listeningLevel}`,
      color: C_SUCCESS,
    },
  ];
}

export async function generateProfileOgImage(
  options: ProfileOgImageOptions
): Promise<Buffer> {
  const { user } = options;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;

  // 1 ── Background ────────────────────────────────────────────────────────────
  if (user.banner) {
    try {
      const img = await loadImage(user.banner);
      const scale = Math.max(W / img.width, H / img.height);
      const bw = img.width * scale;
      const bh = img.height * scale;
      ctx.drawImage(img, (W - bw) / 2, (H - bh) / 2, bw, bh);

      // Dark overlay so name is readable over any banner
      ctx.fillStyle = 'rgba(25,30,36,0.72)';
      ctx.fillRect(0, 0, W, SPLIT);
    } catch {
      drawFlatBg(ctx);
    }
  } else {
    drawFlatBg(ctx);
  }

  // 2 ── Bottom panel (solid dark) ───────────────────────────────────────────
  ctx.fillStyle = C_BASE200;
  ctx.fillRect(0, SPLIT + 2, W, H - SPLIT - 2);

  // 3 ── Separator line (solid purple, full width) ───────────────────────────
  ctx.fillStyle = C_PRIMARY;
  ctx.fillRect(0, SPLIT, W, 2);

  // 4 ── Avatar (initials circle straddling the line) ────────────────────────
  // Backing disc to cover the line behind the circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(AV_CX, AV_CY, AV_R + 7, 0, Math.PI * 2);
  ctx.fillStyle = C_BASE200;
  ctx.fill();
  ctx.restore();

  // Circle fill
  ctx.save();
  ctx.beginPath();
  ctx.arc(AV_CX, AV_CY, AV_R, 0, Math.PI * 2);
  ctx.fillStyle = C_BASE100;
  ctx.fill();
  ctx.restore();

  // Avatar content: photo if available, initials as fallback
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
      // Fallback to initials if image fails to load
      drawInitials(ctx, user.username, AV_CX, AV_CY);
    }
  } else {
    drawInitials(ctx, user.username, AV_CX, AV_CY);
  }

  // 5 ── Username (baseline flush above the separator) ───────────────────────
  const nameX = AV_CX + AV_R + 32;
  const nameY = SPLIT - 21;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = C_CONTENT;
  ctx.font = 'bold 68px sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const maxNameW = W - nameX - 50;
  let displayName = user.username;
  while (
    ctx.measureText(displayName).width > maxNameW &&
    displayName.length > 2
  ) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== user.username) displayName += '…';
  ctx.fillText(displayName, nameX, nameY);
  ctx.restore();

  // 6 ── Stats row ───────────────────────────────────────────────────────────
  const stats = buildStats(user);
  const statStartX = AV_CX + AV_R * 2 + 40;
  const statAreaW = W - statStartX - 36;
  const colW = statAreaW / stats.length;

  stats.forEach((s, i) => {
    const cx = statStartX + i * colW + colW / 2;

    // Coloured accent bar
    const barW = colW * 0.55;
    ctx.fillStyle = s.color;
    rrect(ctx, cx - barW / 2, SPLIT + 30, barW, 3, 2);
    ctx.fill();

    // Value
    ctx.fillStyle = s.color;
    ctx.font = `bold ${s.value.length > 7 ? 40 : 50}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText(s.value, cx, SPLIT + 70);

    // Label
    ctx.fillStyle = C_MUTED;
    ctx.font = 'bold 17px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(s.label, cx, SPLIT + 128);
  });

  // 7 ── Branding ────────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.font = 'bold 20px sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.fillText('NihongoTracker', W - 28, H - 18);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

// ── Flat dark background + 日 watermark ──────────────────────────────────────
function drawFlatBg(ctx: any): void {
  ctx.fillStyle = C_BASE200;
  ctx.fillRect(0, 0, W, H);

  // 日 watermark pattern
  ctx.save();
  ctx.globalAlpha = 0.05;
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

// ── Initials fallback ─────────────────────────────────────────────────────────
function drawInitials(
  ctx: any,
  username: string,
  cx: number,
  cy: number
): void {
  const initials = username.slice(0, 2).toUpperCase();
  ctx.save();
  ctx.fillStyle = C_CONTENT;
  ctx.font = `bold ${initials.length === 1 ? 58 : 48}px sans-serif`;
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

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}
