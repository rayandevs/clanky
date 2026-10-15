import { fillRoundRect, fitText, font, formatNumber, hex, palette, progressBar, roundRect } from './canvas.js';
import {
  PAD,
  STATUS_HEIGHT,
  TILE,
  WIDTH,
  banner,
  drawIcon,
  drawSilhouette,
  gameCanvas,
  gridHeight,
  header,
  hazardStripe,
  itemGrid,
  rowsHeight,
  sectionLabel,
  shopRows,
  statusBar,
  stripeColor,
  type Banner,
  type GameFrame,
  type ItemTile,
  type ShopRow,
} from './game.js';

const TILE_H = 196;
const BOTTOM = 28;

/* ─────────────── Collection ─────────────── */

export interface CollectionCardData {
  frame: GameFrame;
  zone: { name: string; icon: string };
  found: number;
  total: number;
  foundAll: number;
  totalAll: number;
  tiles: ItemTile[];
}

export async function renderCollectionCard(data: CollectionCardData): Promise<Buffer> {
  const height = 140 + 36 + gridHeight(data.tiles.length, TILE_H) + BOTTOM + STATUS_HEIGHT;
  const { canvas, ctx } = gameCanvas(height, data.frame);
  let y = await header(ctx, {
    icon: data.zone.icon,
    title: `${data.zone.name} collection`,
    subtitle: `${data.foundAll} of ${data.totalAll} found across all zones`,
    right: `${data.found}/${data.total}`,
    rightSub: 'found here',
  });
  progressBar(ctx, PAD, y - 6, WIDTH - PAD * 2, 10, data.total ? data.found / data.total : 0, stripeColor(data.frame));
  y += 30;
  await itemGrid(ctx, y, data.tiles, TILE_H);
  await statusBar(ctx, height, data.frame);
  return canvas.toBuffer('image/png');
}

/* ─────────────── Bag ─────────────── */

export interface BagCardData {
  frame: GameFrame;
  items: number;
  worth: number;
  page: number;
  pages: number;
  tiles: ItemTile[];
  banner?: Banner;
  hot: { name: string; icon: string };
}

export async function renderBagCard(data: BagCardData): Promise<Buffer> {
  const empty = data.tiles.length === 0;
  const body = empty ? 220 : gridHeight(data.tiles.length, TILE_H + 36);
  const height = 140 + (data.banner ? 72 : 0) + 72 + body + BOTTOM + STATUS_HEIGHT;
  const { canvas, ctx } = gameCanvas(height, data.frame);
  let y = await header(ctx, {
    icon: '1f392',
    title: 'Your bag',
    subtitle: empty ? 'Nothing here yet' : `${formatNumber(data.items)} items · worth ${formatNumber(data.worth)} credits`,
    right: data.pages > 1 ? `${data.page + 1}/${data.pages}` : undefined,
    rightSub: data.pages > 1 ? 'page' : undefined,
  });
  if (data.banner) y += banner(ctx, y, data.banner);

  // Hot item strip
  fillRoundRect(ctx, PAD, y, WIDTH - PAD * 2, 56, 16, TILE);
  await drawIcon(ctx, '1f525', PAD + 16, y + 12, 32);
  await drawIcon(ctx, data.hot.icon, PAD + 56, y + 12, 32);
  ctx.font = font('SemiBold', 20);
  ctx.fillStyle = palette.text;
  ctx.textBaseline = 'middle';
  ctx.fillText(`${data.hot.name} sells for 3× today`, PAD + 102, y + 29);
  ctx.textBaseline = 'alphabetic';
  y += 72;

  if (empty) {
    await drawIcon(ctx, '1f527', WIDTH / 2 - 48, y + 20, 96);
    ctx.textAlign = 'center';
    ctx.font = font('Bold', 28);
    ctx.fillStyle = palette.text;
    ctx.fillText('Your bag is empty', WIDTH / 2, y + 162);
    ctx.font = font('Medium', 20);
    ctx.fillStyle = palette.muted;
    ctx.fillText('Press Dig to find some loot', WIDTH / 2, y + 196);
    ctx.textAlign = 'left';
  } else {
    await itemGrid(ctx, y, data.tiles, TILE_H + 36);
  }
  await statusBar(ctx, height, data.frame);
  return canvas.toBuffer('image/png');
}

