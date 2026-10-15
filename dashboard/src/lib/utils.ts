import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const DEMO = import.meta.env.MODE === 'demo';
/** Root-relative in production, relative inside the demo preview. */
export const asset = (path: string) => (DEMO ? `./${path}` : `/${path}`);

/** Twemoji code point(s) for an emoji, e.g. "⚙️" → "2699". */
export function emojiCode(emoji: string): string {
  return [...emoji]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
    .join('-');
}
export const twemoji = (emoji: string) => asset(`icons/${emojiCode(emoji)}.svg`);

export const n = (value: number) => value.toLocaleString('en-US');
export const compact = (value: number) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export function ago(date: string | Date): string {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  const units: Array<[number, string]> = [[60, 'm'], [3600, 'h'], [86400, 'd'], [604800, 'w']];
  let label = `${Math.floor(s / 60)}m`;
  for (const [size, unit] of units) if (s >= size) label = `${Math.floor(s / size)}${unit}`;
  return `${label} ago`;
}

export function duration(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

/** Module emoji keys (from the bot's emojis.json) to real emoji. */
export const MODULE_EMOJI: Record<string, string> = {
  settings: '⚙️', shield: '🛡️', automod: '🤖', log: '📋', welcome: '👋', ticket: '🎫',
  suggestion: '💡', level: '⭐', role: '🎭', reminder: '⏰', game: '🎮', poll: '📊',
};
