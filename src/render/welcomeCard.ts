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
const THEMES: Record<WelcomeCardTemplate, { from: string; mid?: string; to: string; eyebrow: string }> = {
  celebration: { from: '#5b2b11', mid: '#c2571d', to: '#f5a742', eyebrow: 'A NEW MEMBER' },
  minimal: { from: '#20222a', to: '#353946', eyebrow: 'COMMUNITY UPDATE' },
  soft: { from: '#34243c', mid: '#76526f', to: '#b77b91', eyebrow: 'MEMBER UPDATE' },
};

/** Keep pictographs out of the Poppins Canvas text, which has no emoji glyphs. */
export function cleanWelcomeCardText(value: string): string {
  return value
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\uFE0E\uFE0F\u200D]/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Canvas-rendered member greeting card shared by join and leave messages. */
export async function renderWelcomeCard(data: WelcomeCardData): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const accent = hex(data.accent);
  const theme = THEMES[data.template];
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, theme.from);
  if (theme.mid) gradient.addColorStop(0.52, theme.mid);
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
      const overlay = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      overlay.addColorStop(0, 'rgba(18,18,24,0.3)');
      overlay.addColorStop(1, 'rgba(18,18,24,0.75)');
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } catch {
      // Uploaded artwork is optional; fall back to the selected built-in background.
    }
  }
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 9, HEIGHT);
  ctx.restore();

  roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 28);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  const displayName = cleanWelcomeCardText(data.displayName) || 'Member';
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
    const avatar = await fetchImage(data.avatarUrl);
    circleImage(ctx, avatar, 150, 150, 78);
    if (!avatar) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font('Bold', 58);
      ctx.fillStyle = palette.text;
      ctx.fillText(displayName[0]!.toUpperCase(), 150, 150);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('SemiBold', 15);
  ctx.fillStyle = `${accent}D8`;
  ctx.fillText(data.event === 'join' ? theme.eyebrow : 'A MEMBER LEFT', bodyX, 68);

  ctx.font = font('Bold', 39);
  ctx.fillStyle = palette.text;
  ctx.fillText(fitText(ctx, displayName, bodyWidth), bodyX, 122);

  ctx.font = font('Medium', 19);
  ctx.fillStyle = '#D3D1DA';
  const cleanMessage = cleanWelcomeCardText(data.message);
  const lines = wrapText(ctx, cleanMessage, bodyWidth, 2);
  lines.forEach((line, index) => ctx.fillText(line, bodyX, 163 + index * 27));

  const footerY = 247;
  if (data.showServerName) {
    ctx.font = font('SemiBold', 14);
    ctx.fillStyle = palette.muted;
    const serverName = cleanWelcomeCardText(data.serverName).toUpperCase();
    ctx.fillText(fitText(ctx, serverName, data.showMemberCount ? bodyWidth * 0.62 : bodyWidth), bodyX, footerY);
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
