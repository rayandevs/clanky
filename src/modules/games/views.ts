import {
  AttachmentBuilder,
  ButtonStyle,
  ContainerBuilder,
  StringSelectMenuBuilder,
  type ActionRowBuilder,
  type ButtonBuilder,
  type Client,
  type MessageActionRowComponentBuilder,
  type Guild,
  type User,
} from 'discord.js';
import { cid } from '../../core/customId.js';
import { formatDuration, timestamp } from '../../core/time.js';
import type { GamePlayerRecord } from '../../database/models/index.js';
import {
  BADGES,
  BALANCE,
  BOOSTS,
  CRATES,
  ITEMS,
  MARKET,
  RARITY,
  THEMES,
  THEME_BY_ID,
  TITLES,
  TITLE_BY_ID,
  TOOLS,
  UPGRADES,
  ZONES,
  ZONE_BY_ID,
  gameLevel,
  itemsInZone,
  upgradeCost,
  type Zone,
} from '../../games/salvage/data.js';
import { renderFindCard } from '../../render/findCard.js';
import type { Banner, GameFrame, ItemTile, ShopRow } from '../../render/game.js';
import { iconCode } from '../../render/icons.js';
import { renderLeaderboard } from '../../render/leaderboard.js';
import { renderProfileCard } from '../../render/profileCard.js';
import { renderBagCard, renderCollectionCard, renderShopCard, type BadgeTile, type ThemeSwatch, type TitleChip } from '../../render/salvageCards.js';
import {
  boostsOf,
  digCooldown,
  findValue,
  golemWinChance,
  hotItem,
  nextReset,
  salvage,
  sellBonus,
  sellValue,
  shinyOdds,
  toolOf,
  upgradeLevel,
  zoneOf,
  type Find,
  type GrantResult,
} from '../../services/SalvageService.js';
import { button, panel, row, text } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';

/* Custom IDs: sv:<action>:<ownerId>:...args */
export const svid = (action: string, owner: string, ...args: Array<string | number>) => cid('sv', action, owner, ...args);

export interface View {
  components: ContainerBuilder[];
  files: AttachmentBuilder[];
}

export type Note = Banner;
type AnyRow = ActionRowBuilder<MessageActionRowComponentBuilder>;

const n = (value: number) => value.toLocaleString('en-US');
const credits = (value: number) => `${emoji('credits')} **${n(value)}**`;
const findName = (find: Find) => `${find.shiny ? `${emoji('sparkles')} Shiny ` : ''}${find.item.emoji} **${find.item.name}**`;

/** Dig / Bag / Shop / Profile — shown under most game screens. */
export function navRow(owner: string, current?: 'bag' | 'shop' | 'profile' | 'collection') {
  return row(
    button({ id: svid('dig', owner), label: 'Dig', emoji: 'dig', style: ButtonStyle.Primary }),
    button({ id: svid('bag', owner, 0), label: 'Bag', emoji: 'bag', disabled: current === 'bag' }),
    button({ id: svid('shop', owner, 'market'), label: 'Shop', emoji: 'shop' }),
    button({ id: svid('profile', owner), label: 'Profile', emoji: 'user', disabled: current === 'profile' }),
  );
}

const bagCount = (player: GamePlayerRecord) => Object.values(player.inventory ?? {}).reduce((sum, c) => sum + Math.max(0, c), 0);

const BOOST_SHORT = { luck: 'Luck', xp: '2× XP', bait: 'Bait' } as const;

/** Theme + status bar info shared by every game image. */
export function frameOf(player: GamePlayerRecord, accent: number): GameFrame {
  const theme = THEME_BY_ID.get(player.theme) ?? THEMES[0]!;
  const zone = zoneOf(player);
  const boosts = boostsOf(player);
  return {
    accent,
    theme: { stripe: theme.stripe, background: theme.background },
    status: {
      bag: bagCount(player),
      credits: player.credits,
      zone: { name: zone.name, icon: iconCode(zone.emoji) },
      boosts: BOOSTS.filter((b) => boosts[b.id] > 0).map((b) => ({ icon: iconCode(b.emoji), text: `${BOOST_SHORT[b.id]} · ${boosts[b.id]}` })),
    },
  };
}

