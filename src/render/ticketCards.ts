import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import { circleImage, ensureFonts, fetchImage, fillRoundRect, font, hex, palette, roundRect } from './canvas.js';
import { loadIcon } from './icons.js';

const WIDTH = 1000;
const HEIGHT = 300;

function createTicketCanvas(accent: number) {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const color = hex(accent);
  fillRoundRect(ctx, 0, 0, WIDTH, HEIGHT, 28, palette.background);
  roundRect(ctx, 1, 1, WIDTH - 2, HEIGHT - 2, 27);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 28);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, HEIGHT);
  const glow = ctx.createRadialGradient(835, 150, 8, 835, 150, 250);
  glow.addColorStop(0, `${color}30`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(590, 0, 410, HEIGHT);
  ctx.restore();

  return { canvas, ctx, color };
}

function drawOverline(ctx: SKRSContext2D, value: string) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('SemiBold', 17);
  ctx.fillStyle = palette.muted;
  ctx.fillText(value.toUpperCase(), 54, 72, 635);
}

function drawTicketTile(ctx: SKRSContext2D, accent: string) {
  fillRoundRect(ctx, 744, 55, 204, 190, 24, palette.surface);
  roundRect(ctx, 745, 56, 202, 188, 23);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.stroke();
  fillRoundRect(ctx, 793, 80, 106, 106, 28, 'rgba(255,255,255,0.045)');
  ctx.beginPath();
  ctx.arc(846, 133, 43, 0, Math.PI * 2);
  ctx.strokeStyle = `${accent}80`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Accent-matched banner artwork with a built-in visual style choice. */
export async function renderTicketPanelCard(accent: number, template: 'support' | 'minimal' = 'support'): Promise<Buffer> {
  const { canvas, ctx, color } = createTicketCanvas(accent);
  if (template === 'minimal') {
    drawOverline(ctx, 'Private help desk');
    ctx.textAlign = 'left';
    ctx.font = font('Bold', 42);
    ctx.fillStyle = palette.text;
    ctx.fillText('Tell us what is going on.', 54, 133, 650);
    ctx.font = font('Medium', 23);
    ctx.fillStyle = palette.muted;
    ctx.fillText('A private chat with the right team.', 56, 177, 620);
    fillRoundRect(ctx, 54, 211, 196, 42, 13, `${color}24`);
    ctx.font = font('SemiBold', 15);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OPEN A TICKET', 152, 232);
  } else {
    drawOverline(ctx, 'Support desk');
    ctx.textAlign = 'left';
    ctx.font = font('Bold', 42);
    ctx.fillStyle = palette.text;
    ctx.fillText('A private space for help.', 54, 133, 650);
    ctx.font = font('Medium', 23);
    ctx.fillStyle = palette.muted;
    ctx.fillText('Start a conversation with the team.', 56, 177, 640);
    fillRoundRect(ctx, 54, 211, 196, 42, 13, `${color}24`);
    ctx.font = font('SemiBold', 15);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PRIVATE TICKETS', 152, 232);
  }

  drawTicketTile(ctx, color);
  const ticketIcon = await loadIcon('1f3ab');
  if (ticketIcon) ctx.drawImage(ticketIcon, 805, 92, 82, 82);
  ctx.font = font('Medium', 14);
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Your team is ready', 846, 216);
  return canvas.toBuffer('image/png');
}

export interface TicketOpeningCardData {
  accent: number;
  ticketId: number;
  panelTitle: string;
  displayName: string;
  avatarUrl?: string;
  categoryLabel?: string | null;
  status: string;
}

/** One compact summary card: the adjacent container carries the intake answers and controls. */
export async function renderTicketOpeningCard(data: TicketOpeningCardData): Promise<Buffer> {
  const { canvas, ctx, color } = createTicketCanvas(data.accent);
  drawOverline(ctx, `${data.panelTitle || 'Private support'} · ticket opened`);
  ctx.textAlign = 'left';
  ctx.font = font('Bold', 42);
  ctx.fillStyle = palette.text;
  ctx.fillText(`Ticket #${data.ticketId}`, 54, 128, 630);
  ctx.font = font('SemiBold', 22);
  ctx.fillStyle = palette.text;
  ctx.fillText(`Opened by ${data.displayName}`, 56, 171, 625);
  ctx.font = font('Medium', 20);
  ctx.fillStyle = palette.muted;
  ctx.fillText(data.categoryLabel ? `Category · ${data.categoryLabel}` : 'Private support request', 56, 207, 625);

  const statusColor = data.status.startsWith('Claimed') ? '#55d89a' : color;
  fillRoundRect(ctx, 54, 224, 376, 42, 13, `${statusColor}22`);
  ctx.font = font('SemiBold', 17);
  ctx.fillStyle = statusColor;
  ctx.textBaseline = 'middle';
  ctx.fillText(data.status, 70, 245, 344);
  ctx.textBaseline = 'alphabetic';

  fillRoundRect(ctx, 744, 55, 204, 190, 24, palette.surface);
  roundRect(ctx, 745, 56, 202, 188, 23);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(846, 150, 70, 0, Math.PI * 2);
  ctx.fillStyle = `${color}35`;
  ctx.fill();
  ctx.strokeStyle = `${color}95`;
  ctx.lineWidth = 3;
  ctx.stroke();
  const avatar = await fetchImage(data.avatarUrl, 2500);
  if (avatar) circleImage(ctx, avatar, 846, 150, 64);
  else {
    const initials = data.displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => [...part][0]!.toUpperCase()).join('') || '?';
    ctx.font = font('Bold', 42);
    ctx.fillStyle = palette.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 846, 150);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  return canvas.toBuffer('image/png');
}
