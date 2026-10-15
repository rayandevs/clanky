import { fillRoundRect, fitText, font, formatNumber, hex, palette, progressBar, roundRect } from './canvas.js';
import { STATUS_HEIGHT, TILE, WIDTH, drawIcon, gameCanvas, pill, statusBar, type GameFrame } from './game.js';

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
  frame: GameFrame;
}

const BODY = 320;

/** Card for a Salvage find (also used for events). */
export async function renderFindCard(data: FindCardData): Promise<Buffer> {
  const height = BODY + STATUS_HEIGHT;
  const { canvas, ctx } = gameCanvas(height, data.frame);
  const accent = hex(data.frame.theme.stripe ?? data.frame.accent);
  const tierColor = hex(data.labelColor);

  // Icon tile with a rarity border
  fillRoundRect(ctx, 40, 44, 236, 236, 28, TILE);
  roundRect(ctx, 42, 46, 232, 232, 26);
  ctx.strokeStyle = data.shiny ? palette.gold : tierColor;
  ctx.lineWidth = 4;
  ctx.stroke();
  await drawIcon(ctx, data.icon, 83, 87, 150);
  if (data.shiny) {
    ctx.font = font('Bold', 16);
    const w = ctx.measureText('SHINY').width + 28;
    pill(ctx, 158 - w / 2, 28, 'SHINY', palette.gold, palette.background, 16);
  }

  ctx.textAlign = 'right';
  ctx.font = font('SemiBold', 16);
  ctx.fillStyle = palette.muted;
  ctx.fillText(data.corner.toUpperCase(), WIDTH - 40, 76);

  ctx.textAlign = 'left';
  pill(ctx, 316, 54, data.label, tierColor, palette.background, 16);

  ctx.font = font('Bold', 46);
  ctx.fillStyle = palette.text;
  ctx.fillText(fitText(ctx, data.title, 640), 314, 150);
  ctx.font = font('Medium', 22);
  ctx.fillStyle = palette.muted;
  ctx.fillText(fitText(ctx, data.subtitle, 640), 316, 188);

  ctx.font = font('SemiBold', 20);
  ctx.fillStyle = palette.text;
  ctx.fillText(`Level ${data.level}`, 316, 248);
  ctx.textAlign = 'right';
  ctx.font = font('Medium', 18);
  ctx.fillStyle = palette.muted;
  ctx.fillText(`${formatNumber(data.currentXp)} / ${formatNumber(data.neededXp)} XP`, WIDTH - 40, 248);
  progressBar(ctx, 316, 264, WIDTH - 40 - 316, 14, data.neededXp ? data.currentXp / data.neededXp : 0, accent);
  ctx.textAlign = 'left';

  await statusBar(ctx, height, data.frame);
  return canvas.toBuffer('image/png');
}