/** A container that is just an image + rows of buttons. */
function imageView(file: string, image: Buffer, alt: string, accent: number, rows: AnyRow[], extra?: string): View {
  const container = new ContainerBuilder()
    .setAccentColor(accent)
    .addMediaGalleryComponents((g) => g.addItems((i) => i.setURL(`attachment://${file}`).setDescription(alt)));
  if (extra) container.addTextDisplayComponents(text(extra));
  for (const r of rows) container.addActionRowComponents(r);
  return { components: [container], files: [new AttachmentBuilder(image, { name: file })] };
}

/* ─────────────── Finds & events ─────────────── */

/** Result of a dig, crate or golem win. */
export async function findView(result: GrantResult, owner: string, accent: number, intro?: string, again?: ButtonBuilder): Promise<View> {
  const [main, ...extra] = [...result.finds].sort((a, b) => findValue(b) - findValue(a));
  const progress = gameLevel(result.player.xp);
  const image = await renderFindCard({
    icon: main!.item.icon,
    label: RARITY[main!.item.rarity].name.toUpperCase(),
    labelColor: RARITY[main!.item.rarity].color,
    title: main!.item.name,
    subtitle: `+${n(result.xp)} XP  ·  Worth ${n(sellValue(result.player, main!))} credits`,
    corner: ZONE_BY_ID.get(main!.item.zone)?.name ?? '',
    shiny: main!.shiny,
    level: progress.level,
    currentXp: progress.current,
    neededXp: progress.needed,
    frame: frameOf(result.player, accent),
  });

  // Only the moments worth celebrating get a line of text.
  const lines: string[] = [];
  if (intro) lines.push(intro);
  if (main!.shiny) lines.push(`${emoji('sparkles')} **Shiny!** Worth ${BALANCE.shinyMultiplier}× more.`);
  else if (main!.item.rarity === 'legendary') lines.push(`${emoji('party')} **Legendary find!**`);
  for (const find of extra) lines.push(`${emoji('lucky')} Double find! You also got ${findName(find)}.`);
  if (result.streak) lines.push(`${emoji('streak')} Day **${result.streak.days}** streak! +${credits(result.streak.bonus)}`);
  if (result.levelUp) {
    lines.push(`${emoji('level')} **Level ${result.levelUp.to}!** +${credits(result.levelUp.credits)}`);
    for (const zone of result.levelUp.zones) lines.push(`${emoji('zone')} New zone: ${zone.emoji} **${zone.name}**`);
    for (const tool of result.levelUp.tools) lines.push(`${emoji('tool')} New tool in the shop: ${tool.emoji} **${tool.name}**`);
  }

  const rows: AnyRow[] = again ? [row(again), navRow(owner)] : [navRow(owner)];
  const view = imageView('find.png', image, `Found: ${main!.item.name}`, RARITY[main!.item.rarity].color, rows, lines.length ? lines.join('\n') : undefined);
  return view;
}

const EVENTS = {
  golem: { icon: '1f47e', color: 0xf87171, title: 'Scrap Golem!', subtitle: "It's guarding some good loot. Fight it?" },
  crate: { icon: '1f4e6', color: 0x60a5fa, title: 'Mystery Crate', subtitle: 'Something rattles inside. Rare or better!' },
} as const;

export async function eventView(type: keyof typeof EVENTS, player: GamePlayerRecord, owner: string, accent: number): Promise<View> {
  const event = EVENTS[type];
  const progress = gameLevel(player.xp);
  const image = await renderFindCard({
    icon: event.icon,
    label: 'EVENT',
    labelColor: event.color,
    title: event.title,
    subtitle: type === 'golem' ? `${event.subtitle} (${Math.round(golemWinChance(player) * 100)}% win chance)` : event.subtitle,
    corner: zoneOf(player).name,
    level: progress.level,
    currentXp: progress.current,
    neededXp: progress.needed,
    frame: frameOf(player, accent),
  });
  const expires = player.pendingEvent?.expiresAt ?? new Date(Date.now() + BALANCE.eventTimeout * 1000);
  const buttons =
    type === 'golem'
      ? row(
          button({ id: svid('ev', owner, 'golem', 'fight'), label: 'Fight', emoji: 'fight', style: ButtonStyle.Danger }),
          button({ id: svid('ev', owner, 'golem', 'run'), label: 'Run', emoji: 'run' }),
        )
      : row(button({ id: svid('ev', owner, 'crate', 'open'), label: 'Open it', emoji: 'crate', style: ButtonStyle.Success }));
  return imageView('find.png', image, event.title, event.color, [buttons as AnyRow], `-# Decide ${timestamp(expires, 'R')}`);
}

