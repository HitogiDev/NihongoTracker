import { createCanvas, loadImage } from 'canvas';
import { IUser } from '../types.js';

interface ProfileOgImageOptions {
  user: Pick<IUser, 'username' | 'avatar' | 'banner' | 'stats'> | IUser;
  width?: number;
  height?: number;
}

/**
 * Generates a beautiful OG image for user profiles
 */
export async function generateProfileOgImage(
  options: ProfileOgImageOptions
): Promise<Buffer> {
  const { user, width = 1200, height = 630 } = options;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background - Use banner if available, otherwise gradient
  if (user.banner) {
    try {
      const banner = await loadImage(user.banner);

      // Draw banner covering entire canvas
      ctx.drawImage(banner, 0, 0, width, height);

      // Add dark overlay for better text readability
      const overlayGradient = ctx.createLinearGradient(0, 0, 0, height);
      overlayGradient.addColorStop(0, 'rgba(15, 23, 42, 0.85)'); // slate-900 with 85% opacity
      overlayGradient.addColorStop(0.5, 'rgba(30, 41, 59, 0.80)'); // slate-800 with 80% opacity
      overlayGradient.addColorStop(1, 'rgba(51, 65, 85, 0.85)'); // slate-700 with 85% opacity
      ctx.fillStyle = overlayGradient;
      ctx.fillRect(0, 0, width, height);
    } catch (error) {
      console.error('Error loading banner:', error);
      // Fall back to gradient background
      drawGradientBackground(ctx, width, height);
    }
  } else {
    // Default gradient background
    drawGradientBackground(ctx, width, height);
  }

  // Add subtle grid pattern overlay
  ctx.globalAlpha = 0.02;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let i = 0; i < width; i += gridSize) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  for (let j = 0; j < height; j += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(width, j);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Decorative circles
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#3b82f6'; // blue-500
  ctx.beginPath();
  ctx.arc(width - 100, 100, 200, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8b5cf6'; // violet-500
  ctx.beginPath();
  ctx.arc(100, height - 100, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Load and draw avatar with circular mask
  if (user.avatar) {
    try {
      const avatar = await loadImage(user.avatar);
      const avatarSize = 180;
      const avatarX = 80;
      const avatarY = height / 2 - avatarSize / 2 - 20; // Move up more for better centering

      // Draw avatar border/glow
      ctx.save();
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2 + 5,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();

      // Draw avatar with circular clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    } catch (error) {
      console.error('Error loading avatar:', error);
      // Draw default avatar circle - moved up more for better centering
      drawDefaultAvatar(ctx, 80, height / 2 - 110, 180);
    }
  } else {
    // Draw default avatar - moved up more for better centering
    drawDefaultAvatar(ctx, 80, height / 2 - 110, 180);
  }

  // Username - moved up more for better centering
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(user.username, 300, height / 2 - 100);

  // Stats container background - moved up more for better centering
  const statsY = height / 2 - 60;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.6)'; // semi-transparent slate-800
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, 300, statsY, 820, 280, 15);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Top stats row - main stats with bigger spacing
  const statsRowY = statsY + 70;
  const statSpacing = 270; // Increased spacing for bigger text

  // Level stat
  drawStat(ctx, 340, statsRowY, 'LEVEL', user.stats.userLevel.toString(), {
    iconColor: '#3b82f6',
    iconType: 'level',
  });

  // Total XP stat
  drawStat(
    ctx,
    340 + statSpacing,
    statsRowY,
    'TOTAL XP',
    formatNumber(user.stats.userXp),
    { iconColor: '#8b5cf6', iconType: 'xp' }
  );

  // Streak stat
  drawStat(
    ctx,
    340 + statSpacing * 2,
    statsRowY,
    'STREAK',
    `${user.stats.currentStreak}d`,
    { iconColor: '#f59e0b', iconType: 'streak' }
  );

  // Bottom stats row - Reading & Listening levels with more spacing
  const bottomRowY = statsRowY + 130; // Increased vertical spacing

  // Reading level
  drawSmallStat(
    ctx,
    340,
    bottomRowY,
    'READING',
    `Lv ${user.stats.readingLevel}`,
    '#10b981'
  );

  // Listening level - adjust position for new spacing
  drawSmallStat(
    ctx,
    340 + statSpacing,
    bottomRowY,
    'LISTENING',
    `Lv ${user.stats.listeningLevel}`,
    '#06b6d4'
  );

  // Branding - moved up slightly for better balance
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('NihongoTracker', 50, height - 30);

  // Decorative accent line - moved up slightly
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(50, height - 20);
  ctx.lineTo(300, height - 20);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

/**
 * Draw a default avatar circle when user has no avatar
 */
function drawDefaultAvatar(ctx: any, x: number, y: number, size: number): void {
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  // Gradient background circle
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    size / 2
  );
  gradient.addColorStop(0, '#3b82f6');
  gradient.addColorStop(1, '#1e40af');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Simple avatar design with circle (head) and half-circle (body)
  ctx.fillStyle = '#ffffff';

  // Head circle - positioned in upper half
  const headRadius = size * 0.15;
  const headY = centerY - size * 0.15;
  ctx.beginPath();
  ctx.arc(centerX, headY, headRadius, 0, Math.PI * 2);
  ctx.fill();

  // Body half-circle - positioned below head (flat side down) with gap
  const bodyRadius = size * 0.25;
  const bodyY = centerY + size * 0.2;
  ctx.beginPath();
  ctx.arc(centerX, bodyY, bodyRadius, Math.PI, 0, false); // Half circle with flat side down
  ctx.fill();
}

