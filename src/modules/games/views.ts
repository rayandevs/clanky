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
import { BALANCE, ITEMS, RARITY, TOOLS, ZONES, ZONE_BY_ID, gameLevel, itemsInZone, itemValue, type Zone } from '../../games/salvage/data.js';
import { renderFindCard } from '../../render/findCard.js';
import { renderLeaderboard } from '../../render/leaderboard.js';
import { salvage, toolOf, zoneOf, findValue, type Find, type GrantResult } from '../../services/SalvageService.js';
import { button, divider, panel, progressBar, row, text } from '../../ui/components.js';
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
    button({ id: svid('shop', owner), label: 'Shop', emoji: 'shop', disabled: current === 'shop' }),
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
export async function findView(result: GrantResult, owner: string, accent: number, intro?: string): Promise<View> {
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
  if (lines.length) container.addTextDisplayComponents(text(lines.join('\n')));
  container.addActionRowComponents(navRow(owner)).addTextDisplayComponents(footer(result.player));
  return { components: [container], files: [new AttachmentBuilder(image, { name: 'find.png' })] };
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
  const total = bag.reduce((sum, e) => sum + e.value, 0);
  const lines = bag
    .slice(0, 15)
    .map((e) => `\`${String(e.count).padStart(3)}×\` ${findName(e)} · ${RARITY[e.item.rarity].name} · ${credits(e.value)}`);
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

const pct = (value: number) => `${Math.round(value * 100)}%`;

export function shopView(player: GamePlayerRecord, owner: string, accent: number, note?: string): View {
  const container = panel({
    title: 'Tool shop',
    emoji: 'shop',
    description: `Better tools find rarer loot. You have ${credits(player.credits)} credits.`,
    accent,
  });
  if (note) container.addTextDisplayComponents(text(note));
  container.addSeparatorComponents(divider());

  for (const tool of TOOLS) {
    const owned = player.ownedTools.includes(tool.id);
    const equipped = player.tool === tool.id;
    const perks =
      tool.luck === 1 ? 'The basics. Everyone starts here.' : `+${pct(tool.luck - 1)} luck · +${pct(tool.xpBoost - 1)} XP · ${pct(tool.doubleChance)} double finds`;
    const price = tool.price ? `${credits(tool.price)}` : '`Free`';
    const lock = !owned && player.level < tool.level ? ` · ${emoji('locked')} Level ${tool.level}` : '';

    let action: ButtonBuilder;
    if (equipped) action = button({ id: svid('buy', owner, tool.id), label: 'Equipped', emoji: 'success', disabled: true });
    else if (owned) action = button({ id: svid('buy', owner, tool.id), label: 'Equip', style: ButtonStyle.Primary });
    else action = button({ id: svid('buy', owner, tool.id), label: 'Buy', style: ButtonStyle.Success, disabled: player.level < tool.level || player.credits < tool.price });

    container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(`${tool.emoji} **${tool.name}** · ${price}${lock}\n-# ${perks}`)).setButtonAccessory(action));
  }
  container.addSeparatorComponents(divider()).addActionRowComponents(navRow(owner, 'shop')).addTextDisplayComponents(footer(player));
  return { components: [container], files: [] };
}

/* ─────────────── Profile ─────────────── */

export async function profileView(player: GamePlayerRecord, user: User, viewer: string, accent: number, guildId: string | null): Promise<View> {
  const progress = gameLevel(player.xp);
  const tool = toolOf(player);
  const zone = zoneOf(player);
  const foundCount = Object.values(player.found ?? {}).filter((c) => c > 0).length;
  const best = player.bestFind ? ITEMS.find((i) => i.id === player.bestFind!.itemId) : null;
  const [globalRank, serverRank] = await Promise.all([salvage.rank(player, null), guildId ? salvage.rank(player, guildId) : null]);
  const ranks = [globalRank ? `${emoji('globe')} #${n(globalRank)} global` : null, serverRank ? `${emoji('home')} #${n(serverRank)} here` : null].filter(Boolean);

  const lines = [
    `${emoji('level')} **Level ${progress.level}** · ${progressBar(progress.current, progress.needed)} ${n(progress.current)}/${n(progress.needed)} XP`,
    `${emoji('credits')} **${n(player.credits)}** credits · ${emoji('tool')} ${tool.emoji} ${tool.name}`,
    `${emoji('zone')} ${zone.emoji} ${zone.name} · ${emoji('dig')} **${n(player.digs)}** digs`,
    `${emoji('collection')} **${foundCount}/${ITEMS.length}** collected · ${emoji('sparkles')} **${player.shinies.length}** shinies`,
    `${emoji('streak')} **${player.streak}** day streak · ${emoji('golem')} **${player.golemWins}** golems beaten`,
    best ? `${emoji('trophy')} Best find: ${findName({ item: best, shiny: player.bestFind!.shiny })}` : null,
    ranks.length ? ranks.join(' · ') : null,
  ].filter(Boolean);

  const container = panel({
    title: `${user.displayName}'s salvage profile`,
    emoji: 'game',
    description: lines.join('\n'),
    accent,
    thumbnail: user.displayAvatarURL({ extension: 'png', size: 128 }),
  });

  if (viewer === player.userId) {
    container.addSeparatorComponents(divider()).addActionRowComponents(zoneSelect(player, viewer));
    container.addActionRowComponents(
      row(
        button({ id: svid('col', viewer, zone.id), label: 'Collection', emoji: 'collection' }),
        button({ id: svid('top', viewer, guildId ? 's' : 'g', 0), label: 'Leaderboard', emoji: 'trophy' }),
      ),
    );
    container.addActionRowComponents(navRow(viewer, 'profile'));
  }
  return { components: [container], files: [] };
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
          description: player.level >= zone.level ? `${zone.description} Loot ×${zone.valueMultiplier}` : `Unlocks at level ${zone.level}`,
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

export const cooldownText = (readyAt: Date) => `${emoji('clock')} Your tool needs a moment. Ready ${timestamp(readyAt, 'R')}.`;