/** Simple text screen with the nav row (golem loss, ran away…). */
export function messageView(_player: GamePlayerRecord, owner: string, accent: number, message: string): View {
  const container = new ContainerBuilder().setAccentColor(accent).addTextDisplayComponents(text(message)).addActionRowComponents(navRow(owner));
  return { components: [container], files: [] };
}

/* ─────────────── Bag ─────────────── */

const BAG_PAGE = 12;

export async function bagView(player: GamePlayerRecord, owner: string, accent: number, page = 0, note?: Note): Promise<View> {
  const bag = salvage.bag(player);
  const hot = hotItem();
  const pages = Math.max(1, Math.ceil(bag.length / BAG_PAGE));
  const safePage = Math.min(Math.max(0, page), pages - 1);

  const tiles: ItemTile[] = bag.slice(safePage * BAG_PAGE, (safePage + 1) * BAG_PAGE).map((e) => ({
    icon: e.item.icon,
    name: e.item.name,
    color: RARITY[e.item.rarity].color,
    label: RARITY[e.item.rarity].name.toUpperCase(),
    count: e.count,
    value: e.value,
    shiny: e.shiny,
    hot: e.item.id === hot.id,
  }));

  const image = await renderBagCard({
    frame: frameOf(player, accent),
    items: bagCount(player),
    worth: bag.reduce((sum, e) => sum + e.value, 0),
    page: safePage,
    pages,
    tiles,
    banner: note,
    hot: { name: hot.name, icon: hot.icon },
  });

  const rows: AnyRow[] = [];
  if (bag.length) {
    const buttons = [
      button({ id: svid('sell', owner, 'junk'), label: 'Sell junk', emoji: 'sell', style: ButtonStyle.Success }),
      button({ id: svid('sell', owner, 'all'), label: 'Sell all', emoji: 'sell' }),
    ];
    if (pages > 1) {
      buttons.push(
        button({ id: svid('bag', owner, safePage - 1), emoji: 'prev', disabled: safePage === 0 }),
        button({ id: svid('bag', owner, safePage + 1), emoji: 'next', disabled: safePage >= pages - 1 }),
      );
    }
    rows.push(row(...buttons));
  }
  rows.push(navRow(owner, 'bag'));
  return imageView('bag.png', image, 'Your bag', accent, rows, bag.length ? '-# **Sell junk** keeps Rare+ and shinies.' : undefined);
}

/* ─────────────── Shop ─────────────── */

export const SHOP_TABS = {
  market: { label: 'Black Market', emoji: '🕶️', icon: '1f576', description: 'New deals every day' },
  upgrades: { label: 'Upgrades', emoji: '⚡', icon: '26a1', description: 'Permanent boosts, 10 levels each' },
  boosts: { label: 'Boosts', emoji: '🍀', icon: '1f340', description: 'Power-ups for your next digs' },
  crates: { label: 'Crates', emoji: '📦', icon: '1f4e6', description: 'Guaranteed good loot' },
  tools: { label: 'Tools', emoji: '⛏️', icon: '26cf', description: 'Better luck and more XP' },
  cosmetics: { label: 'Cosmetics', emoji: '🎨', icon: '1f3a8', description: 'Make your profile card yours' },
} as const;
export type ShopTab = keyof typeof SHOP_TABS;

const pct = (value: number) => `${Math.round(value * 100)}%`;

