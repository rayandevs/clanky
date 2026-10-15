import { GamePlayerModel, type GamePlayerRecord, type GameEventType } from '../database/models/index.js';
import {
  BADGES,
  BALANCE,
  BOOST_BY_ID,
  BOOST_EFFECT,
  CRATE_BY_ID,
  ITEMS,
  MARKET,
  BOOSTS,
  CRATES,
  THEME_BY_ID,
  TITLE_BY_ID,
  UPGRADE_BY_ID,
  upgradeCost,
  type Badge,
  type BoostId,
  type Crate,
  type CrateId,
  type UpgradeId,
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

export const upgradeLevel = (player: Pick<GamePlayerRecord, 'upgrades'>, id: UpgradeId) => player.upgrades?.[id] ?? 0;
export const boostsOf = (player: Pick<GamePlayerRecord, 'boosts'>) => ({ luck: player.boosts?.luck ?? 0, xp: player.boosts?.xp ?? 0, bait: player.boosts?.bait ?? 0 });

const effect = (player: Pick<GamePlayerRecord, 'upgrades'>, id: UpgradeId) => upgradeLevel(player, id) * UPGRADE_BY_ID.get(id)!.perLevel;

/** Seconds between digs, after the Turbo Motor. */
export const digCooldown = (player: Pick<GamePlayerRecord, 'upgrades'>) => Math.max(1, BALANCE.digCooldown - effect(player, 'turbo'));
/** "1 in N" shiny odds, after the Metal Detector. */
export const shinyOdds = (player: Pick<GamePlayerRecord, 'upgrades'>) => Math.round(BALANCE.shinyOdds / (1 + effect(player, 'detector')));
/** Sell price multiplier from the Haggler. */
export const sellBonus = (player: Pick<GamePlayerRecord, 'upgrades'>) => 1 + effect(player, 'haggler');
/** Golem win chance, after tool luck and Golem Armor. */
export const golemWinChance = (player: GamePlayerRecord) =>
  Math.min(0.9, BALANCE.golemWinChance + (toolOf(player).luck - 1) * 0.25 + effect(player, 'armor'));

/** Small deterministic RNG so daily deals are the same all day. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export const today = () => utcDay(new Date());
export const nextReset = () => {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d;
};

/** Today's hot item — the same for every player. Sells for 3×. */
export function hotItem(day = today()): Item {
  const pool = ITEMS.filter((i) => rarityRank(i.rarity) <= rarityRank('rare'));
  return pool[Math.floor(seeded(`hot:${day}`)() * pool.length)]!;
}

export type Deal =
  | { slot: number; kind: 'boost'; id: BoostId; price: number; was: number }
  | { slot: number; kind: 'crate'; id: CrateId; price: number; was: number }
  | { slot: number; kind: 'item'; item: Item; price: number; was: number };

/** Sell value of one find for this player (Haggler + hot item). */
export function sellValue(player: GamePlayerRecord, find: Find, day = today()): number {
  const hot = hotItem(day).id === find.item.id ? MARKET.hotMultiplier : 1;
  return Math.round(findValue(find) * sellBonus(player) * hot);
}

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

function rollFind(zoneId: string, luck: number, odds: number, minimum?: Rarity, fixed?: Rarity): Find {
  const rarity = fixed ?? rollRarity(luck, minimum);
  const options = itemsInZone(zoneId).filter((i) => i.rarity === rarity);
  const item = options[Math.floor(random() * options.length)]!;
  return { item, shiny: random() < 1 / odds };
}

function rollCrateRarity(crate: Crate): Rarity {
  let roll = random() * 100;
  for (const [rarity, chance] of Object.entries(crate.odds) as Array<[Rarity, number]>) {
    roll -= chance;
    if (roll < 0) return rarity;
  }
  return Object.keys(crate.odds).at(-1) as Rarity;
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
    const current = await this.get(userId);
    const now = new Date();
    const claimed = await GamePlayerModel.findOneAndUpdate(
      { userId, cooldownUntil: { $lte: now } },
      {
        $set: { cooldownUntil: new Date(now.getTime() + digCooldown(current) * 1000), pendingEvent: null },
        ...(guildId ? { $addToSet: { guildIds: guildId } } : {}),
      },
      { new: true },
    ).lean<GamePlayerRecord>();

    if (!claimed) {
      const player = await this.get(userId);
      return { status: 'cooldown', readyAt: player.cooldownUntil };
    }

    const boosts = boostsOf(claimed);

    // Random event instead of a normal find (never on the very first digs). Golem Bait forces one.
    const baited = boosts.bait > 0;
    if (baited || (claimed.digs >= 10 && random() < BALANCE.eventChance)) {
      const type: GameEventType = baited || random() < 0.5 ? 'golem' : 'crate';
      const expiresAt = new Date(now.getTime() + BALANCE.eventTimeout * 1000);
      const player = await GamePlayerModel.findOneAndUpdate(
        { userId },
        { $set: { pendingEvent: { type, zone: claimed.zone, expiresAt } }, $inc: { digs: 1, ...(baited ? { 'boosts.bait': -1 } : {}) } },
        { new: true },
      ).lean<GamePlayerRecord>();
      return { status: 'event', type, player: player! };
    }

    const tool = toolOf(claimed);
    const luck = tool.luck * (boosts.luck > 0 ? BOOST_EFFECT.luck : 1);
    const odds = shinyOdds(claimed);
    const finds = [rollFind(claimed.zone, luck, odds)];
    if (random() < tool.doubleChance) finds.push(rollFind(claimed.zone, luck, odds));
    return { status: 'found', ...(await this.grant(claimed, finds, { dig: true, luckBoost: boosts.luck > 0, xpBoost: boosts.xp > 0 })) };
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
      return { status: 'opened', ...(await this.grant(player, [rollFind(zone, tool.luck, shinyOdds(player), 'rare')])) };
    }
    if (action === 'run') return { status: 'fled' };

    if (random() < golemWinChance(player)) {
      const result = await this.grant(player, [rollFind(zone, tool.luck, shinyOdds(player), 'rare')], { golemWin: true });
      return { status: 'won', ...result };
    }
    const readyAt = new Date(now.getTime() + BALANCE.golemPenalty * 1000);
    await GamePlayerModel.updateOne({ userId }, { $set: { cooldownUntil: readyAt } });
    return { status: 'lost', readyAt };
  }

  /** Adds finds to the bag, gives XP, handles streaks and level-ups. */
  private async grant(
    player: GamePlayerRecord,
    finds: Find[],
    options: { dig?: boolean; golemWin?: boolean; luckBoost?: boolean; xpBoost?: boolean } = {},
  ): Promise<GrantResult> {
    const tool = toolOf(player);
    const boost = options.xpBoost ? BOOST_EFFECT.xp : 1;
    const xp = Math.round(finds.reduce((sum, f) => sum + RARITY[f.item.rarity].xp * (f.shiny ? 2 : 1), 0) * tool.xpBoost * boost);

    const inc: Record<string, number> = { xp };
    if (options.dig) inc.digs = 1;
    if (options.luckBoost) inc['boosts.luck'] = -1;
    if (options.xpBoost) inc['boosts.xp'] = -1;
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
      if (days > (player.bestStreak ?? 0)) set.bestStreak = days;
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
      if (find && count > 0) entries.push({ ...find, count, value: sellValue(player, find) * count });
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

  /* ─────────────── Shop ─────────────── */

  async buyUpgrade(userId: string, id: UpgradeId): Promise<{ ok: true; player: GamePlayerRecord; level: number } | { ok: false; reason: 'max' | 'credits' | 'unknown' }> {
    const upgrade = UPGRADE_BY_ID.get(id);
    if (!upgrade) return { ok: false, reason: 'unknown' };
    const player = await this.get(userId);
    const level = upgradeLevel(player, id);
    if (level >= upgrade.maxLevel) return { ok: false, reason: 'max' };
    const price = upgradeCost(upgrade, level);
    const updated = await GamePlayerModel.findOneAndUpdate(
      { userId, credits: { $gte: price }, [`upgrades.${id}`]: level === 0 ? { $in: [null, 0] } : level },
      { $inc: { credits: -price, [`upgrades.${id}`]: 1 } },
      { new: true },
    ).lean<GamePlayerRecord>();
    if (!updated) return { ok: false, reason: 'credits' };
    return { ok: true, player: updated, level: level + 1 };
  }

  async buyBoost(userId: string, id: BoostId, price?: number): Promise<{ ok: true; player: GamePlayerRecord } | { ok: false; reason: 'full' | 'credits' | 'unknown' }> {
    const boost = BOOST_BY_ID.get(id);
    if (!boost) return { ok: false, reason: 'unknown' };
    const player = await this.get(userId);
    if (boostsOf(player)[id] + boost.amount > boost.cap) return { ok: false, reason: 'full' };
    const cost = price ?? boost.price;
    const field = `boosts.${id}`;
    const updated = await GamePlayerModel.findOneAndUpdate(
      { userId, credits: { $gte: cost }, $or: [{ [field]: { $lte: boost.cap - boost.amount } }, { [field]: { $exists: false } }] },
      { $inc: { credits: -cost, [field]: boost.amount } },
      { new: true },
    ).lean<GamePlayerRecord>();
    if (!updated) return { ok: false, reason: 'credits' };
    return { ok: true, player: updated };
  }

  /** Buys and opens a crate. Loot comes from your current zone. */
  async openCrate(userId: string, id: CrateId, price?: number): Promise<({ ok: true; crate: Crate } & GrantResult) | { ok: false; reason: 'credits' | 'unknown' }> {
    const crate = CRATE_BY_ID.get(id);
    if (!crate) return { ok: false, reason: 'unknown' };
    const cost = price ?? crate.price;
    const charged = await GamePlayerModel.findOneAndUpdate({ userId, credits: { $gte: cost } }, { $inc: { credits: -cost } }, { new: true }).lean<GamePlayerRecord>();
    if (!charged) return { ok: false, reason: 'credits' };
    const find = rollFind(charged.zone, 1, shinyOdds(charged), undefined, rollCrateRarity(crate));
    return { ok: true, crate, ...(await this.grant(charged, [find])) };
  }

  /** Today's 3 Black Market deals for a player. Same all day. */
  deals(player: GamePlayerRecord, day = today()): Deal[] {
    const rng = seeded(`market:${player.userId}:${day}`);
    const pick = <T>(list: readonly T[]) => list[Math.floor(rng() * list.length)]!;

    const boost = pick(BOOSTS);
    const crateRoll = rng();
    const crate = CRATES[crateRoll < 0.6 ? 0 : crateRoll < 0.95 ? 1 : 2]!;
    const unlocked = new Set(ZONES.filter((z) => z.level <= player.level).map((z) => z.id));
    const pool = ITEMS.filter((i) => unlocked.has(i.zone) && i.rarity !== 'legendary' && i.rarity !== 'common');
    const item = pick(pool);

    return [
      { slot: 0, kind: 'boost', id: boost.id, price: Math.round(boost.price * (1 - MARKET.boostDiscount)), was: boost.price },
      { slot: 1, kind: 'crate', id: crate.id, price: Math.round(crate.price * (1 - MARKET.crateDiscount)), was: crate.price },
      { slot: 2, kind: 'item', item, price: itemValue(item) * MARKET.itemMarkup, was: 0 },
    ];
  }

  boughtToday(player: GamePlayerRecord, day = today()): number[] {
    return player.market?.day === day ? player.market.bought : [];
  }

  async buyDeal(userId: string, slot: number): Promise<
    | { ok: true; deal: Deal; player: GamePlayerRecord; grant?: GrantResult }
    | { ok: false; reason: 'sold' | 'credits' | 'full' | 'unknown' }
  > {
    const day = today();
    const player = await this.get(userId);
    const deal = this.deals(player, day)[slot];
    if (!deal) return { ok: false, reason: 'unknown' };
    if (this.boughtToday(player, day).includes(slot)) return { ok: false, reason: 'sold' };
    if (deal.kind === 'boost') {
      const boost = BOOST_BY_ID.get(deal.id)!;
      if (boostsOf(player)[deal.id] + boost.amount > boost.cap) return { ok: false, reason: 'full' };
    }

    // New day → reset purchases, then claim the slot and pay in one step.
    await GamePlayerModel.updateOne({ userId, 'market.day': { $ne: day } }, { $set: { market: { day, bought: [] } } });
    const inc: Record<string, number> = { credits: -deal.price };
    if (deal.kind === 'boost') inc[`boosts.${deal.id}`] = BOOST_BY_ID.get(deal.id)!.amount;
    const claimed = await GamePlayerModel.findOneAndUpdate(
      { userId, credits: { $gte: deal.price }, 'market.day': day, 'market.bought': { $ne: slot } },
      { $inc: inc, $push: { 'market.bought': slot } },
      { new: true },
    ).lean<GamePlayerRecord>();
    if (!claimed) {
      const fresh = await this.get(userId);
      return { ok: false, reason: this.boughtToday(fresh, day).includes(slot) ? 'sold' : 'credits' };
    }

    if (deal.kind === 'crate') {
      const crate = CRATE_BY_ID.get(deal.id)!;
      const grant = await this.grant(claimed, [rollFind(claimed.zone, 1, shinyOdds(claimed), undefined, rollCrateRarity(crate))]);
      return { ok: true, deal, player: grant.player, grant };
    }
    if (deal.kind === 'item') {
      const grant = await this.grant(claimed, [{ item: deal.item, shiny: false }]);
      return { ok: true, deal, player: grant.player, grant };
    }
    return { ok: true, deal, player: claimed };
  }

  /** Can this player unlock a cosmetic? Returns a reason if not. */
  cosmeticLocked(player: GamePlayerRecord, kind: 'theme' | 'title', id: string): string | null {
    const entry = kind === 'theme' ? THEME_BY_ID.get(id) : TITLE_BY_ID.get(id);
    if (!entry) return "That doesn't exist.";
    if (player.level < entry.level) return `Reach level **${entry.level}** first.`;
    const req = kind === 'title' ? TITLE_BY_ID.get(id)!.requirement : undefined;
    if (req?.golemWins && player.golemWins < req.golemWins) return `Beat **${req.golemWins}** golems first (${player.golemWins} so far).`;
    if (req?.digs && player.digs < req.digs) return `Dig **${req.digs.toLocaleString()}** times first (${player.digs.toLocaleString()} so far).`;
    if (req?.shinies && player.shinies.length < req.shinies) return `Find **${req.shinies}** different shinies first (${player.shinies.length} so far).`;
    return null;
  }

  async buyCosmetic(userId: string, kind: 'theme' | 'title', id: string): Promise<{ ok: true; player: GamePlayerRecord; bought: boolean } | { ok: false; reason: string }> {
    const player = await this.get(userId);
    const owned = kind === 'theme' ? (player.ownedThemes ?? ['hazard']) : (player.ownedTitles ?? ['rookie']);
    const ownedField = kind === 'theme' ? 'ownedThemes' : 'ownedTitles';
    if (owned.includes(id)) {
      const updated = await GamePlayerModel.findOneAndUpdate({ userId }, { $set: { [kind]: id } }, { new: true }).lean<GamePlayerRecord>();
      return { ok: true, player: updated!, bought: false };
    }
    const locked = this.cosmeticLocked(player, kind, id);
    if (locked) return { ok: false, reason: locked };
    const price = (kind === 'theme' ? THEME_BY_ID.get(id)! : TITLE_BY_ID.get(id)!).price;
    const updated = await GamePlayerModel.findOneAndUpdate(
      { userId, credits: { $gte: price }, [ownedField]: { $ne: id } },
      { $inc: { credits: -price }, $addToSet: { [ownedField]: id }, $set: { [kind]: id } },
      { new: true },
    ).lean<GamePlayerRecord>();
    if (!updated) return { ok: false, reason: "You don't have enough credits yet." };
    return { ok: true, player: updated, bought: true };
  }

  /** Badges this player has earned. */
  badges(player: GamePlayerRecord): Badge[] {
    const found = player.found ?? {};
    const has = (id: string) => (found[id] ?? 0) > 0;
    const earned = new Set<string>();
    if (ITEMS.some((i) => i.rarity === 'legendary' && has(i.id))) earned.add('legend');
    if (player.shinies.length) earned.add('shiny');
    if (player.golemWins >= 10) earned.add('slayer');
    if (ZONES.some((z) => itemsInZone(z.id).every((i) => has(i.id)))) earned.add('collector');
    if (Math.max(player.bestStreak ?? 0, player.streak) >= 7) earned.add('streak');
    if (player.level >= 50) earned.add('explorer');
    return BADGES.filter((b) => earned.has(b.id));
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
