import { GamePlayerModel, type GamePlayerRecord, type GameEventType } from '../database/models/index.js';
import {
  BALANCE,
  ITEM_BY_ID,
  RARITIES,
  RARITY,
  TOOL_BY_ID,
  TOOLS,
  ZONES,
  ZONE_BY_ID,
  gameLevel,
  itemValue,
  itemsInZone,
  rarityRank,
  type Item,
  type Rarity,
  type Tool,
  type Zone,
} from '../games/salvage/data.js';

/**
 * Salvage game logic. No Discord code here, so the dashboard (or an API)
 * can reuse it. All writes are atomic so button spam can't dupe loot.
 */

export interface Find {
  item: Item;
  shiny: boolean;
}

export interface LevelUp {
  from: number;
  to: number;
  credits: number;
  zones: Zone[];
  tools: Tool[];
}

export interface GrantResult {
  finds: Find[];
  xp: number;
  streak: { days: number; bonus: number } | null;
  levelUp: LevelUp | null;
  player: GamePlayerRecord;
}

export type DigResult =
  | ({ status: 'found' } & GrantResult)
  | { status: 'cooldown'; readyAt: Date }
  | { status: 'event'; type: GameEventType; player: GamePlayerRecord };

export type EventResult =
  | ({ status: 'won' | 'opened' } & GrantResult)
  | { status: 'lost'; readyAt: Date }
  | { status: 'fled' }
  | { status: 'expired' };

const SHINY_SUFFIX = '__shiny';
const utcDay = (date: Date) => date.toISOString().slice(0, 10);
const random = Math.random;

export const bagKey = (find: Find) => (find.shiny ? `${find.item.id}${SHINY_SUFFIX}` : find.item.id);

/** Splits a bag key back into an item + shiny flag. */
export function parseBagKey(key: string): Find | null {
  const shiny = key.endsWith(SHINY_SUFFIX);
  const item = ITEM_BY_ID.get(shiny ? key.slice(0, -SHINY_SUFFIX.length) : key);
  return item ? { item, shiny } : null;
}

export const findValue = (find: Find) => itemValue(find.item) * (find.shiny ? BALANCE.shinyMultiplier : 1);

export const toolOf = (player: Pick<GamePlayerRecord, 'tool'>) => TOOL_BY_ID.get(player.tool) ?? TOOLS[0]!;
export const zoneOf = (player: Pick<GamePlayerRecord, 'zone'>) => ZONE_BY_ID.get(player.zone) ?? ZONES[0]!;