function tabSelect(owner: string, tab: ShopTab) {
  return row(
    new StringSelectMenuBuilder()
      .setCustomId(svid('tab', owner))
      .setPlaceholder('Shop sections')
      .addOptions(
        (Object.keys(SHOP_TABS) as ShopTab[]).map((id) => ({
          label: SHOP_TABS[id].label,
          value: id,
          description: SHOP_TABS[id].description,
          emoji: { name: SHOP_TABS[id].emoji },
          default: id === tab,
        })),
      ),
  );
}

/** A buy button that matches the numbered row in the image. */
const buyButton = (id: string, key: number, label: string, enabled: boolean, style = ButtonStyle.Success) =>
  button({ id, label: `${key}. ${label}`, style: enabled ? style : ButtonStyle.Secondary, disabled: !enabled });

function upgradeEffect(player: GamePlayerRecord, id: (typeof UPGRADES)[number]['id'], level: number): string {
  const sim = { ...player, upgrades: { ...(player.upgrades ?? {}), [id]: level } };
  switch (id) {
    case 'turbo':
      return `${digCooldown(sim).toFixed(1)}s`;
    case 'detector':
      return `1 in ${shinyOdds(sim)}`;
    case 'haggler':
      return `+${pct(sellBonus(sim) - 1)}`;
    case 'armor':
      return pct(golemWinChance(sim));
  }
}

const lockText = (reason: string) => reason.replace(/\*\*/g, '').replace(/^Reach level (\d+) first\./, 'Level $1').replace(/ first.*$/, '');

