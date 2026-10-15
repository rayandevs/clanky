import { createCanvas } from '@napi-rs/canvas';
import { circleImage, ensureFonts, fetchImage, fillRoundRect, fitText, font, formatNumber, hex, palette, progressBar, roundRect } from './canvas.js';

export interface LeaderboardRow {
  place: number;
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  /** Progress to the next level, 0–1 */
  progress: number;
  /** The person viewing the leaderboard */
  isViewer: boolean;
}

export interface LeaderboardData {
  serverName: string;
  serverIconUrl: string | null;
  page: number;
  pages: number;
  rows: LeaderboardRow[];
  viewerRank: number | null;
  accent: number;
}

const WIDTH = 1000;
const HEADER = 170;
const ROW_HEIGHT = 88;
const ROW_GAP = 12;
const FOOTER = 70;
const MEDALS = [palette.gold, palette.silver, palette.bronze];

export async function renderLeaderboard(data: LeaderboardData): Promise<Buffer> {
  ensureFonts();
  const height = HEADER + data.rows.length * (ROW_HEIGHT + ROW_GAP) + FOOTER;
  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');
  const accent = hex(data.accent);

  fillRoundRect(ctx, 0, 0, WIDTH, height, 32, palette.background);

  // Header: server icon, title, page info
  const [icon, ...avatars] = await Promise.all([fetchImage(data.serverIconUrl), ...data.rows.map((r) => fetchImage(r.avatarUrl))]);
  if (icon) circleImage(ctx, icon, 84, 86, 40);
  else {
    ctx.beginPath();
    ctx.arc(84, 86, 40, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.font = font('Bold', 34);
    ctx.fillStyle = palette.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.serverName.charAt(0).toUpperCase(), 84, 88);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('Bold', 44);
  ctx.fillStyle = palette.text;
  ctx.fillText('LEADERBOARD', 148, 86);
  ctx.font = font('Medium', 22);
  ctx.fillStyle = palette.muted;
  ctx.fillText(fitText(ctx, `${data.serverName}  ·  Page ${data.page + 1} of ${data.pages}`, 790), 150, 122);

  // Rows
  data.rows.forEach((row, index) => {
    const y = HEADER + index * (ROW_HEIGHT + ROW_GAP);
    const medal = MEDALS[row.place - 1];

    fillRoundRect(ctx, 40, y, WIDTH - 80, ROW_HEIGHT, 18, row.isViewer ? palette.surfaceHighlight : palette.surface);
    roundRect(ctx, 41, y + 1, WIDTH - 82, ROW_HEIGHT - 2, 18);
    ctx.strokeStyle = row.isViewer ? accent : palette.border;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (medal) fillRoundRect(ctx, 40, y + 14, 6, ROW_HEIGHT - 28, 3, medal);

    const mid = y + ROW_HEIGHT / 2;
    ctx.textBaseline = 'middle';

    // Place
    ctx.textAlign = 'center';
    ctx.font = font('Bold', row.place >= 100 ? 26 : 32);
    ctx.fillStyle = medal ?? palette.muted;
    ctx.fillText(String(row.place), 102, mid + 2);

    // Avatar + name
    circleImage(ctx, avatars[index] ?? null, 190, mid, 28);
    ctx.textAlign = 'left';
    ctx.font = font('SemiBold', 26);
    ctx.fillStyle = palette.text;
    ctx.fillText(fitText(ctx, row.name, 330), 236, mid + 2);

    // Level + progress
    ctx.font = font('SemiBold', 20);
    ctx.fillText(`Level ${row.level}`, 600, mid - 12);
    progressBar(ctx, 600, mid + 12, 170, 8, row.progress, accent);

    // XP
    ctx.textAlign = 'right';
    ctx.font = font('Medium', 22);
    ctx.fillStyle = palette.muted;
    ctx.fillText(`${formatNumber(row.xp)} XP`, WIDTH - 72, mid + 2);
  });

  // Footer
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('Medium', 20);
  ctx.fillStyle = palette.muted;
  const footer = data.viewerRank ? `You are #${formatNumber(data.viewerRank)}  ·  /rank to see your card` : 'Chat to earn XP  ·  /rank to see your card';
  ctx.fillText(footer, WIDTH / 2, height - 30);

  return canvas.toBuffer('image/png');
}