/* ─────────────── Shop ─────────────── */

export interface ThemeSwatch {
  name: string;
  stripe: string;
  background: string;
  status: string;
  tone: 'accent' | 'muted' | 'locked' | 'price';
}

export interface TitleChip {
  name: string;
  status: string;
  tone: 'accent' | 'muted' | 'locked' | 'price';
}

export interface BadgeTile {
  name: string;
  icon: string;
  earned: boolean;
}

export interface ShopCardData {
  frame: GameFrame;
  tab: { icon: string; title: string; subtitle: string };
  banner?: Banner;
  /** Black Market hot item strip */
  hot?: { name: string; icon: string; resetIn: string };
  rows?: ShopRow[];
  cosmetics?: { themes: ThemeSwatch[]; titles: TitleChip[]; badges: BadgeTile[] };
  note?: string;
}

const SWATCH_H = 128;
const CHIP_H = 60;
const BADGE_H = 132;

function cosmeticsHeight(c: NonNullable<ShopCardData['cosmetics']>) {
  return (
    32 + Math.ceil(c.themes.length / 3) * (SWATCH_H + 16) + 12 +
    32 + Math.ceil(c.titles.length / 2) * (CHIP_H + 12) + 12 +
    32 + BADGE_H
  );
}

function statusText(ctx: CanvasRenderingContext2DLike, x: number, y: number, status: string, tone: ThemeSwatch['tone'], accent: string, align: 'left' | 'right' = 'left') {
  ctx.font = font('SemiBold', 17);
  ctx.fillStyle = tone === 'accent' ? accent : tone === 'price' ? palette.text : palette.muted;
  ctx.textAlign = align;
  ctx.fillText(status, x, y);
  ctx.textAlign = 'left';
}
type CanvasRenderingContext2DLike = Parameters<typeof fitText>[0];