export async function shopView(player: GamePlayerRecord, owner: string, accent: number, tab: ShopTab = 'market', note?: Note): Promise<View> {
  const info = SHOP_TABS[tab];
  const rows: ShopRow[] = [];
  const buttons: ButtonBuilder[] = [];
  const extraRows: AnyRow[] = [];
  let cosmetics: Parameters<typeof renderShopCard>[0]['cosmetics'];
  let hot: Parameters<typeof renderShopCard>[0]['hot'];
  let footnote: string | undefined;

  switch (tab) {
    case 'market': {
      const h = hotItem();
      hot = { name: h.name, icon: h.icon, resetIn: formatDuration(Math.ceil((nextReset().getTime() - Date.now()) / 60_000) * 60_000).split(' ').slice(0, 2).join(' ') };
      const bought = salvage.boughtToday(player);
      for (const [i, deal] of salvage.deals(player).entries()) {
        const sold = bought.includes(deal.slot);
        const key = i + 1;
        const ok = !sold && player.credits >= deal.price;
        if (deal.kind === 'boost') {
          const b = BOOSTS.find((x) => x.id === deal.id)!;
          rows.push({ key, icon: iconCode(b.emoji), name: b.name, detail: b.description, price: deal.price, was: deal.was, tag: { text: `${Math.round(MARKET.boostDiscount * 100)}% OFF`, color: '#4ade80' }, status: sold ? 'SOLD OUT' : undefined, affordable: ok, dim: sold });
          buttons.push(buyButton(svid('deal', owner, deal.slot), key, sold ? 'Sold out' : b.name, ok));
        } else if (deal.kind === 'crate') {
          const c = CRATES.find((x) => x.id === deal.id)!;
          rows.push({ key, icon: c.icon, name: c.name, detail: 'Opens right away', price: deal.price, was: deal.was, tag: { text: `${Math.round(MARKET.crateDiscount * 100)}% OFF`, color: '#4ade80' }, status: sold ? 'SOLD OUT' : undefined, affordable: ok, dim: sold });
          buttons.push(buyButton(svid('deal', owner, deal.slot), key, sold ? 'Sold out' : c.name, ok));
        } else {
          const isNew = !(player.found?.[deal.item.id] ?? 0);
          rows.push({
            key,
            icon: deal.item.icon,
            name: deal.item.name,
            detail: `${RARITY[deal.item.rarity].name} item`,
            detailColor: `#${RARITY[deal.item.rarity].color.toString(16)}`,
            price: deal.price,
            tag: isNew ? { text: 'NEW', color: '#60a5fa' } : undefined,
            status: sold ? 'SOLD OUT' : undefined,
            affordable: ok,
            dim: sold,
          });
          buttons.push(buyButton(svid('deal', owner, deal.slot), key, sold ? 'Sold out' : deal.item.name, ok));
        }
      }
      footnote = 'Your deals are personal. One of each per day.';
      break;
    }

    case 'upgrades':
      for (const [i, up] of UPGRADES.entries()) {
        const level = upgradeLevel(player, up.id);
        const max = level >= up.maxLevel;
        const cost = upgradeCost(up, level);
        const key = i + 1;
        const now = upgradeEffect(player, up.id, level);
        rows.push({
          key,
          icon: iconCode(up.emoji),
          name: up.name,
          detail: max ? `${up.description}: ${now}` : `${up.description}: ${now} · Next: ${upgradeEffect(player, up.id, level + 1)}`,
          pips: { filled: level, total: up.maxLevel },
          price: max ? undefined : cost,
          status: max ? 'MAXED' : undefined,
          statusTone: 'accent',
          affordable: player.credits >= cost,
        });
        buttons.push(buyButton(svid('up', owner, up.id), key, max ? 'Maxed' : up.name, !max && player.credits >= cost));
      }
      break;

    case 'boosts': {
      const active = boostsOf(player);
      for (const [i, b] of BOOSTS.entries()) {
        const full = active[b.id] + b.amount > b.cap;
        const key = i + 1;
        const amount = b.id === 'bait' ? '1 use' : `${b.amount} digs`;
        rows.push({
          key,
          icon: iconCode(b.emoji),
          name: b.name,
          detail: `${b.description} · ${amount}`,
          tag: active[b.id] ? { text: `${active[b.id]} LEFT`, color: '#4ade80' } : undefined,
          price: full ? undefined : b.price,
          status: full ? 'FULL' : undefined,
          affordable: player.credits >= b.price,
        });
        buttons.push(buyButton(svid('boost', owner, b.id), key, full ? 'Full' : b.name, !full && player.credits >= b.price));
      }
      footnote = 'Boosts are used up as you dig. Buy more to stack them.';
      break;
    }

    case 'crates':
      for (const [i, c] of CRATES.entries()) {
        const key = i + 1;
        rows.push({
          key,
          icon: c.icon,
          name: c.name,
          detail: '',
          odds: (Object.entries(c.odds) as Array<[keyof typeof RARITY, number]>).map(([r, p]) => ({ color: RARITY[r].color, percent: p, label: RARITY[r].name })),
          price: c.price,
          affordable: player.credits >= c.price,
        });
        buttons.push(buyButton(svid('crate', owner, c.id), key, `Open ${c.name.split(' ')[0]}`, player.credits >= c.price));
      }
      footnote = `Loot comes from your current zone: ${zoneOf(player).name}.`;
      break;

    case 'tools':
      for (const [i, tool] of TOOLS.entries()) {
        const owned = player.ownedTools.includes(tool.id);
        const equipped = player.tool === tool.id;
        const locked = !owned && player.level < tool.level;
        const key = i + 1;
        rows.push({
          key,
          icon: iconCode(tool.emoji),
          name: tool.name,
          detail: tool.luck === 1 ? 'The basics. Everyone starts here.' : `+${pct(tool.luck - 1)} luck · +${pct(tool.xpBoost - 1)} XP · ${pct(tool.doubleChance)} double finds`,
          price: owned || locked ? undefined : tool.price,
          status: equipped ? 'EQUIPPED' : owned ? 'OWNED' : locked ? `Level ${tool.level}` : undefined,
          statusTone: equipped ? 'accent' : locked ? 'locked' : 'muted',
          affordable: player.credits >= tool.price,
          dim: locked,
        });
        const label = equipped ? 'Equipped' : owned ? `Equip` : tool.name.split(' ')[0]!;
        buttons.push(buyButton(svid('buy', owner, tool.id), key, label, !equipped && (owned || (!locked && player.credits >= tool.price)), owned ? ButtonStyle.Primary : ButtonStyle.Success));
      }
      break;

    case 'cosmetics': {
      const ownedThemes = player.ownedThemes ?? ['hazard'];
      const ownedTitles = player.ownedTitles ?? ['rookie'];
      const themes: ThemeSwatch[] = THEMES.map((t) => {
        const owned = ownedThemes.includes(t.id);
        const lock = owned ? null : salvage.cosmeticLocked(player, 'theme', t.id);
        return {
          name: t.name,
          stripe: `#${(t.stripe ?? accent).toString(16).padStart(6, '0')}`,
          background: t.background,
          status: player.theme === t.id ? 'Equipped' : owned ? 'Owned' : lock ? lockText(lock) : t.price ? n(t.price) : 'Free',
          tone: player.theme === t.id ? 'accent' : owned ? 'muted' : lock ? 'locked' : 'price',
        };
      });
      const titles: TitleChip[] = TITLES.map((t) => {
        const owned = ownedTitles.includes(t.id);
        const lock = owned ? null : salvage.cosmeticLocked(player, 'title', t.id);
        return {
          name: t.name,
          status: player.title === t.id ? 'Equipped' : owned ? 'Owned' : lock ? (t.hint ?? lockText(lock)) : t.price ? n(t.price) : 'Free',
          tone: player.title === t.id ? 'accent' : owned ? 'muted' : lock ? 'locked' : 'price',
        };
      });
      const earned = new Set(salvage.badges(player).map((b) => b.id));
      const badges: BadgeTile[] = BADGES.map((b) => ({ name: earned.has(b.id) ? b.name : b.hint, icon: b.icon, earned: earned.has(b.id) }));
      cosmetics = { themes, titles, badges };

      const option = (kind: 'theme' | 'title', id: string, name: string, emojiName?: string) => {
        const owned = (kind === 'theme' ? ownedThemes : ownedTitles).includes(id);
        const equipped = (kind === 'theme' ? player.theme : player.title) === id;
        return { label: name, value: id, ...(emojiName ? { emoji: { name: emojiName } } : {}), description: equipped ? 'Equipped' : owned ? 'Owned · tap to equip' : 'Tap to see price', default: equipped };
      };
      extraRows.push(
        row(new StringSelectMenuBuilder().setCustomId(svid('cos', owner, 'theme')).setPlaceholder('Change theme').addOptions(THEMES.map((t) => option('theme', t.id, t.name, t.emoji)))),
        row(new StringSelectMenuBuilder().setCustomId(svid('cos', owner, 'title')).setPlaceholder('Change title').addOptions(TITLES.map((t) => option('title', t.id, t.name)))),
      );
      break;
    }
  }

  const image = await renderShopCard({
    frame: frameOf(player, accent),
    tab: { icon: info.icon, title: info.label, subtitle: info.description },
    banner: note,
    hot,
    rows,
    cosmetics,
    note: footnote,
  });

  const actionRows: AnyRow[] = [tabSelect(owner, tab)];
  if (buttons.length) actionRows.push(row(...buttons.slice(0, 5)));
  actionRows.push(...extraRows, navRow(owner, 'shop'));
  return imageView('shop.png', image, `Shop: ${info.label}`, accent, actionRows);
}

