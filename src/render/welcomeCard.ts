import { createCanvas, loadImage } from '@napi-rs/canvas';
import { circleImage, ensureFonts, fetchImage, fitText, font, formatNumber, hex, palette, roundRect, wrapText } from './canvas.js';

export type WelcomeCardTemplate = 'celebration' | 'minimal' | 'soft';
export type WelcomeEventKind = 'join' | 'leave';

export interface WelcomeCardData {
  event: WelcomeEventKind;
  template: WelcomeCardTemplate;
  accent: number;
  displayName: string;
  avatarUrl: string;
  serverName: string;
  memberCount: number;
  message: string;
  showAvatar: boolean;
  showMemberCount: boolean;
  showServerName: boolean;
  background?: Buffer | null;
}

const WIDTH = 1000;
const HEIGHT = 300;
const THEMES: Record<WelcomeCardTemplate, { from: string; to: string; glow: string }> = {
  celebration: { from: '#171421', to: '#30213d', glow: '#8154a1' },
  minimal: { from: '#111118', to: '#20202a', glow: '#363642' },
  soft: { from: '#12201f', to: '#1e3531', glow: '#3c7869' },
};

/** Canvas-rendered member greeting card shared by join and leave messages. */
export async function renderWelcomeCard(data: WelcomeCardData): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const accent = hex(data.accent);
  const theme = THEMES[data.template];
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, theme.from);
  gradient.addColorStop(1, theme.to);
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
  ctx.clip();
  if (data.background?.length) {
    try {
      const background = await loadImage(data.background);
      const scale = Math.max(WIDTH / background.width, HEIGHT / background.height);
      const width = background.width * scale;
      const height = background.height * scale;
      ctx.drawImage(background, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
      ctx.fillStyle = 'rgba(12,12,18,0.62)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } catch {
      // Uploaded artwork is optional; fall back to the selected built-in background.
    }
  } else if (data.template === 'celebration') {
    for (let i = 0; i < 28; i++) {
      const x = (i * 173 + 61) % WIDTH;
      const y = (i * 97 + 29) % HEIGHT;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? `${accent}45` : 'rgba(255,255,255,0.12)';
      ctx.fill();
    }
  }
  const glow = ctx.createRadialGradient(850, 20, 12, 850, 20, 400);
  glow.addColorStop(0, `${theme.glow}80`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(500, 0, 500, HEIGHT);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 9, HEIGHT);
  ctx.restore();

  roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 28);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  const bodyX = data.showAvatar ? 270 : 64;
  const bodyWidth = data.showAvatar ? 660 : 870;
  if (data.showAvatar) {
    ctx.beginPath();
    ctx.arc(150, 150, 91, 0, Math.PI * 2);
    ctx.fillStyle = `${accent}80`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(150, 150, 84, 0, Math.PI * 2);
    ctx.fillStyle = theme.from;
    ctx.fill();
    circleImage(ctx, await fetchImage(data.avatarUrl), 150, 150, 78);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('SemiBold', 15);
  ctx.fillStyle = `${accent}D8`;
  ctx.fillText(data.event === 'join' ? 'A NEW MEMBER' : 'MEMBER UPDATE', bodyX, 68);

  ctx.font = font('Bold', 39);
  ctx.fillStyle = palette.text;
  ctx.fillText(fitText(ctx, data.displayName, bodyWidth), bodyX, 122);

  ctx.font = font('Medium', 19);
  ctx.fillStyle = '#D3D1DA';
  const cleanMessage = data.message.replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
  const lines = wrapText(ctx, cleanMessage, bodyWidth, 2);
  lines.forEach((line, index) => ctx.fillText(line, bodyX, 163 + index * 27));

  const footerY = 247;
  if (data.showServerName) {
    ctx.font = font('SemiBold', 14);
    ctx.fillStyle = palette.muted;
    ctx.fillText(fitText(ctx, data.serverName.toUpperCase(), data.showMemberCount ? bodyWidth * 0.62 : bodyWidth), bodyX, footerY);
  }
  if (data.showMemberCount) {
    const count = `MEMBER ${formatNumber(data.memberCount)}`;
    ctx.textAlign = 'right';
    ctx.font = font('SemiBold', 14);
    ctx.fillStyle = palette.muted;
    ctx.fillText(count, bodyX + bodyWidth, footerY);
  }
  return canvas.toBuffer('image/png');
}