/**
 * Draw a stat box with icon and value
 */
function drawStat(
  ctx: any,
  x: number,
  y: number,
  label: string,
  value: string,
  options: { iconColor: string; iconType: 'level' | 'xp' | 'streak' }
): void {
  // Icon background with subtle gradient
  const iconGradient = ctx.createRadialGradient(x, y, 0, x, y, 25);
  iconGradient.addColorStop(0, options.iconColor + '30');
  iconGradient.addColorStop(1, options.iconColor + '10');
  ctx.fillStyle = iconGradient;
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.fill();

  // Draw custom icon based on type
  ctx.save();
  ctx.fillStyle = options.iconColor;
  ctx.strokeStyle = options.iconColor;

  switch (options.iconType) {
    case 'level':
      // Draw clean upward trending arrow
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Arrow shaft (stepped line going up)
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 6);
      ctx.lineTo(x - 2, y + 6);
      ctx.lineTo(x - 2, y);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x + 4, y - 6);
      ctx.stroke();

      // Arrow head
      ctx.fillStyle = options.iconColor;
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 9);
      ctx.lineTo(x + 9, y - 4);
      ctx.lineTo(x + 4, y - 4);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + 4, y - 9);
      ctx.lineTo(x - 1, y - 4);
      ctx.lineTo(x + 4, y - 4);
      ctx.closePath();
      ctx.fill();
      break;

    case 'xp':
      // Draw polished star
      ctx.lineWidth = 0;
      const outerRadius = 11;
      const innerRadius = 5;
      const spikes = 5;

      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Add inner highlight for depth
      ctx.fillStyle = options.iconColor + 'CC';
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const radius = i % 2 === 0 ? outerRadius * 0.5 : innerRadius * 0.6;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius - 1;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;

    case 'streak':
      // Draw stylized flame
      ctx.fillStyle = options.iconColor;

      // Outer flame
      ctx.beginPath();
      ctx.moveTo(x, y - 11);
      ctx.bezierCurveTo(x - 3, y - 9, x - 6, y - 5, x - 7, y);
      ctx.bezierCurveTo(x - 7, y + 3, x - 5, y + 6, x - 2, y + 9);
      ctx.bezierCurveTo(x - 1, y + 5, x, y + 3, x, y);
      ctx.bezierCurveTo(x, y + 3, x + 1, y + 5, x + 2, y + 9);
      ctx.bezierCurveTo(x + 5, y + 6, x + 7, y + 3, x + 7, y);
      ctx.bezierCurveTo(x + 6, y - 5, x + 3, y - 9, x, y - 11);
      ctx.closePath();
      ctx.fill();

      // Inner flame highlight
      ctx.fillStyle = options.iconColor + 'DD';
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.bezierCurveTo(x - 2, y - 5, x - 3, y - 2, x - 4, y + 1);
      ctx.bezierCurveTo(x - 4, y + 3, x - 3, y + 5, x - 1, y + 6);
      ctx.bezierCurveTo(x - 0.5, y + 3, x, y + 2, x, y);
      ctx.bezierCurveTo(x, y + 2, x + 0.5, y + 3, x + 1, y + 6);
      ctx.bezierCurveTo(x + 3, y + 5, x + 4, y + 3, x + 4, y + 1);
      ctx.bezierCurveTo(x + 3, y - 2, x + 2, y - 5, x, y - 7);
      ctx.closePath();
      ctx.fill();

      // Core highlight
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.bezierCurveTo(x - 1.5, y - 1, x - 2, y + 1, x - 1, y + 3);
      ctx.bezierCurveTo(x - 0.5, y + 1, x, y, x, y - 1);
      ctx.bezierCurveTo(x, y, x + 0.5, y + 1, x + 1, y + 3);
      ctx.bezierCurveTo(x + 2, y + 1, x + 1.5, y - 1, x, y - 3);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
  }

  ctx.restore();

  // Label
  ctx.textAlign = 'start';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(label, x + 40, y - 20);

  // Value - much bigger
  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(value, x + 40, y + 25);

  ctx.textBaseline = 'alphabetic';
}

/**
 * Draw a smaller stat for secondary information
 */
function drawSmallStat(
  ctx: any,
  x: number,
  y: number,
  label: string,
  value: string,
  color: string
): void {
  // Label
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(label, x, y - 12);

  // Value with color - much bigger
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y + 25);
}

/**
 * Draw a rounded rectangle
 */
function roundRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Format large numbers with K/M suffixes
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Draw default gradient background
 */
function drawGradientBackground(ctx: any, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0f172a'); // slate-900
  gradient.addColorStop(0.5, '#1e293b'); // slate-800
  gradient.addColorStop(1, '#334155'); // slate-700
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