/** Confirm screen before buying a cosmetic. */
export function cosmeticConfirmView(player: GamePlayerRecord, owner: string, accent: number, kind: 'theme' | 'title', id: string): View {
  const entry = kind === 'theme' ? THEME_BY_ID.get(id)! : TITLE_BY_ID.get(id)!;
  const container = panel({
    title: `Buy ${entry.name}?`,
    emoji: 'shop',
    description: `This ${kind} costs ${credits(entry.price)}. You have ${credits(player.credits)}.`,
    accent,
  }).addActionRowComponents(
    row(
      button({ id: svid('cosbuy', owner, kind, id), label: 'Buy it', style: ButtonStyle.Success, disabled: player.credits < entry.price }),
      button({ id: svid('shop', owner, 'cosmetics'), label: 'Cancel' }),
    ),
  );
  return { components: [container], files: [] };
}

/* ─────────────── Profile ─────────────── */

export async function profileView(player: GamePlayerRecord, user: User, viewer: string, accent: number, guildId: string | null): Promise<View> {
  const progress = gameLevel(player.xp);
  const tool = toolOf(player);
  const zone = zoneOf(player);
  const best = player.bestFind ? ITEMS.find((i) => i.id === player.bestFind!.itemId) : null;
  const rank = await salvage.rank(player, null);

  const image = await renderProfileCard({
    displayName: user.displayName,
    avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
    level: progress.level,
    currentXp: progress.current,
    neededXp: progress.needed,
    credits: player.credits,
    collected: Object.values(player.found ?? {}).filter((c) => c > 0).length,
    collectable: ITEMS.length,
    streak: player.streak,
    rank,
    zone: { name: zone.name, icon: iconCode(zone.emoji) },
    tool: { name: tool.name, icon: iconCode(tool.emoji) },
    bestFind: best ? { name: `${player.bestFind!.shiny ? 'Shiny ' : ''}${best.name}`, icon: best.icon, color: RARITY[best.rarity].color } : null,
    accent,
    title: (TITLE_BY_ID.get(player.title) ?? TITLES[0]!).name,
    theme: THEME_BY_ID.get(player.theme) ?? THEMES[0]!,
    badges: salvage.badges(player).map((b) => b.icon),
  });

  const container = new ContainerBuilder()
    .setAccentColor(accent)
    .addMediaGalleryComponents((g) => g.addItems((i) => i.setURL('attachment://profile.png').setDescription(`${user.displayName}'s salvage profile`)));

  if (viewer === player.userId) {
    container.addActionRowComponents(zoneSelect(player, viewer));
    container.addActionRowComponents(
      row(
        button({ id: svid('col', viewer, zone.id), label: 'Collection', emoji: 'collection' }),
        button({ id: svid('top', viewer, guildId ? 's' : 'g', 0), label: 'Leaderboard', emoji: 'trophy' }),
      ),
    );
    container.addActionRowComponents(navRow(viewer, 'profile'));
  }
  return { components: [container], files: [new AttachmentBuilder(image, { name: 'profile.png' })] };
}

