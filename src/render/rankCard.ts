import { createCanvas } from '@napi-rs/canvas';
import { circleImage, ensureFonts, fetchImage, fillRoundRect, fitText, font, formatNumber, hex, palette, progressBar, roundRect } from './canvas.js';

export interface RankCardData {
  displayName: string;
  username: string;
  avatarUrl: string;
  rank: number | null;
  level: number;
  currentXp: number;
  neededXp: number;
  accent: number;
}

const WIDTH = 1000;
const HEIGHT = 300;

/** A simple, flat rank card. */
export async function renderRankCard(data: RankCardData): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const accent = hex(data.accent);

  // Card
  fillRoundRect(ctx, 0, 0, WIDTH, HEIGHT, 28, palette.background);
  roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 28);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Avatar with a solid ring
  const avatar = await fetchImage(data.avatarUrl);
  ctx.beginPath();
  ctx.arc(150, 150, 96, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(150, 150, 90, 0, Math.PI * 2);
  ctx.fillStyle = palette.background;
  ctx.fill();
  circleImage(ctx, avatar, 150, 150, 84);

  // Stats (right side)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  const stats = [
    { label: 'LEVEL', value: String(data.level), color: accent, x: 950 },
    { label: 'RANK', value: data.rank ? `#${data.rank}` : '—', color: palette.text, x: 0 },
  ];
  ctx.font = font('Bold', 56);
  stats[1]!.x = 950 - Math.max(ctx.measureText(stats[0]!.value).width, 70) - 48;
  for (const stat of stats) {
    ctx.font = font('SemiBold', 18);
    ctx.fillStyle = palette.muted;
    ctx.fillText(stat.label, stat.x, 92);
    ctx.font = font('Bold', 56);
    ctx.fillStyle = stat.color;
    ctx.fillText(stat.value, stat.x, 150);
  }
  const statsLeft = stats[1]!.x - Math.max(ctx.measureText(stats[1]!.value).width, 70) - 32;

  // Name
  ctx.textAlign = 'left';
  ctx.font = font('Bold', 42);
  ctx.fillStyle = palette.text;
  ctx.fillText(fitText(ctx, data.displayName, statsLeft - 290), 290, 130);
  ctx.font = font('Medium', 22);
  ctx.fillStyle = palette.muted;
  ctx.fillText(fitText(ctx, `@${data.username}`, statsLeft - 290), 290, 166);

  // XP bar
  ctx.textAlign = 'right';
  ctx.font = font('Medium', 20);
  ctx.fillStyle = palette.muted;
  ctx.fillText(`${formatNumber(data.currentXp)} / ${formatNumber(data.neededXp)} XP`, 950, 226);
  progressBar(ctx, 290, 242, 660, 16, data.neededXp ? data.currentXp / data.neededXp : 0, accent);

  return canvas.toBuffer('image/png');
}
