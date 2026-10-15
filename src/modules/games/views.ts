import {
  AttachmentBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  type ButtonBuilder,
  type Client,
  type Guild,
  type User,
} from 'discord.js';
import { cid } from '../../core/customId.js';
import { timestamp } from '../../core/time.js';
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
  itemValue,
  upgradeCost,
  type Zone,
} from '../../games/salvage/data.js';
import { renderFindCard } from '../../render/findCard.js';
import { iconCode } from '../../render/icons.js';
import { renderLeaderboard } from '../../render/leaderboard.js';
import { renderProfileCard } from '../../render/profileCard.js';
import {
  boostsOf,
  digCooldown,
  findValue,
  golemWinChance,
  hotItem,
  nextReset,
  salvage,
  sellBonus,
  shinyOdds,
  toolOf,
  upgradeLevel,
  zoneOf,
  type Find,
  type GrantResult,
} from '../../services/SalvageService.js';
import { button, divider, panel, row, text } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';

/* Custom IDs: sv:<action>:<ownerId>:...args */
export const svid = (action: string, owner: string, ...args: Array<string | number>) => cid('sv', action, owner, ...args);

export interface View {
  components: ContainerBuilder[];
  files: AttachmentBuilder[];
}

const n = (value: number) => value.toLocaleString('en-US');
const credits = (value: number) => `${emoji('credits')} **${n(value)}**`;
const findName = (find: Find) => `${find.shiny ? `${emoji('sparkles')} Shiny ` : ''}${find.item.emoji} **${find.item.name}**`;

/** Dig / Bag / Shop / Profile — shown under most game screens. */
export function navRow(owner: string, current?: 'bag' | 'shop' | 'profile' | 'collection') {
  return row(
    button({ id: svid('dig', owner), label: 'Dig', emoji: 'dig', style: ButtonStyle.Primary }),
    button({ id: svid('bag', owner), label: 'Bag', emoji: 'bag', disabled: current === 'bag' }),
    button({ id: svid('shop', owner, 'market'), label: 'Shop', emoji: 'shop' }),
    button({ id: svid('profile', owner), label: 'Profile', emoji: 'user', disabled: current === 'profile' }),
  );
}

const bagCount = (player: GamePlayerRecord) => Object.values(player.inventory ?? {}).reduce((sum, c) => sum + Math.max(0, c), 0);
const footer = (player: GamePlayerRecord) => text(`-# ${emoji('bag')} ${n(bagCount(player))} in bag · ${emoji('credits')} ${n(player.credits)} credits · ${zoneOf(player).emoji} ${zoneOf(player).name}`);

async function card(find: Find, player: GamePlayerRecord, xp: number, accent: number) {
  const progress = gameLevel(player.xp);
  return renderFindCard({
    icon: find.item.icon,
    label: RARITY[find.item.rarity].name.toUpperCase(),
    labelColor: RARITY[find.item.rarity].color,
    title: find.item.name,
    subtitle: `+${n(xp)} XP  ·  Worth ${n(findValue(find))} credits`,
    corner: ZONE_BY_ID.get(find.item.zone)?.name ?? '',
    shiny: find.shiny,
    level: progress.level,
    currentXp: progress.current,
    neededXp: progress.needed,
    accent,
  });
}

