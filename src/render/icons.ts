import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadImage, type Image } from '@napi-rs/canvas';

/**
 * Twemoji icons (assets/icons, CC-BY 4.0) for image cards anywhere in the bot.
 * Pass the emoji's code point, e.g. "1f529" for 🔩.
 */
const ICON_DIR = fileURLToPath(new URL('../../assets/icons/', import.meta.url));
const cache = new Map<string, Promise<Image | null>>();

export function loadIcon(code: string): Promise<Image | null> {
  let icon = cache.get(code);
  if (!icon) {
    icon = readFile(`${ICON_DIR}${code}.svg`, 'utf8')
      // Rasterize large so icons stay sharp at any size.
      .then((svg) => loadImage(Buffer.from(svg.replace('<svg ', '<svg width="512" height="512" '))))
      .catch(() => null);
    cache.set(code, icon);
  }
  return icon;
}

/** Code point(s) of a Unicode emoji, Twemoji style ("⚙️" → "2699"). */
export function iconCode(emoji: string): string {
  return [...emoji]
    .map((c) => c.codePointAt(0)!)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
    .join('-');
}