function zoneSelect(player: GamePlayerRecord, owner: string) {
  return row(
    new StringSelectMenuBuilder()
      .setCustomId(svid('travel', owner))
      .setPlaceholder('Travel to a zone')
      .addOptions(
        ZONES.map((zone: Zone) => ({
          label: zone.name,
          value: zone.id,
          emoji: { name: zone.emoji },
          description: player.level >= zone.level ? `Loot worth ×${zone.valueMultiplier}` : `🔒 Unlocks at level ${zone.level}`,
          default: zone.id === player.zone,
        })),
      ),
  );
}

/* ─────────────── Collection ─────────────── */

export async function collectionView(player: GamePlayerRecord, owner: string, zoneId: string, accent: number): Promise<View> {
  const zone = ZONE_BY_ID.get(zoneId) ?? ZONES[0]!;
  const items = itemsInZone(zone.id);
  const found = player.found ?? {};
  const tiles: ItemTile[] = items.map((it) => {
    const count = found[it.id] ?? 0;
    return {
      icon: it.icon,
      name: it.name,
      color: RARITY[it.rarity].color,
      label: RARITY[it.rarity].name.toUpperCase(),
      detail: count ? `×${n(count)}` : undefined,
      shiny: player.shinies.includes(it.id),
      unknown: count === 0,
    };
  });

  const image = await renderCollectionCard({
    frame: frameOf(player, accent),
    zone: { name: zone.name, icon: iconCode(zone.emoji) },
    found: tiles.filter((t) => !t.unknown).length,
    total: items.length,
    foundAll: Object.values(found).filter((c) => c > 0).length,
    totalAll: ITEMS.length,
    tiles,
  });

  const zones = row(
    new StringSelectMenuBuilder()
      .setCustomId(svid('col', owner))
      .setPlaceholder('Pick a zone')
      .addOptions(ZONES.map((z) => ({ label: z.name, value: z.id, emoji: { name: z.emoji }, default: z.id === zone.id }))),
  );
  return imageView('collection.png', image, `${zone.name} collection`, accent, [zones as AnyRow, navRow(owner, 'collection')]);
}

