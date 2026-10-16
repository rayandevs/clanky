import { createCanvas } from '@napi-rs/canvas';
import { circleImage, ensureFonts, fetchImage, fillRoundRect, fitText, font, formatNumber, hex, palette, progressBar, roundRect } from './canvas.js';

export type RankCardTheme = 'midnight' | 'ember' | 'forest' | 'violet';

export interface RankCardData {
  displayName: string;
  username: string;
  avatarUrl: string;
  rank: number | null;
  level: number;
  currentXp: number;
  neededXp: number;
  accent: number;
  theme?: RankCardTheme;
  serverName?: string;
  serverIconUrl?: string | null;
  messages?: number;
  showServerIcon?: boolean;
  showRank?: boolean;
  showMessages?: boolean;
  showXp?: boolean;
}

const WIDTH = 1000;
const HEIGHT = 300;
const THEMES: Record<RankCardTheme, { top: string; bottom: string; glow: string }> = {
  midnight: { top: '#111118', bottom: '#201e2b', glow: '#34233c' },
  ember: { top: '#21130f', bottom: '#3b2118', glow: '#703a20' },
  forest: { top: '#0d1c19', bottom: '#18372e', glow: '#235545' },
  violet: { top: '#171321', bottom: '#30203f', glow: '#563a70' },
};

/** Server-customizable, canvas-rendered member rank card. */
export async function renderRankCard(data: RankCardData): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const accent = hex(data.accent);
  const theme = THEMES[data.theme ?? 'midnight'];

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, theme.top);
  background.addColorStop(1, theme.bottom);
  fillRoundRect(ctx, 0, 0, WIDTH, HEIGHT, 28, background as unknown as string);
  ctx.save();
  roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 28);
  ctx.clip();
  const glow = ctx.createRadialGradient(920, 0, 10, 920, 0, 470);
  glow.addColorStop(0, theme.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(500, 0, 500, 300);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(0, 0, 9, HEIGHT);
  ctx.restore();
  roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 28);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  const avatar = await fetchImage(data.avatarUrl);
  ctx.beginPath();
  ctx.arc(150, 150, 96, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(150, 150, 90, 0, Math.PI * 2);
  ctx.fillStyle = theme.top;
  ctx.fill();
  circleImage(ctx, avatar, 150, 150, 84);

  const stats: Array<{ label: string; value: string; color: string; x: number }> = [
    { label: 'LEVEL', value: String(data.level), color: accent, x: 950 },
  ];
  if (data.showRank !== false) stats.push({ label: 'RANK', value: data.rank ? `#${data.rank}` : '—', color: palette.text, x: 0 });
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('Bold', 56);
  if (stats.length > 1) stats[1]!.x = 950 - Math.max(ctx.measureText(stats[0]!.value).width, 70) - 48;
  for (const stat of stats) {
    ctx.font = font('SemiBold', 18);
    ctx.fillStyle = palette.muted;
    ctx.fillText(stat.label, stat.x, 92);
    ctx.font = font('Bold', 56);
    ctx.fillStyle = stat.color;
    ctx.fillText(stat.value, stat.x, 150);
  }
  const rightEdge = stats.length > 1 ? stats[1]!.x : 950;
  const statsLeft = rightEdge - Math.max(100, ctx.measureText(stats.at(-1)!.value).width) - 32;

  ctx.textAlign = 'left';
  ctx.font = font('Bold', 42);
  ctx.fillStyle = palette.text;
  ctx.fillText(fitText(ctx, data.displayName, Math.max(160, statsLeft - 290)), 290, 130);
  ctx.font = font('Medium', 22);
  ctx.fillStyle = palette.muted;
  ctx.fillText(fitText(ctx, `@${data.username}`, Math.max(160, statsLeft - 290)), 290, 166);

  if (data.showXp !== false) {
    ctx.textAlign = 'right';
    ctx.font = font('Medium', 20);
    ctx.fillStyle = palette.muted;
    ctx.fillText(`${formatNumber(data.currentXp)} / ${formatNumber(data.neededXp)} XP`, 950, 226);
    progressBar(ctx, 290, 242, 660, 16, data.neededXp ? data.currentXp / data.neededXp : 0, accent);
  }
  if (data.showMessages && data.messages !== undefined) {
    ctx.textAlign = 'left';
    ctx.font = font('SemiBold', 16);
    ctx.fillStyle = palette.muted;
    ctx.fillText(`${formatNumber(data.messages)} messages tracked`, 290, data.showXp === false ? 226 : 286);
  }

  if (data.showServerIcon && data.serverIconUrl) {
    const icon = await fetchImage(data.serverIconUrl);
    if (icon) {
      circleImage(ctx, icon, 946, 40, 20);
      ctx.beginPath();
      ctx.arc(946, 40, 22, 0, Math.PI * 2);
      ctx.strokeStyle = `${accent}B0`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (data.serverName) {
    ctx.textAlign = 'right';
    ctx.font = font('SemiBold', 14);
    ctx.fillStyle = palette.muted;
    ctx.fillText(fitText(ctx, data.serverName.toUpperCase(), 210), 950, 42);
  }

  return canvas.toBuffer('image/png');
}