/** Result of a dig, crate or golem win. */
export async function findView(result: GrantResult, owner: string, accent: number, intro?: string, again?: ButtonBuilder): Promise<View> {
  const [main, ...extra] = [...result.finds].sort((a, b) => findValue(b) - findValue(a));
  const image = await card(main!, result.player, result.xp, accent);

  const lines: string[] = [];
  if (intro) lines.push(intro);
  if (main!.shiny) lines.push(`${emoji('sparkles')} **Shiny!** Worth ${BALANCE.shinyMultiplier}× more.`);
  else if (main!.item.rarity === 'legendary') lines.push(`${emoji('party')} **Legendary find!** Only a few people have one.`);
  for (const find of extra) lines.push(`${emoji('lucky')} Double find! You also got ${findName(find)}.`);
  if (result.streak) lines.push(`${emoji('streak')} Day **${result.streak.days}** streak! +${credits(result.streak.bonus)}`);
  if (result.levelUp) {
    lines.push(`${emoji('level')} **Level up!** You're now level **${result.levelUp.to}**. +${credits(result.levelUp.credits)}`);
    for (const zone of result.levelUp.zones) lines.push(`${emoji('zone')} New zone unlocked: ${zone.emoji} **${zone.name}**. Travel from your profile.`);
    for (const tool of result.levelUp.tools) lines.push(`${emoji('tool')} New tool in the shop: ${tool.emoji} **${tool.name}**`);
  }

  const container = new ContainerBuilder()
    .setAccentColor(RARITY[main!.item.rarity].color)
    .addMediaGalleryComponents((g) => g.addItems((i) => i.setURL('attachment://find.png').setDescription(`Found: ${main!.item.name}`)));
  const active = boostLine(result.player);
  if (active) lines.push(`-# ${active}`);
  if (lines.length) container.addTextDisplayComponents(text(lines.join('\n')));
  if (again) container.addActionRowComponents(row(again));
  container.addActionRowComponents(navRow(owner)).addTextDisplayComponents(footer(result.player));
  return { components: [container], files: [new AttachmentBuilder(image, { name: 'find.png' })] };
}

/** "🍀 Lucky Charm · 12 left" for active boosts, or null. */
function boostLine(player: GamePlayerRecord): string | null {
  const boosts = boostsOf(player);
  const parts = BOOSTS.filter((b) => boosts[b.id] > 0).map((b) => `${b.emoji} ${b.name} · ${boosts[b.id]} left`);
  return parts.length ? parts.join('  ·  ') : null;
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
    subtitle: event.subtitle,
    corner: zoneOf(player).name,
    level: progress.level,
    currentXp: progress.current,
    neededXp: progress.needed,
    accent,
  });
  const expires = player.pendingEvent?.expiresAt ?? new Date(Date.now() + BALANCE.eventTimeout * 1000);
  const buttons =
    type === 'golem'
      ? row(
          button({ id: svid('ev', owner, 'golem', 'fight'), label: 'Fight', emoji: 'fight', style: ButtonStyle.Danger }),
          button({ id: svid('ev', owner, 'golem', 'run'), label: 'Run', emoji: 'run' }),
        )
      : row(button({ id: svid('ev', owner, 'crate', 'open'), label: 'Open it', emoji: 'crate', style: ButtonStyle.Success }));

  const container = new ContainerBuilder()
    .setAccentColor(event.color)
    .addMediaGalleryComponents((g) => g.addItems((i) => i.setURL('attachment://find.png').setDescription(event.title)))
    .addTextDisplayComponents(text(`${emoji('clock')} Decide ${timestamp(expires, 'R')}`))
    .addActionRowComponents(buttons);
  return { components: [container], files: [new AttachmentBuilder(image, { name: 'find.png' })] };
}

/** Simple text screen with the nav row (golem loss, ran away…). */
export function messageView(player: GamePlayerRecord, owner: string, accent: number, message: string): View {
  const container = new ContainerBuilder().setAccentColor(accent).addTextDisplayComponents(text(message)).addActionRowComponents(navRow(owner)).addTextDisplayComponents(footer(player));
  return { components: [container], files: [] };
}

/* ─────────────── Bag ─────────────── */

export function bagView(player: GamePlayerRecord, owner: string, accent: number, note?: string): View {
  const bag = salvage.bag(player);
  const hot = hotItem();
  const total = bag.reduce((sum, e) => sum + e.value, 0);
  const lines = bag
    .slice(0, 15)
    .map((e) => `\`${String(e.count).padStart(3)}×\` ${findName(e)} · ${credits(e.value)}${e.item.id === hot.id ? ` · ${emoji('streak')} Hot` : ''}`);
  if (bag.length > 15) lines.push(`-# …and ${bag.length - 15} more`);

  const container = panel({
    title: 'Your bag',
    emoji: 'bag',
    description: bag.length ? `**${n(bagCount(player))}** items worth ${credits(total)}` : `Your bag is empty. Go dig something up! ${emoji('dig')}`,
    accent,
  });
  if (note) container.addTextDisplayComponents(text(note));
  if (lines.length) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(lines.join('\n')));
  container.addSeparatorComponents(divider());
  if (bag.length) {
    container.addActionRowComponents(
      row(
        button({ id: svid('sell', owner, 'junk'), label: 'Sell junk', emoji: 'sell', style: ButtonStyle.Success }),
        button({ id: svid('sell', owner, 'all'), label: 'Sell everything', emoji: 'sell' }),
      ),
    );
    container.addTextDisplayComponents(text('-# **Sell junk** sells Common and Uncommon items. Rare+ and shinies stay.'));
  }
  container.addActionRowComponents(navRow(owner, 'bag')).addTextDisplayComponents(footer(player));
  return { components: [container], files: [] };
}

