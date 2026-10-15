import { createCanvas } from '@napi-rs/canvas';
import { loadIcon } from './icons.js';
import { ensureFonts, fillRoundRect, fitText, font, formatNumber, hex, palette, progressBar, roundRect } from './canvas.js';

export interface FindCardData {
  /** Twemoji code, e.g. "1f529" */
  icon: string;
  /** Small pill above the title, e.g. "LEGENDARY" */
  label: string;
  labelColor: number;
  title: string;
  subtitle: string;
  /** Top-right corner text, e.g. the zone */
  corner: string;
  shiny?: boolean;
  level: number;
  currentXp: number;
  neededXp: number;
  accent: number;
}

const WIDTH = 1000;
const HEIGHT = 320;

/** Card for a Salvage find (also used for events). */
export async function renderFindCard(data: FindCardData): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const accent = hex(data.accent);
  const tierColor = hex(data.labelColor);

  fillRoundRect(ctx, 0, 0, WIDTH, HEIGHT, 28, palette.background);
  roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 28);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Icon tile with a rarity border
  fillRoundRect(ctx, 40, 40, 240, 240, 28, palette.surface);
  roundRect(ctx, 42, 42, 236, 236, 26);
  ctx.strokeStyle = tierColor;
  ctx.lineWidth = 4;
  ctx.stroke();
  const icon = await loadIcon(data.icon);
  if (icon) ctx.drawImage(icon, 85, 85, 150, 150);

  if (data.shiny) {
    ctx.font = font('Bold', 16);
    const w = ctx.measureText('SHINY').width + 28;
    fillRoundRect(ctx, 160 - w / 2, 26, w, 30, 15, palette.gold);
    ctx.fillStyle = palette.background;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SHINY', 160, 42);
  }

  // Corner (zone)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('SemiBold', 16);
  ctx.fillStyle = palette.muted;
  ctx.fillText(data.corner.toUpperCase(), 960, 72);

  // Rarity pill
  ctx.textAlign = 'left';
  ctx.font = font('Bold', 16);
  const pillWidth = ctx.measureText(data.label).width + 28;
  fillRoundRect(ctx, 320, 50, pillWidth, 32, 16, tierColor);
  ctx.fillStyle = palette.background;
  ctx.textBaseline = 'middle';
  ctx.fillText(data.label, 334, 67);

  // Title + subtitle
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('Bold', 46);
  ctx.fillStyle = palette.text;
  ctx.fillText(fitText(ctx, data.title, 640), 318, 146);
  ctx.font = font('Medium', 22);
  ctx.fillStyle = palette.muted;
  ctx.fillText(fitText(ctx, data.subtitle, 640), 320, 184);

  // Level bar
  ctx.font = font('SemiBold', 20);
  ctx.fillStyle = palette.text;
  ctx.fillText(`Level ${data.level}`, 320, 246);
  ctx.textAlign = 'right';
  ctx.font = font('Medium', 18);
  ctx.fillStyle = palette.muted;
  ctx.fillText(`${formatNumber(data.currentXp)} / ${formatNumber(data.neededXp)} XP`, 960, 246);
  progressBar(ctx, 320, 262, 640, 14, data.neededXp ? data.currentXp / data.neededXp : 0, accent);

  return canvas.toBuffer('image/png');
}
