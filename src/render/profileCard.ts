import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { circleImage, ensureFonts, fetchImage, fillRoundRect, fitText, font, formatNumber, hex, palette, progressBar, roundRect } from './canvas.js';
import { loadIcon } from './icons.js';

export interface ProfileCardData {
  displayName: string;
  avatarUrl: string;
  level: number;
  currentXp: number;
  neededXp: number;
  credits: number;
  collected: number;
  collectable: number;
  streak: number;
  rank: number | null;
  zone: { name: string; icon: string };
  tool: { name: string; icon: string };
  bestFind: { name: string; icon: string; color: number } | null;
  accent: number;
}

const WIDTH = 1000;
const HEIGHT = 470;
const PAD = 40;

/** Hazard-tape strip along the top — the "scrapyard" touch. */
function hazardStripe(ctx: SKRSContext2D, color: string) {
  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(0, 0, WIDTH, 10);
  ctx.clip();
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, WIDTH, 10);
  ctx.fillStyle = color;
  for (let x = -20; x < WIDTH + 20; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x + 10, 0);
    ctx.lineTo(x + 24, 0);
    ctx.lineTo(x + 14, 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

async function stat(ctx: SKRSContext2D, x: number, y: number, w: number, icon: string, value: string, label: string) {
  fillRoundRect(ctx, x, y, w, 118, 20, palette.surface);
  const image = await loadIcon(icon);
  if (image) ctx.drawImage(image, x + 20, y + 20, 36, 36);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font('SemiBold', 15);
  ctx.fillStyle = palette.muted;
  ctx.fillText(label.toUpperCase(), x + 66, y + 39);
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('Bold', 34);
  ctx.fillStyle = palette.text;
  ctx.fillText(fitText(ctx, value, w - 40), x + 20, y + 98);
}

async function chip(ctx: SKRSContext2D, x: number, y: number, w: number, icon: string, label: string, value: string, color: string) {
  fillRoundRect(ctx, x, y, w, 64, 18, palette.surface);
  const image = await loadIcon(icon);
  if (image) ctx.drawImage(image, x + 16, y + 14, 36, 36);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('SemiBold', 13);
  ctx.fillStyle = palette.muted;
  ctx.fillText(label.toUpperCase(), x + 64, y + 27);
  ctx.font = font('SemiBold', 19);
  ctx.fillStyle = color;
  ctx.fillText(fitText(ctx, value, w - 80), x + 64, y + 50);
}

/** Salvage profile: who you are, your level, and the few stats that matter. */
export async function renderProfileCard(data: ProfileCardData): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const accent = hex(data.accent);

  fillRoundRect(ctx, 0, 0, WIDTH, HEIGHT, 28, palette.background);
  roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 28);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  hazardStripe(ctx, accent);

  // Header: avatar, name, level
  const avatar = await fetchImage(data.avatarUrl);
  ctx.beginPath();
  ctx.arc(PAD + 46, 92, 50, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  circleImage(ctx, avatar, PAD + 46, 92, 45);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('SemiBold', 15);
  ctx.fillStyle = palette.muted;
  ctx.fillText('SALVAGER', 160, 74);
  ctx.font = font('Bold', 38);
  ctx.fillStyle = palette.text;
  ctx.fillText(fitText(ctx, data.displayName, 560), 158, 116);

  ctx.textAlign = 'right';
  ctx.font = font('SemiBold', 15);
  ctx.fillStyle = palette.muted;
  ctx.fillText('LEVEL', WIDTH - PAD, 74);
  ctx.font = font('Bold', 48);
  ctx.fillStyle = accent;
  ctx.fillText(String(data.level), WIDTH - PAD, 118);

  // XP bar
  ctx.font = font('Medium', 16);
  ctx.fillStyle = palette.muted;
  ctx.fillText(`${formatNumber(data.currentXp)} / ${formatNumber(data.neededXp)} XP`, WIDTH - PAD, 166);
  progressBar(ctx, PAD, 178, WIDTH - PAD * 2, 14, data.neededXp ? data.currentXp / data.neededXp : 0, accent);

  // Stat tiles
  const gap = 16;
  const tileW = (WIDTH - PAD * 2 - gap * 3) / 4;
  const tiles: Array<[string, string, string]> = [
    ['1fa99', formatNumber(data.credits), 'Credits'],
    ['1f4d6', `${data.collected}/${data.collectable}`, 'Collected'],
    ['1f525', `${data.streak} ${data.streak === 1 ? 'day' : 'days'}`, 'Streak'],
    ['1f3c6', data.rank ? `#${formatNumber(data.rank)}` : '—', 'Global rank'],
  ];
  for (const [i, [icon, value, label]] of tiles.entries()) await stat(ctx, PAD + i * (tileW + gap), 222, tileW, icon, value, label);

  // Zone · Tool · Best find
  const chipW = (WIDTH - PAD * 2 - gap * 2) / 3;
  await chip(ctx, PAD, 362, chipW, data.zone.icon, 'Zone', data.zone.name, palette.text);
  await chip(ctx, PAD + chipW + gap, 362, chipW, data.tool.icon, 'Tool', data.tool.name, palette.text);
  if (data.bestFind) await chip(ctx, PAD + (chipW + gap) * 2, 362, chipW, data.bestFind.icon, 'Best find', data.bestFind.name, hex(data.bestFind.color));
  else await chip(ctx, PAD + (chipW + gap) * 2, 362, chipW, '2753', 'Best find', 'Nothing yet', palette.muted);

  return canvas.toBuffer('image/png');
}