/* ─────────────── Shop ─────────────── */

export const SHOP_TABS = {
  market: { label: 'Black Market', emoji: '🕶️', description: 'Daily deals' },
  upgrades: { label: 'Upgrades', emoji: '⚡', description: 'Permanent boosts' },
  boosts: { label: 'Boosts', emoji: '🍀', description: 'Power-ups for your next digs' },
  crates: { label: 'Crates', emoji: '📦', description: 'Guaranteed good loot' },
  tools: { label: 'Tools', emoji: '⛏️', description: 'Better luck and XP' },
  cosmetics: { label: 'Cosmetics', emoji: '🎨', description: 'Themes, titles and badges' },
} as const;
export type ShopTab = keyof typeof SHOP_TABS;

const pct = (value: number) => `${Math.round(value * 100)}%`;
const section = (content: string, action: ButtonBuilder) => new SectionBuilder().addTextDisplayComponents(text(content)).setButtonAccessory(action);

function shopFrame(player: GamePlayerRecord, owner: string, accent: number, tab: ShopTab, note?: string) {
  const info = SHOP_TABS[tab];
  const container = panel({ title: `Shop · ${info.label}`, emoji: 'shop', description: `You have ${credits(player.credits)} credits`, accent });
  container.addActionRowComponents(
    row(
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
    ),
  );
  if (note) container.addTextDisplayComponents(text(note));
  container.addSeparatorComponents(divider());
  return container;
}

function shopEnd(container: ContainerBuilder, player: GamePlayerRecord, owner: string): View {
  container.addSeparatorComponents(divider()).addActionRowComponents(navRow(owner, 'shop')).addTextDisplayComponents(footer(player));
  return { components: [container], files: [] };
}