export async function renderShopCard(data: ShopCardData): Promise<Buffer> {
  const rows = data.rows ?? [];
  let body = 0;
  if (data.banner) body += 72;
  if (data.hot) body += 72;
  if (rows.length) body += rowsHeight(rows.length);
  if (data.cosmetics) body += cosmeticsHeight(data.cosmetics);
  if (data.note) body += 40;
  const height = 140 + body + BOTTOM + STATUS_HEIGHT;

  const { canvas, ctx } = gameCanvas(height, data.frame);
  const accent = stripeColor(data.frame);
  let y = await header(ctx, { icon: data.tab.icon, title: data.tab.title, subtitle: data.tab.subtitle, right: formatNumber(data.frame.status.credits), rightSub: 'credits' });
  if (data.banner) y += banner(ctx, y, data.banner);

  if (data.hot) {
    fillRoundRect(ctx, PAD, y, WIDTH - PAD * 2, 56, 16, TILE);
    roundRect(ctx, PAD + 1, y + 1, WIDTH - PAD * 2 - 2, 54, 16);
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    ctx.stroke();
    await drawIcon(ctx, '1f525', PAD + 16, y + 12, 32);
    await drawIcon(ctx, data.hot.icon, PAD + 56, y + 12, 32);
    ctx.font = font('SemiBold', 20);
    ctx.fillStyle = palette.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(`Hot item: ${data.hot.name} sells for 3×`, PAD + 102, y + 29);
    ctx.textAlign = 'right';
    ctx.font = font('Medium', 18);
    ctx.fillStyle = palette.muted;
    ctx.fillText(`New deals in ${data.hot.resetIn}`, WIDTH - PAD - 20, y + 29);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    y += 72;
  }

  if (rows.length) {
    await shopRows(ctx, y, rows, accent);
    y += rowsHeight(rows.length);
  }

  if (data.cosmetics) {
    const c = data.cosmetics;
    y += sectionLabel(ctx, y, 'Profile themes');
    const sw = (WIDTH - PAD * 2 - 32) / 3;
    for (const [i, t] of c.themes.entries()) {
      const x = PAD + (i % 3) * (sw + 16);
      const ty = y + Math.floor(i / 3) * (SWATCH_H + 16);
      fillRoundRect(ctx, x, ty, sw, SWATCH_H, 20, TILE);
      if (t.tone === 'accent') {
        roundRect(ctx, x + 1, ty + 1, sw - 2, SWATCH_H - 2, 20);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Mini card preview
      ctx.save();
      ctx.translate(x + 16, ty + 16);
      fillRoundRect(ctx, 0, 0, 96, 96, 16, t.background);
      roundRect(ctx, 0, 0, 96, 96, 16);
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 2;
      ctx.stroke();
      hazardStripe(ctx, 96, 96, t.stripe);
      fillRoundRect(ctx, 14, 30, 32, 32, 16, t.stripe);
      fillRoundRect(ctx, 14, 72, 68, 8, 4, t.stripe);
      ctx.restore();
      ctx.font = font('Bold', 22);
      ctx.fillStyle = t.tone === 'locked' ? palette.muted : palette.text;
      ctx.fillText(fitText(ctx, t.name, sw - 150), x + 128, ty + 56);
      if (t.tone === 'locked') {
        await drawIcon(ctx, '1f512', x + 128, ty + 72, 20);
        statusText(ctx, x + 154, ty + 89, t.status, t.tone, accent);
      } else if (t.tone === 'price') {
        await drawIcon(ctx, '1fa99', x + 128, ty + 72, 20);
        statusText(ctx, x + 154, ty + 89, t.status, t.tone, accent);
      } else statusText(ctx, x + 128, ty + 89, t.status, t.tone, accent);
    }
    y += Math.ceil(c.themes.length / 3) * (SWATCH_H + 16) + 12;

    y += sectionLabel(ctx, y, 'Titles');
    const cw = (WIDTH - PAD * 2 - 16) / 2;
    for (const [i, t] of c.titles.entries()) {
      const x = PAD + (i % 2) * (cw + 16);
      const ty = y + Math.floor(i / 2) * (CHIP_H + 12);
      fillRoundRect(ctx, x, ty, cw, CHIP_H, 16, TILE);
      if (t.tone === 'accent') {
        roundRect(ctx, x + 1, ty + 1, cw - 2, CHIP_H - 2, 16);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.font = font('SemiBold', 20);
      ctx.fillStyle = t.tone === 'locked' ? palette.muted : palette.text;
      ctx.fillText(fitText(ctx, t.name, cw - 220), x + 20, ty + 38);
      statusText(ctx, x + cw - 20, ty + 37, t.status, t.tone, accent, 'right');
      if (t.tone === 'locked' || t.tone === 'price') {
        ctx.font = font('SemiBold', 17);
        const w = ctx.measureText(t.status).width;
        await drawIcon(ctx, t.tone === 'locked' ? '1f512' : '1fa99', x + cw - 20 - w - 28, ty + 20, 20);
      }
    }
    y += Math.ceil(c.titles.length / 2) * (CHIP_H + 12) + 12;

    y += sectionLabel(ctx, y, 'Badges', 'Earned by playing');
    const bw = (WIDTH - PAD * 2 - 16 * (c.badges.length - 1)) / c.badges.length;
    for (const [i, b] of c.badges.entries()) {
      const x = PAD + i * (bw + 16);
      fillRoundRect(ctx, x, y, bw, BADGE_H, 18, TILE);
      if (b.earned) await drawIcon(ctx, b.icon, x + bw / 2 - 28, y + 18, 56);
      else await drawSilhouette(ctx, b.icon, x + bw / 2 - 28, y + 18, 56);
      ctx.textAlign = 'center';
      ctx.font = font('SemiBold', 15);
      ctx.fillStyle = b.earned ? palette.text : palette.muted;
      ctx.fillText(fitText(ctx, b.name, bw - 16), x + bw / 2, y + 106);
      ctx.textAlign = 'left';
    }
    y += BADGE_H;
  }

  if (data.note) {
    ctx.font = font('Medium', 18);
    ctx.fillStyle = palette.muted;
    ctx.fillText(fitText(ctx, data.note, WIDTH - PAD * 2), PAD + 4, y + 30);
  }

  await statusBar(ctx, height, data.frame);
  return canvas.toBuffer('image/png');
}

export { hex };
