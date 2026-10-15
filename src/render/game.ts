import { createCanvas, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { ensureFonts, fillRoundRect, fitText, font, formatNumber, hex, palette, roundRect } from './canvas.js';
import { loadIcon } from './icons.js';

/**
 * Shared look for every Salvage image: themed background, hazard stripe,
 * header, and a status bar (bag · credits · zone · boosts) at the bottom.
 */

export const WIDTH = 1000;
export const PAD = 40;
export const TILE = 'rgba(255,255,255,0.045)';
export const TILE_BORDER = 'rgba(255,255,255,0.07)';
export const STATUS_HEIGHT = 76;

export interface GameTheme {
  /** Stripe color. null = accent color */
  stripe: number | null;
  background: string;
}

export interface GameStatus {
  bag: number;
  credits: number;
  zone: { name: string; icon: string };
  boosts: Array<{ icon: string; text: string }>;
}

export interface GameFrame {
  accent: number;
  theme: GameTheme;
  status: GameStatus;
}

export interface Banner {
  text: string;
  tone: 'success' | 'warning' | 'info';
}

const TONES = { success: '#4ade80', warning: '#fbbf24', info: '#60a5fa' } as const;

export const stripeColor = (frame: Pick<GameFrame, 'accent' | 'theme'>) => hex(frame.theme.stripe ?? frame.accent);

export function hazardStripe(ctx: SKRSContext2D, width: number, height: number, color: string) {
  ctx.save();
  roundRect(ctx, 0, 0, width, height, 28);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(0, 0, width, 10);
  ctx.clip();
  ctx.fillStyle = palette.surface;
  ctx.fillRect(0, 0, width, 10);
  ctx.fillStyle = color;
  for (let x = -20; x < width + 20; x += 28) {
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

/** New canvas with the themed background, border and stripe. */
export function gameCanvas(height: number, frame: Pick<GameFrame, 'accent' | 'theme'>) {
  ensureFonts();
  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');
  fillRoundRect(ctx, 0, 0, WIDTH, height, 28, frame.theme.background);
  roundRect(ctx, 1, 1, WIDTH - 2, height - 2, 28);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  hazardStripe(ctx, WIDTH, height, stripeColor(frame));
  return { canvas, ctx };
}

export async function drawIcon(ctx: SKRSContext2D, code: string, x: number, y: number, size: number, alpha = 1) {
  const icon = await loadIcon(code);
  if (!icon) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(icon, x, y, size, size);
  ctx.restore();
}

/** The icon as a flat dark shape — for things you haven't found yet. */
export async function drawSilhouette(ctx: SKRSContext2D, code: string, x: number, y: number, size: number, color = '#2c2c3a') {
  const icon = await loadIcon(code);
  if (!icon) return;
  const off = createCanvas(size, size);
  const o = off.getContext('2d');
  o.drawImage(icon as Image, 0, 0, size, size);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = color;
  o.fillRect(0, 0, size, size);
  ctx.drawImage(off, x, y);
}

export function pill(ctx: SKRSContext2D, x: number, y: number, label: string, bg: string, fg: string = palette.background, size = 15, align: 'left' | 'right' = 'left') {
  ctx.font = font('Bold', size);
  const w = ctx.measureText(label).width + size * 1.6;
  const h = size * 1.9;
  const left = align === 'right' ? x - w : x;
  fillRoundRect(ctx, left, y, w, h, h / 2, bg);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, left + w / 2, y + h / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return w;
}

/** Header: icon, title, subtitle, and optional right-side text. Returns the y where content starts. */
export async function header(ctx: SKRSContext2D, options: { icon: string; title: string; subtitle: string; right?: string; rightSub?: string }) {
  fillRoundRect(ctx, PAD, 38, 76, 76, 20, TILE);
  await drawIcon(ctx, options.icon, PAD + 14, 52, 48);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font('Bold', 34);
  ctx.fillStyle = palette.text;
  ctx.fillText(fitText(ctx, options.title, 560), PAD + 98, 76);
  ctx.font = font('Medium', 20);
  ctx.fillStyle = palette.muted;
  ctx.fillText(fitText(ctx, options.subtitle, 600), PAD + 98, 106);
  if (options.right) {
    ctx.textAlign = 'right';
    ctx.font = font('Bold', 34);
    ctx.fillStyle = palette.text;
    ctx.fillText(options.right, WIDTH - PAD, 76);
    if (options.rightSub) {
      ctx.font = font('SemiBold', 15);
      ctx.fillStyle = palette.muted;
      ctx.fillText(options.rightSub.toUpperCase(), WIDTH - PAD, 104);
    }
    ctx.textAlign = 'left';
  }
  return 140;
}

/** One-line message strip (e.g. "Sold 12 items for 340 credits"). Returns its height. */
export function banner(ctx: SKRSContext2D, y: number, b: Banner) {
  const color = TONES[b.tone];
  fillRoundRect(ctx, PAD, y, WIDTH - PAD * 2, 56, 16, TILE);
  fillRoundRect(ctx, PAD, y + 12, 6, 32, 3, color);
  ctx.font = font('SemiBold', 20);
  ctx.fillStyle = palette.text;
  ctx.textBaseline = 'middle';
  ctx.fillText(fitText(ctx, b.text, WIDTH - PAD * 2 - 60), PAD + 28, y + 29);
  ctx.textBaseline = 'alphabetic';
  return 56 + 16;
}

export function sectionLabel(ctx: SKRSContext2D, y: number, label: string, right?: string) {
  ctx.font = font('SemiBold', 16);
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'left';
  ctx.fillText(label.toUpperCase(), PAD + 4, y + 16);
  if (right) {
    ctx.textAlign = 'right';
    ctx.fillText(right.toUpperCase(), WIDTH - PAD - 4, y + 16);
    ctx.textAlign = 'left';
  }
  return 32;
}

/** Bottom bar: bag, credits, zone on the left; active boosts on the right. */
export async function statusBar(ctx: SKRSContext2D, height: number, frame: GameFrame) {
  const top = height - STATUS_HEIGHT;
  ctx.fillStyle = palette.border;
  ctx.fillRect(PAD, top, WIDTH - PAD * 2, 2);
  const mid = top + STATUS_HEIGHT / 2 + 1;

  let x = PAD;
  const item = async (icon: string, label: string) => {
    await drawIcon(ctx, icon, x, mid - 14, 28);
    ctx.font = font('SemiBold', 20);
    ctx.fillStyle = palette.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 38, mid + 1);
    ctx.textBaseline = 'alphabetic';
    x += 38 + ctx.measureText(label).width + 30;
  };
  await item('1f392', `${formatNumber(frame.status.bag)} in bag`);
  await item('1fa99', formatNumber(frame.status.credits));
  await item(frame.status.zone.icon, frame.status.zone.name);

  // Boosts, right-aligned pills
  let right = WIDTH - PAD;
  for (const boost of [...frame.status.boosts].reverse()) {
    ctx.font = font('SemiBold', 18);
    const w = 16 + 26 + 8 + ctx.measureText(boost.text).width + 16;
    if (right - w < x) break;
    fillRoundRect(ctx, right - w, mid - 20, w, 40, 20, TILE);
    roundRect(ctx, right - w, mid - 20, w, 40, 20);
    ctx.strokeStyle = stripeColor(frame);
    ctx.lineWidth = 2;
    ctx.stroke();
    await drawIcon(ctx, boost.icon, right - w + 14, mid - 13, 26);
    ctx.fillStyle = palette.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(boost.text, right - w + 48, mid + 1);
    ctx.textBaseline = 'alphabetic';
    right -= w + 10;
  }
}

/* ─────────────── Item grid (bag + collection) ─────────────── */

export interface ItemTile {
  icon: string;
  name: string;
  /** Rarity color */
  color: number;
  /** Small colored label, e.g. "RARE" */
  label: string;
  /** Muted text after the label, e.g. "×5" */
  detail?: string;
  /** Big number at the bottom (bag value) */
  value?: number;
  /** Top-right count bubble */
  count?: number;
  shiny?: boolean;
  hot?: boolean;
  /** Not found yet — drawn as a silhouette */
  unknown?: boolean;
}

export const GRID_COLS = 4;
const GAP = 16;
const TILE_W = (WIDTH - PAD * 2 - GAP * (GRID_COLS - 1)) / GRID_COLS;

export const gridHeight = (count: number, tileH: number) => Math.ceil(count / GRID_COLS) * (tileH + GAP) - GAP;

export async function itemGrid(ctx: SKRSContext2D, y: number, tiles: ItemTile[], tileH: number) {
  for (const [i, t] of tiles.entries()) {
    const x = PAD + (i % GRID_COLS) * (TILE_W + GAP);
    const ty = y + Math.floor(i / GRID_COLS) * (tileH + GAP);
    const color = hex(t.color);

    fillRoundRect(ctx, x, ty, TILE_W, tileH, 20, TILE);
    roundRect(ctx, x + 1, ty + 1, TILE_W - 2, tileH - 2, 20);
    ctx.strokeStyle = t.unknown ? TILE_BORDER : t.shiny ? palette.gold : color;
    ctx.lineWidth = t.shiny ? 3 : 2;
    ctx.stroke();

    const iconSize = 76;
    if (t.unknown) await drawSilhouette(ctx, t.icon, x + (TILE_W - iconSize) / 2, ty + 22, iconSize);
    else await drawIcon(ctx, t.icon, x + (TILE_W - iconSize) / 2, ty + 22, iconSize);

    // Corner tags
    let tagX = x + 12;
    if (t.shiny) tagX += pill(ctx, tagX, ty + 12, 'SHINY', palette.gold, palette.background, 12) + 6;
    if (t.hot) pill(ctx, tagX, ty + 12, 'HOT 3×', '#fb923c', palette.background, 12);
    if (t.count !== undefined) pill(ctx, x + TILE_W - 12, ty + 12, `×${formatNumber(t.count)}`, 'rgba(255,255,255,0.12)', palette.text, 13, 'right');

    ctx.textAlign = 'center';
    ctx.font = font('SemiBold', 20);
    ctx.fillStyle = t.unknown ? palette.muted : palette.text;
    ctx.fillText(fitText(ctx, t.unknown ? '???' : t.name, TILE_W - 24), x + TILE_W / 2, ty + 132);

    ctx.font = font('Bold', 13);
    const label = t.label;
    const detail = t.detail ? `  ·  ${t.detail}` : '';
    const labelW = ctx.measureText(label).width;
    ctx.font = font('Medium', 14);
    const detailW = ctx.measureText(detail).width;
    const start = x + TILE_W / 2 - (labelW + detailW) / 2;
    ctx.textAlign = 'left';
    ctx.font = font('Bold', 13);
    ctx.fillStyle = t.unknown ? palette.muted : color;
    ctx.fillText(label, start, ty + 158);
    ctx.font = font('Medium', 14);
    ctx.fillStyle = palette.muted;
    ctx.fillText(detail, start + labelW, ty + 158);

    if (t.value !== undefined) {
      ctx.font = font('Bold', 20);
      const text = formatNumber(t.value);
      const w = 24 + 8 + ctx.measureText(text).width;
      const vx = x + TILE_W / 2 - w / 2;
      await drawIcon(ctx, '1fa99', vx, ty + tileH - 42, 24);
      ctx.fillStyle = palette.text;
      ctx.fillText(text, vx + 32, ty + tileH - 22);
    }
  }
}

/* ─────────────── Shop rows ─────────────── */

export interface ShopRow {
  icon: string;
  name: string;
  detail: string;
  /** Detail text color (defaults to muted) */
  detailColor?: string;
  price?: number;
  /** Old price, shown crossed out */
  was?: number;
  /** Shown instead of a price, e.g. "EQUIPPED" */
  status?: string;
  statusTone?: 'accent' | 'muted' | 'good' | 'locked';
  /** Upgrade level pips */
  pips?: { filled: number; total: number };
  /** Crate odds bar */
  odds?: Array<{ color: number; percent: number; label: string }>;
  /** Small tag next to the name, e.g. "40% OFF" */
  tag?: { text: string; color: string };
  /** Number on the button for this row (matches the buttons below) */
  key?: number;
  affordable?: boolean;
  dim?: boolean;
}

export const ROW_H = 104;
const ROW_GAP = 12;
export const rowsHeight = (count: number) => count * (ROW_H + ROW_GAP) - ROW_GAP;

export async function shopRows(ctx: SKRSContext2D, y: number, rows: ShopRow[], accent: string) {
  for (const [i, r] of rows.entries()) {
    const ry = y + i * (ROW_H + ROW_GAP);
    const w = WIDTH - PAD * 2;
    fillRoundRect(ctx, PAD, ry, w, ROW_H, 20, TILE);
    if (r.status === 'EQUIPPED') {
      roundRect(ctx, PAD + 1, ry + 1, w - 2, ROW_H - 2, 20);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    let x = PAD + 20;
    if (r.key !== undefined) {
      fillRoundRect(ctx, x, ry + ROW_H / 2 - 16, 32, 32, 10, 'rgba(255,255,255,0.08)');
      ctx.font = font('Bold', 17);
      ctx.fillStyle = palette.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(r.key), x + 16, ry + ROW_H / 2 + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      x += 48;
    }
    await drawIcon(ctx, r.icon, x, ry + (ROW_H - 60) / 2, 60, r.dim ? 0.45 : 1);
    x += 80;

    // Name + tag + pips
    ctx.font = font('Bold', 25);
    ctx.fillStyle = r.dim ? palette.muted : palette.text;
    const name = fitText(ctx, r.name, 360);
    ctx.fillText(name, x, ry + 44);
    let after = x + ctx.measureText(name).width + 14;
    if (r.tag) after += pill(ctx, after, ry + 23, r.tag.text, r.tag.color, palette.background, 12) + 10;
    if (r.pips) {
      for (let p = 0; p < r.pips.total; p++) {
        fillRoundRect(ctx, after + p * 17, ry + 30, 12, 10, 3, p < r.pips.filled ? accent : palette.track);
      }
    }

    // Detail line (or odds bar)
    if (r.odds) {
      let ox = x;
      ctx.font = font('SemiBold', 17);
      for (const o of r.odds) {
        const label = `${o.label} ${o.percent}%`;
        ctx.fillStyle = hex(o.color);
        ctx.fillText(label, ox, ry + 74);
        ox += ctx.measureText(label).width + 18;
      }
      let bx = x;
      const bw = 340;
      for (const o of r.odds) {
        const seg = (bw * o.percent) / 100;
        ctx.fillStyle = hex(o.color);
        ctx.fillRect(bx, ry + 84, Math.max(2, seg - 2), 6);
        bx += seg;
      }
    } else {
      ctx.font = font('Medium', 18);
      ctx.fillStyle = r.detailColor ?? palette.muted;
      ctx.fillText(fitText(ctx, r.detail, 520), x, ry + 76);
    }

    // Right side: status pill or price
    const rx = PAD + w - 24;
    if (r.status) {
      const tone = r.statusTone ?? 'muted';
      const bg = tone === 'accent' ? accent : tone === 'good' ? '#4ade80' : 'rgba(255,255,255,0.1)';
      const fg = tone === 'muted' || tone === 'locked' ? palette.muted : palette.background;
      if (tone === 'locked') {
        ctx.font = font('Bold', 15);
        const pw = ctx.measureText(r.status).width + 15 * 1.6 + 28;
        fillRoundRect(ctx, rx - pw, ry + ROW_H / 2 - 14, pw, 28.5, 14, 'rgba(255,255,255,0.06)');
        await drawIcon(ctx, '1f512', rx - pw + 10, ry + ROW_H / 2 - 10, 20);
        ctx.fillStyle = palette.muted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.status, rx - 12, ry + ROW_H / 2 + 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      } else pill(ctx, rx, ry + ROW_H / 2 - 14, r.status, bg, fg, 15, 'right');
    } else if (r.price !== undefined) {
      ctx.textAlign = 'right';
      ctx.font = font('Bold', 26);
      ctx.fillStyle = r.affordable === false ? '#f87171' : palette.text;
      const text = r.price === 0 ? 'Free' : formatNumber(r.price);
      ctx.fillText(text, rx, ry + (r.was ? 66 : 62));
      const tw = ctx.measureText(text).width;
      if (r.price) await drawIcon(ctx, '1fa99', rx - tw - 36, ry + (r.was ? 42 : 38), 28);
      if (r.was) {
        ctx.font = font('Medium', 17);
        ctx.fillStyle = palette.muted;
        const was = formatNumber(r.was);
        ctx.fillText(was, rx, ry + 34);
        const ww = ctx.measureText(was).width;
        ctx.fillRect(rx - ww, ry + 28, ww, 2);
      }
      ctx.textAlign = 'left';
    }
  }
}

export { createCanvas };