export function shopView(player: GamePlayerRecord, owner: string, accent: number, tab: ShopTab = 'market', note?: string): View {
  const container = shopFrame(player, owner, accent, tab, note);
  const buy = (id: string, label: string, ok: boolean, style = ButtonStyle.Success) => button({ id, label, style, disabled: !ok });

  switch (tab) {
    case 'tools':
      for (const tool of TOOLS) {
        const owned = player.ownedTools.includes(tool.id);
        const perks = tool.luck === 1 ? 'The basics. Everyone starts here.' : `+${pct(tool.luck - 1)} luck · +${pct(tool.xpBoost - 1)} XP · ${pct(tool.doubleChance)} double finds`;
        const price = tool.price ? credits(tool.price) : '`Free`';
        const lock = !owned && player.level < tool.level ? ` · Level ${tool.level}` : '';
        const id = svid('buy', owner, tool.id);
        const action =
          player.tool === tool.id
            ? button({ id, label: 'Equipped', disabled: true })
            : owned
              ? button({ id, label: 'Equip', style: ButtonStyle.Primary })
              : buy(id, 'Buy', player.level >= tool.level && player.credits >= tool.price);
        container.addSectionComponents(section(`${tool.emoji} **${tool.name}** · ${price}${lock}\n-# ${perks}`, action));
      }
      break;

    case 'upgrades':
      for (const up of UPGRADES) {
        const level = upgradeLevel(player, up.id);
        const max = level >= up.maxLevel;
        const cost = upgradeCost(up, level);
        const now = upgradeEffect(player, up.id, level);
        const next = max ? null : upgradeEffect(player, up.id, level + 1);
        const line = `${up.emoji} **${up.name}** · Lv ${level}/${up.maxLevel}${max ? '' : ` · ${credits(cost)}`}\n-# ${up.description}: ${now}${next ? ` → ${next}` : ' (max)'}`;
        container.addSectionComponents(section(line, max ? button({ id: svid('up', owner, up.id), label: 'Maxed', disabled: true }) : buy(svid('up', owner, up.id), 'Upgrade', player.credits >= cost)));
      }
      break;

    case 'boosts': {
      const active = boostsOf(player);
      for (const boost of BOOSTS) {
        const full = active[boost.id] + boost.amount > boost.cap;
        const left = active[boost.id] ? ` · **${active[boost.id]}** left` : '';
        const amount = boost.id === 'bait' ? '1 use' : `${boost.amount} digs`;
        container.addSectionComponents(
          section(`${boost.emoji} **${boost.name}** · ${credits(boost.price)}${left}\n-# ${boost.description} · ${amount}`, buy(svid('boost', owner, boost.id), full ? 'Full' : 'Buy', !full && player.credits >= boost.price)),
        );
      }
      container.addTextDisplayComponents(text('-# Boosts are used up as you dig. Buy more to stack them.'));
      break;
    }

    case 'market': {
      const hot = hotItem();
      const bought = salvage.boughtToday(player);
      container.addTextDisplayComponents(
        text(`${emoji('streak')} **Hot item:** ${hot.emoji} ${hot.name} sells for **${MARKET.hotMultiplier}×** today\n-# New deals ${timestamp(nextReset(), 'R')}`),
      );
      for (const deal of salvage.deals(player)) {
        const sold = bought.includes(deal.slot);
        let line: string;
        if (deal.kind === 'boost') {
          const b = BOOSTS.find((x) => x.id === deal.id)!;
          line = `${b.emoji} **${b.name}** · ~~${n(deal.was)}~~ ${credits(deal.price)}\n-# ${b.description} · ${Math.round(MARKET.boostDiscount * 100)}% off today`;
        } else if (deal.kind === 'crate') {
          const c = CRATES.find((x) => x.id === deal.id)!;
          line = `${c.emoji} **${c.name}** · ~~${n(deal.was)}~~ ${credits(deal.price)}\n-# Opens right away · ${Math.round(MARKET.crateDiscount * 100)}% off today`;
        } else {
          const isNew = !(player.found?.[deal.item.id] ?? 0);
          line = `${deal.item.emoji} **${deal.item.name}** · ${credits(deal.price)}\n-# ${RARITY[deal.item.rarity].name}${isNew ? ' · New for your collection!' : ''}`;
        }
        container.addSectionComponents(section(line, sold ? button({ id: svid('deal', owner, deal.slot), label: 'Sold out', disabled: true }) : buy(svid('deal', owner, deal.slot), 'Buy', player.credits >= deal.price)));
      }
      break;
    }

    case 'crates':
      for (const crate of CRATES) {
        const odds = (Object.entries(crate.odds) as Array<[keyof typeof RARITY, number]>).map(([r, c]) => `${RARITY[r].name} ${c}%`).join(' · ');
        container.addSectionComponents(section(`${crate.emoji} **${crate.name}** · ${credits(crate.price)}\n-# ${odds}`, buy(svid('crate', owner, crate.id), 'Open', player.credits >= crate.price)));
      }
      container.addTextDisplayComponents(text(`-# Loot comes from your current zone: ${zoneOf(player).emoji} ${zoneOf(player).name}`));
      break;

    case 'cosmetics':
      cosmetics(container, player, owner);
      break;
  }
  return shopEnd(container, player, owner);
}

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

