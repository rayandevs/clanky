import type { APIMessageComponentEmoji } from 'discord.js';
import raw from './emojis.json' with { type: 'json' };

/**
 * Emoji registry.
 *
 * Every emoji Clanky uses lives in `emojis.json`. Each entry can point at a
 * custom Discord emoji (set `id`, `name` and `animated`) — until then the
 * Unicode `fallback` is used. Swap in your own application emojis without
 * touching any code.
 */
export interface EmojiEntry {
  id: string | null;
  name: string;
  fallback: string;
  animated?: boolean;
}

export type EmojiKey = keyof typeof raw;

const registry = raw as Record<EmojiKey, EmojiEntry>;

/** Inline emoji for message text, e.g. `${emoji('success')} Saved` */
export function emoji(key: EmojiKey): string {
  const entry = registry[key];
  if (!entry) return '';
  return entry.id ? `<${entry.animated ? 'a' : ''}:${entry.name}:${entry.id}>` : entry.fallback;
}

/** Emoji object for buttons and select menu options. */
export function componentEmoji(key: EmojiKey): APIMessageComponentEmoji {
  const entry = registry[key];
  return entry.id ? { id: entry.id, name: entry.name, animated: entry.animated ?? false } : { name: entry.fallback };
}
