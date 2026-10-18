import { fileURLToPath } from 'node:url';
import { GlobalFonts, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { createLogger } from '../core/logger.js';

const log = createLogger('render');

/* ─────────────── Fonts ─────────────── */

const FONT_DIR = fileURLToPath(new URL('../../assets/fonts/', import.meta.url));
let fontsReady = false;

export function ensureFonts(): void {
  if (fontsReady) return;
  for (const weight of ['Medium', 'SemiBold', 'Bold']) {
    GlobalFonts.registerFromPath(`${FONT_DIR}Poppins-${weight}.ttf`, `Poppins ${weight}`);
  }
  fontsReady = true;
}

export const font = (weight: 'Medium' | 'SemiBold' | 'Bold', size: number) => `${size}px "Poppins ${weight}", sans-serif`;

/* ─────────────── Palette ─────────────── */

export const palette = {
  background: '#111118',
  surface: '#191923',
  surfaceHighlight: '#1F1F2C',
  border: '#262633',
  track: '#2A2A38',
  text: '#FFFFFF',
  muted: '#8C8CA1',
  gold: '#F5C451',
  silver: '#C9CED6',
  bronze: '#D08A4E',
} as const;

export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/* ─────────────── Drawing helpers ─────────────── */

export function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function fillRoundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number, color: string): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Progress bar with a solid fill. */
export function progressBar(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, ratio: number, color: string): void {
  fillRoundRect(ctx, x, y, w, h, h / 2, palette.track);
  const clamped = Math.max(0, Math.min(1, ratio));
  if (clamped > 0) fillRoundRect(ctx, x, y, Math.max(h, w * clamped), h, h / 2, color);
}

/** Shortens text with "…" until it fits. */
export function fitText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

/** Wraps text to a bounded number of lines, clipping the last line with an ellipsis. */
export function wrapText(ctx: SKRSContext2D, value: string, maxWidth: number, maxLines: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let clipped = false;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(fitText(ctx, line, maxWidth));
    line = word;
    if (lines.length >= maxLines) {
      clipped = true;
      break;
    }
  }
  if (line && lines.length < maxLines) lines.push(fitText(ctx, line, maxWidth));
  if (clipped) {
    const last = lines.length - 1;
    if (last >= 0) {
      let text = lines[last]!;
      while (text && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
      lines[last] = `${text}…`;
    }
  }
  return lines;
}

/** Draws an image clipped to a circle. Falls back to a plain circle. */
export function circleImage(ctx: SKRSContext2D, image: Image | null, cx: number, cy: number, radius: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (image) ctx.drawImage(image, cx - radius, cy - radius, radius * 2, radius * 2);
  else {
    ctx.fillStyle = palette.track;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}

/** Downloads an image (e.g. an avatar). Returns null on failure or timeout. */
export async function fetchImage(url: string | null | undefined, timeoutMs = 4000): Promise<Image | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return await loadImage(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    log.debug(`Could not load image ${url}`, error);
    return null;
  }
}

export const formatNumber = (value: number) => value.toLocaleString('en-US');