function cosmetics(container: ContainerBuilder, player: GamePlayerRecord, owner: string) {
  const ownedThemes = player.ownedThemes ?? ['hazard'];
  const ownedTitles = player.ownedTitles ?? ['rookie'];
  const state = (owned: boolean, equipped: boolean, price: number, lock: string | null) =>
    equipped ? 'Equipped' : owned ? 'Owned' : lock ? `🔒 ${lock.replace(/\*\*/g, '').replace(/^Reach level (\d+) first\./, 'Level $1')}` : price ? `${n(price)} credits` : 'Free';

  container.addTextDisplayComponents(text('**Profile themes** change the stripe and background of your profile card.'));
  container.addActionRowComponents(
    row(
      new StringSelectMenuBuilder()
        .setCustomId(svid('cos', owner, 'theme'))
        .setPlaceholder('Pick a theme')
        .addOptions(
          THEMES.map((t) => ({
            label: t.name,
            value: t.id,
            emoji: { name: t.emoji },
            description: state(ownedThemes.includes(t.id), player.theme === t.id, t.price, ownedThemes.includes(t.id) ? null : salvage.cosmeticLocked(player, 'theme', t.id)).slice(0, 100),
            default: player.theme === t.id,
          })),
        ),
    ),
  );
  container.addTextDisplayComponents(text('**Titles** show above your name.'));
  container.addActionRowComponents(
    row(
      new StringSelectMenuBuilder()
        .setCustomId(svid('cos', owner, 'title'))
        .setPlaceholder('Pick a title')
        .addOptions(
          TITLES.map((t) => {
            const owned = ownedTitles.includes(t.id);
            const lock = owned ? null : salvage.cosmeticLocked(player, 'title', t.id);
            return {
              label: t.name,
              value: t.id,
              description: (lock && t.hint ? `🔒 ${t.hint}` : state(owned, player.title === t.id, t.price, lock)).slice(0, 100),
              default: player.title === t.id,
            };
          }),
        ),
    ),
  );
  const earned = new Set(salvage.badges(player).map((b) => b.id));
  const badges = BADGES.map((b) => (earned.has(b.id) ? `${String.fromCodePoint(...b.icon.split('-').map((c) => parseInt(c, 16)))} **${b.name}**` : `${emoji('locked')} ${b.hint}`));
  container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`**Badges** · earned by playing, shown on your card\n${badges.join('\n')}`));
}

/** Confirm screen before buying a cosmetic. */
export function cosmeticConfirmView(player: GamePlayerRecord, owner: string, accent: number, kind: 'theme' | 'title', id: string): View {
  const entry = kind === 'theme' ? THEME_BY_ID.get(id)! : TITLE_BY_ID.get(id)!;
  const container = shopFrame(player, owner, accent, 'cosmetics');
  container
    .addTextDisplayComponents(text(`Buy the **${entry.name}** ${kind} for ${credits(entry.price)}?`))
    .addActionRowComponents(
      row(
        button({ id: svid('cosbuy', owner, kind, id), label: 'Buy it', style: ButtonStyle.Success, disabled: player.credits < entry.price }),
        button({ id: svid('shop', owner, 'cosmetics'), label: 'Cancel' }),
      ),
    );
  return shopEnd(container, player, owner);
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

export function collectionView(player: GamePlayerRecord, owner: string, zoneId: string, accent: number): View {
  const zone = ZONE_BY_ID.get(zoneId) ?? ZONES[0]!;
  const items = itemsInZone(zone.id);
  const found = player.found ?? {};
  const have = items.filter((i) => (found[i.id] ?? 0) > 0).length;
  const lines = items.map((it) => {
    const count = found[it.id] ?? 0;
    if (!count) return `${emoji('unknown')} ??? · ${RARITY[it.rarity].name}`;
    const shiny = player.shinies.includes(it.id) ? ` ${emoji('sparkles')}` : '';
    return `${it.emoji} **${it.name}**${shiny} · ${RARITY[it.rarity].name} · ×${n(count)} · ${credits(itemValue(it))}`;
  });

  const container = panel({
    title: `Collection · ${zone.name}`,
    emoji: 'collection',
    description: `${zone.emoji} **${have}/${items.length}** found here · **${Object.values(found).filter((c) => c > 0).length}/${ITEMS.length}** total`,
    accent,
  })
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(lines.join('\n')))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      row(
        new StringSelectMenuBuilder()
          .setCustomId(svid('col', owner))
          .setPlaceholder('Pick a zone')
          .addOptions(ZONES.map((z) => ({ label: z.name, value: z.id, emoji: { name: z.emoji }, default: z.id === zone.id }))),
      ),
    )
    .addActionRowComponents(navRow(owner, 'collection'));
  return { components: [container], files: [] };
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