/** Picks a rarity using the base weights, boosted by tool luck for Rare+. */
function rollRarity(luck: number, minimum: Rarity = 'common'): Rarity {
  const pool = RARITIES.filter((r) => rarityRank(r) >= rarityRank(minimum));
  const weights = pool.map((r) => RARITY[r].weight * (rarityRank(r) >= rarityRank('rare') ? luck : 1));
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

function rollFind(zoneId: string, luck: number, minimum?: Rarity): Find {
  const rarity = rollRarity(luck, minimum);
  const options = itemsInZone(zoneId).filter((i) => i.rarity === rarity);
  const item = options[Math.floor(random() * options.length)]!;
  return { item, shiny: random() < 1 / BALANCE.shinyOdds };
}

const better = (a: Find, b: { itemId: string; shiny: boolean } | null) => {
  if (!b) return true;
  const current = parseBagKey(b.shiny ? `${b.itemId}${SHINY_SUFFIX}` : b.itemId);
  return !current || findValue(a) > findValue(current);
};

class SalvageService {
  /** Gets (or creates) a player. */
  async get(userId: string): Promise<GamePlayerRecord> {
    const player = await GamePlayerModel.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, new: true }).lean();
    return player as GamePlayerRecord;
  }

  async find(userId: string): Promise<GamePlayerRecord | null> {
    return GamePlayerModel.findOne({ userId }).lean<GamePlayerRecord>();
  }

  /** One dig. Returns what was found, an event, or the cooldown. */
  async dig(userId: string, guildId: string | null): Promise<DigResult> {
    await this.get(userId);
    const now = new Date();
    const claimed = await GamePlayerModel.findOneAndUpdate(
      { userId, cooldownUntil: { $lte: now } },
      {
        $set: { cooldownUntil: new Date(now.getTime() + BALANCE.digCooldown * 1000), pendingEvent: null },
        ...(guildId ? { $addToSet: { guildIds: guildId } } : {}),
      },
      { new: true },
    ).lean<GamePlayerRecord>();

    if (!claimed) {
      const player = await this.get(userId);
      return { status: 'cooldown', readyAt: player.cooldownUntil };
    }

    // Random event instead of a normal find (never on the very first digs).
    if (claimed.digs >= 10 && random() < BALANCE.eventChance) {
      const type: GameEventType = random() < 0.5 ? 'golem' : 'crate';
      const expiresAt = new Date(now.getTime() + BALANCE.eventTimeout * 1000);
      const player = await GamePlayerModel.findOneAndUpdate(
        { userId },
        { $set: { pendingEvent: { type, zone: claimed.zone, expiresAt } }, $inc: { digs: 1 } },
        { new: true },
      ).lean<GamePlayerRecord>();
      return { status: 'event', type, player: player! };
    }

    const tool = toolOf(claimed);
    const finds = [rollFind(claimed.zone, tool.luck)];
    if (random() < tool.doubleChance) finds.push(rollFind(claimed.zone, tool.luck));
    return { status: 'found', ...(await this.grant(claimed, finds, { dig: true })) };
  }

  /** Reacts to a pending event (fight / run / open). */
  async resolveEvent(userId: string, type: GameEventType, action: 'fight' | 'run' | 'open'): Promise<EventResult> {
    const now = new Date();
    const player = await GamePlayerModel.findOneAndUpdate(
      { userId, 'pendingEvent.type': type, 'pendingEvent.expiresAt': { $gt: now } },
      { $set: { pendingEvent: null } },
      { new: false },
    ).lean<GamePlayerRecord>();
    if (!player?.pendingEvent) return { status: 'expired' };

    const zone = player.pendingEvent.zone;
    const tool = toolOf(player);

    if (type === 'crate') {
      return { status: 'opened', ...(await this.grant(player, [rollFind(zone, tool.luck, 'rare')])) };
    }
    if (action === 'run') return { status: 'fled' };

    const winChance = Math.min(0.9, BALANCE.golemWinChance + (tool.luck - 1) * 0.25);
    if (random() < winChance) {
      const result = await this.grant(player, [rollFind(zone, tool.luck, 'rare')], { golemWin: true });
      return { status: 'won', ...result };
    }
    const readyAt = new Date(now.getTime() + BALANCE.golemPenalty * 1000);
    await GamePlayerModel.updateOne({ userId }, { $set: { cooldownUntil: readyAt } });
    return { status: 'lost', readyAt };
  }

  /** Adds finds to the bag, gives XP, handles streaks and level-ups. */
  private async grant(player: GamePlayerRecord, finds: Find[], options: { dig?: boolean; golemWin?: boolean } = {}): Promise<GrantResult> {
    const tool = toolOf(player);
    const xp = Math.round(finds.reduce((sum, f) => sum + RARITY[f.item.rarity].xp * (f.shiny ? 2 : 1), 0) * tool.xpBoost);

    const inc: Record<string, number> = { xp };
    if (options.dig) inc.digs = 1;
    if (options.golemWin) inc.golemWins = 1;
    for (const find of finds) {
      inc[`inventory.${bagKey(find)}`] = (inc[`inventory.${bagKey(find)}`] ?? 0) + 1;
      inc[`found.${find.item.id}`] = (inc[`found.${find.item.id}`] ?? 0) + 1;
    }

    const set: Record<string, unknown> = {};
    let streak: GrantResult['streak'] = null;
    const today = utcDay(new Date());
    if (options.dig && player.streakDay !== today) {
      const yesterday = utcDay(new Date(Date.now() - 86_400_000));
      const days = player.streakDay === yesterday ? player.streak + 1 : 1;
      const bonus = BALANCE.streakBonus * Math.min(days, BALANCE.streakCap);
      streak = { days, bonus };
      set.streak = days;
      set.streakDay = today;
      inc.credits = (inc.credits ?? 0) + bonus;
      inc.lifetimeCredits = (inc.lifetimeCredits ?? 0) + bonus;
    }

    const best = finds.reduce((a, b) => (findValue(b) > findValue(a) ? b : a));
    if (better(best, player.bestFind)) set.bestFind = { itemId: best.item.id, shiny: best.shiny };
    const shinies = finds.filter((f) => f.shiny).map((f) => f.item.id);

    let updated = await GamePlayerModel.findOneAndUpdate(
      { userId: player.userId },
      { $inc: inc, ...(Object.keys(set).length ? { $set: set } : {}), ...(shinies.length ? { $addToSet: { shinies: { $each: shinies } } } : {}) },
      { new: true },
    ).lean<GamePlayerRecord>();

    // Level-up rewards. The `level` filter makes sure they're only paid once.
    let levelUp: LevelUp | null = null;
    const newLevel = gameLevel(updated!.xp).level;
    if (newLevel > updated!.level) {
      const from = updated!.level;
      let credits = 0;
      for (let l = from + 1; l <= newLevel; l++) credits += BALANCE.levelReward * l;
      const leveled = await GamePlayerModel.findOneAndUpdate(
        { userId: player.userId, level: from },
        { $set: { level: newLevel }, $inc: { credits, lifetimeCredits: credits } },
        { new: true },
      ).lean<GamePlayerRecord>();
      if (leveled) {
        updated = leveled;
        levelUp = {
          from,
          to: newLevel,
          credits,
          zones: ZONES.filter((z) => z.level > from && z.level <= newLevel),
          tools: TOOLS.filter((t) => t.level > from && t.level <= newLevel),
        };
      }
    }

    return { finds, xp, streak, levelUp, player: updated! };
  }

  /** Items in the bag, best first. */
  bag(player: GamePlayerRecord): Array<Find & { count: number; value: number }> {
    const entries: Array<Find & { count: number; value: number }> = [];
    for (const [key, count] of Object.entries(player.inventory ?? {})) {
      const find = parseBagKey(key);
      if (find && count > 0) entries.push({ ...find, count, value: findValue(find) * count });
    }
    return entries.sort((a, b) => b.value - a.value);
  }

  /** Sells the bag. "junk" keeps Rare and better (and shinies). */
  async sell(userId: string, mode: 'junk' | 'all'): Promise<{ count: number; credits: number; player: GamePlayerRecord }> {
    const player = await this.get(userId);
    const selling = this.bag(player).filter((e) => mode === 'all' || (!e.shiny && rarityRank(e.item.rarity) < rarityRank('rare')));
    if (!selling.length) return { count: 0, credits: 0, player };

    const credits = selling.reduce((sum, e) => sum + e.value, 0);
    const inc: Record<string, number> = { credits, lifetimeCredits: credits };
    for (const e of selling) inc[`inventory.${bagKey(e)}`] = -e.count;
    const updated = await GamePlayerModel.findOneAndUpdate({ userId }, { $inc: inc }, { new: true }).lean<GamePlayerRecord>();
    return { count: selling.reduce((sum, e) => sum + e.count, 0), credits, player: updated! };
  }

  /** Buys a tool (or equips one you already own). */
  async buyTool(userId: string, toolId: string): Promise<{ ok: true; player: GamePlayerRecord; bought: boolean } | { ok: false; reason: 'level' | 'credits' | 'unknown' }> {
    const tool = TOOL_BY_ID.get(toolId);
    if (!tool) return { ok: false, reason: 'unknown' };
    const player = await this.get(userId);

    if (player.ownedTools.includes(toolId)) {
      const updated = await GamePlayerModel.findOneAndUpdate({ userId }, { $set: { tool: toolId } }, { new: true }).lean<GamePlayerRecord>();
      return { ok: true, player: updated!, bought: false };
    }
    if (player.level < tool.level) return { ok: false, reason: 'level' };

    const updated = await GamePlayerModel.findOneAndUpdate(
      { userId, credits: { $gte: tool.price }, level: { $gte: tool.level }, ownedTools: { $ne: toolId } },
      { $inc: { credits: -tool.price }, $addToSet: { ownedTools: toolId }, $set: { tool: toolId } },
      { new: true },
    ).lean<GamePlayerRecord>();
    if (!updated) return { ok: false, reason: 'credits' };
    return { ok: true, player: updated, bought: true };
  }

  async travel(userId: string, zoneId: string): Promise<GamePlayerRecord | null> {
    const zone = ZONE_BY_ID.get(zoneId);
    if (!zone) return null;
    return GamePlayerModel.findOneAndUpdate({ userId, level: { $gte: zone.level } }, { $set: { zone: zoneId } }, { new: true }).lean<GamePlayerRecord>();
  }

  /** Leaderboard by game XP. Pass a guild ID for a server board, or null for global. */
  async leaderboard(guildId: string | null, page: number, perPage = 10) {
    const filter = guildId ? { guildIds: guildId, xp: { $gt: 0 } } : { xp: { $gt: 0 } };
    const total = await GamePlayerModel.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(0, page), pages - 1);
    const entries = await GamePlayerModel.find(filter)
      .sort({ xp: -1, userId: 1 })
      .skip(safePage * perPage)
      .limit(perPage)
      .select({ userId: 1, xp: 1, level: 1 })
      .lean<Array<Pick<GamePlayerRecord, 'userId' | 'xp' | 'level'>>>();
    return { entries, total, pages, page: safePage };
  }

  async rank(player: Pick<GamePlayerRecord, 'xp' | 'userId'>, guildId: string | null): Promise<number | null> {
    if (!player.xp) return null;
    const filter = guildId ? { guildIds: guildId, xp: { $gt: player.xp } } : { xp: { $gt: player.xp } };
    return (await GamePlayerModel.countDocuments(filter)) + 1;
  }
}

export const salvage = new SalvageService();