/* ─────────────── Leaderboard ─────────────── */

export async function topView(client: Client, guild: Guild | null, scope: 's' | 'g', page: number, viewer: string, accent: number): Promise<View> {
  const guildId = scope === 's' && guild ? guild.id : null;
  const board = await salvage.leaderboard(guildId, page);
  const scopeRow = () => {
    const buttons = [];
    if (guild) {
      buttons.push(
        button({ id: svid('top', viewer, 's', 0), label: 'This server', emoji: 'home', style: guildId ? ButtonStyle.Primary : ButtonStyle.Secondary, disabled: Boolean(guildId) }),
        button({ id: svid('top', viewer, 'g', 0), label: 'Global', emoji: 'globe', style: guildId ? ButtonStyle.Secondary : ButtonStyle.Primary, disabled: !guildId }),
      );
    }
    buttons.push(button({ id: svid('dig', viewer), label: 'Dig', emoji: 'dig', style: ButtonStyle.Primary }));
    return row(...buttons);
  };

  if (!board.total) {
    const container = panel({ title: 'Salvage leaderboard', emoji: 'trophy', description: `Nobody has played yet. Be the first! ${emoji('dig')}`, accent }).addActionRowComponents(scopeRow());
    return { components: [container], files: [] };
  }

  const members = guild ? await guild.members.fetch({ user: board.entries.map((e) => e.userId) }).catch(() => null) : null;
  const rows = await Promise.all(
    board.entries.map(async (entry, i) => {
      const member = members?.get(entry.userId);
      const user = member?.user ?? (await client.users.fetch(entry.userId).catch(() => null));
      const progress = gameLevel(entry.xp);
      return {
        place: board.page * 10 + i + 1,
        name: member?.displayName ?? user?.displayName ?? 'Unknown player',
        avatarUrl: (member ?? user)?.displayAvatarURL({ extension: 'png', size: 128 }) ?? null,
        level: progress.level,
        xp: entry.xp,
        progress: progress.current / progress.needed,
        isViewer: entry.userId === viewer,
      };
    }),
  );
  const me = await salvage.find(viewer);
  const viewerRank = me ? await salvage.rank(me, guildId) : null;

  const image = await renderLeaderboard({
    title: 'SALVAGE TOP',
    serverName: guildId ? guild!.name : 'All servers',
    serverIconUrl: guildId ? guild!.iconURL({ extension: 'png', size: 128 }) : client.user?.displayAvatarURL({ extension: 'png', size: 128 }) ?? null,
    page: board.page,
    pages: board.pages,
    rows,
    viewerRank,
    accent,
    footer: viewerRank ? `You are #${n(viewerRank)}  ·  /salvage dig to climb` : '/salvage dig to join the board',
  });

  const container = new ContainerBuilder()
    .setAccentColor(accent)
    .addMediaGalleryComponents((g) => g.addItems((i) => i.setURL('attachment://top.png').setDescription('Salvage leaderboard')));
  if (board.pages > 1) {
    container.addActionRowComponents(
      row(
        button({ id: svid('top', viewer, scope, 0, 'f'), emoji: 'first', disabled: board.page === 0 }),
        button({ id: svid('top', viewer, scope, board.page - 1, 'p'), emoji: 'prev', disabled: board.page === 0 }),
        button({ id: svid('top', viewer, scope, 'x', 'x'), label: `${board.page + 1} / ${board.pages}`, disabled: true }),
        button({ id: svid('top', viewer, scope, board.page + 1, 'n'), emoji: 'next', disabled: board.page >= board.pages - 1 }),
        button({ id: svid('top', viewer, scope, board.pages - 1, 'l'), emoji: 'last', disabled: board.page >= board.pages - 1 }),
      ),
    );
  }
  container.addActionRowComponents(scopeRow());
  return { components: [container], files: [new AttachmentBuilder(image, { name: 'top.png' })] };
}

export const cooldownText = (readyAt: Date) => `Your tool needs a moment. Ready ${timestamp(readyAt, 'R')}.`;
