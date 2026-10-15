/**
 * Salvage — game content.
 *
 * Everything that defines the game lives here as plain data, so new zones,
 * items and tools can be added (or balanced) without touching game logic.
 * The upcoming dashboard can read this file as-is.
 */

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export interface RarityInfo {
  name: string;
  /** Base weight for the loot roll */
  weight: number;
  /** Game XP for finding one */
  xp: number;
  color: number;
}

export const RARITY: Record<Rarity, RarityInfo> = {
  common: { name: 'Common', weight: 600, xp: 3, color: 0x9ca3af },
  uncommon: { name: 'Uncommon', weight: 260, xp: 6, color: 0x4ade80 },
  rare: { name: 'Rare', weight: 100, xp: 15, color: 0x60a5fa },
  epic: { name: 'Epic', weight: 32, xp: 40, color: 0xc084fc },
  legendary: { name: 'Legendary', weight: 8, xp: 120, color: 0xfbbf24 },
};

export const rarityRank = (rarity: Rarity) => RARITIES.indexOf(rarity);

export interface Zone {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Game level needed to travel here */
  level: number;
  /** Multiplies item values */
  valueMultiplier: number;
}

export const ZONES: Zone[] = [
  { id: 'scrapyard', name: 'Scrapyard', emoji: '🏚️', description: 'Where every salvager starts.', level: 1, valueMultiplier: 1 },
  { id: 'junkcity', name: 'Junk City', emoji: '🌆', description: 'Old gadgets everywhere.', level: 10, valueMultiplier: 1.6 },
  { id: 'graveyard', name: 'Robot Graveyard', emoji: '⚰️', description: 'Retired robots rest here.', level: 25, valueMultiplier: 2.5 },
  { id: 'spacedump', name: 'Space Dump', emoji: '🌌', description: 'Junk that fell from orbit.', level: 50, valueMultiplier: 4 },
];

export interface Item {
  id: string;
  name: string;
  zone: string;
  rarity: Rarity;
  /** Base sell value in credits (before the zone multiplier) */
  value: number;
  /** Unicode emoji shown in messages */
  emoji: string;
  /** Twemoji file in assets/game/icons (used on image cards) */
  icon: string;
}

const item = (zone: string, rarity: Rarity, id: string, name: string, value: number, emoji: string, icon: string): Item => ({
  id,
  name,
  zone,
  rarity,
  value,
  emoji,
  icon,
});

export const ITEMS: Item[] = [
  // Scrapyard
  item('scrapyard', 'common', 'rusty_bolt', 'Rusty Bolt', 5, '🔩', '1f529'),
  item('scrapyard', 'common', 'tin_can', 'Tin Can', 4, '🥫', '1f96b'),
  item('scrapyard', 'common', 'copper_wire', 'Copper Wire', 6, '🧵', '1f9f5'),
  item('scrapyard', 'common', 'old_battery', 'Old Battery', 8, '🔋', '1f50b'),
  item('scrapyard', 'uncommon', 'bent_gear', 'Bent Gear', 20, '⚙️', '2699'),
  item('scrapyard', 'uncommon', 'magnet', 'Magnet', 25, '🧲', '1f9f2'),
  item('scrapyard', 'uncommon', 'light_bulb', 'Light Bulb', 22, '💡', '1f4a1'),
  item('scrapyard', 'rare', 'old_radio', 'Old Radio', 80, '📻', '1f4fb'),
  item('scrapyard', 'rare', 'floppy_disk', 'Floppy Disk', 90, '💾', '1f4be'),
  item('scrapyard', 'epic', 'robot_arm', 'Robot Arm', 350, '🦾', '1f9be'),
  item('scrapyard', 'legendary', 'quantum_core', 'Quantum Core', 2000, '💠', '1f4a0'),
  // Junk City
  item('junkcity', 'common', 'cracked_phone', 'Cracked Phone', 5, '📱', '1f4f1'),
  item('junkcity', 'common', 'shopping_cart', 'Shopping Cart', 6, '🛒', '1f6d2'),
  item('junkcity', 'common', 'old_key', 'Old Key', 4, '🗝️', '1f5dd'),
  item('junkcity', 'common', 'scratched_cd', 'Scratched CD', 5, '💿', '1f4bf'),
  item('junkcity', 'uncommon', 'alarm_clock', 'Alarm Clock', 22, '⏰', '23f0'),
  item('junkcity', 'uncommon', 'camera', 'Camera', 26, '📷', '1f4f7'),
  item('junkcity', 'uncommon', 'keyboard', 'Keyboard', 20, '⌨️', '2328'),
  item('junkcity', 'rare', 'joystick', 'Joystick', 85, '🕹️', '1f579'),
  item('junkcity', 'rare', 'old_tv', 'Old TV', 95, '📺', '1f4fa'),
  item('junkcity', 'epic', 'satellite_dish', 'Satellite Dish', 380, '📡', '1f4e1'),
  item('junkcity', 'legendary', 'scrap_crown', "Scrap King's Crown", 2200, '👑', '1f451'),
  // Robot Graveyard
  item('graveyard', 'common', 'steel_coin', 'Steel Coin', 6, '🪙', '1fa99'),
  item('graveyard', 'common', 'spare_wheel', 'Spare Wheel', 7, '🛞', '1f6de'),
  item('graveyard', 'common', 'toolbox', 'Toolbox', 6, '🧰', '1f9f0'),
  item('graveyard', 'common', 'ladder', 'Ladder', 5, '🪜', '1fa9c'),
  item('graveyard', 'uncommon', 'robot_leg', 'Robot Leg', 24, '🦿', '1f9bf'),
  item('graveyard', 'uncommon', 'microscope', 'Microscope', 26, '🔬', '1f52c'),
  item('graveyard', 'uncommon', 'stopwatch', 'Stopwatch', 22, '⏱️', '23f1'),
  item('graveyard', 'rare', 'hard_drive', 'Hard Drive', 90, '💽', '1f4bd'),
  item('graveyard', 'rare', 'telescope', 'Telescope', 100, '🔭', '1f52d'),
  item('graveyard', 'epic', 'android_head', 'Android Head', 400, '🤖', '1f916'),
  item('graveyard', 'legendary', 'mech_heart', 'Mech Heart', 2400, '🫀', '1fac0'),
  // Space Dump
  item('spacedump', 'common', 'meteor_rock', 'Meteor Rock', 6, '🪨', '1faa8'),
  item('spacedump', 'common', 'space_ice', 'Space Ice', 5, '🧊', '1f9ca'),
  item('spacedump', 'common', 'star_dust', 'Star Dust', 7, '✨', '2728'),
  item('spacedump', 'common', 'alien_goo', 'Alien Goo', 6, '🫧', '1fae7'),
  item('spacedump', 'uncommon', 'plasma_orb', 'Plasma Orb', 25, '🔮', '1f52e'),
  item('spacedump', 'uncommon', 'moon_rock', 'Moon Rock', 22, '🌑', '1f311'),
  item('spacedump', 'uncommon', 'mini_satellite', 'Mini Satellite', 28, '🛰️', '1f6f0'),
  item('spacedump', 'rare', 'rocket_engine', 'Rocket Engine', 100, '🚀', '1f680'),
  item('spacedump', 'rare', 'mini_planet', 'Mini Planet', 110, '🪐', '1fa90'),
  item('spacedump', 'epic', 'ufo', 'UFO', 450, '🛸', '1f6f8'),
  item('spacedump', 'legendary', 'comet_shard', 'Comet Shard', 2800, '☄️', '2604'),
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const ZONE_BY_ID = new Map(ZONES.map((z) => [z.id, z]));
export const itemsInZone = (zoneId: string) => ITEMS.filter((i) => i.zone === zoneId);

/** Sell value of one item. */
export const itemValue = (it: Item) => Math.round(it.value * (ZONE_BY_ID.get(it.zone)?.valueMultiplier ?? 1));

export interface Tool {
  id: string;
  name: string;
  emoji: string;
  price: number;
  level: number;
  /** Multiplies the chance of Rare and better finds */
  luck: number;
  /** Multiplies game XP */
  xpBoost: number;
  /** Chance (0–1) to find a second item */
  doubleChance: number;
}

export const TOOLS: Tool[] = [
  { id: 'rusty_shovel', name: 'Rusty Shovel', emoji: '🥄', price: 0, level: 1, luck: 1, xpBoost: 1, doubleChance: 0 },
  { id: 'steel_shovel', name: 'Steel Shovel', emoji: '⛏️', price: 2_000, level: 3, luck: 1.15, xpBoost: 1.1, doubleChance: 0.05 },
  { id: 'magnet_rake', name: 'Magnet Rake', emoji: '🧲', price: 12_000, level: 10, luck: 1.35, xpBoost: 1.25, doubleChance: 0.1 },
  { id: 'plasma_drill', name: 'Plasma Drill', emoji: '🔫', price: 60_000, level: 25, luck: 1.6, xpBoost: 1.5, doubleChance: 0.15 },
  { id: 'quantum_digger', name: 'Quantum Digger', emoji: '🌀', price: 250_000, level: 50, luck: 2, xpBoost: 2, doubleChance: 0.25 },
];

export const TOOL_BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

/* ─────────────── Balance ─────────────── */

export const BALANCE = {
  /** Seconds between digs */
  digCooldown: 4,
  /** 1 in N finds is shiny (worth 5×) */
  shinyOdds: 150,
  shinyMultiplier: 5,
  /** Chance (0–1) that a dig triggers an event instead */
  eventChance: 0.04,
  /** Seconds a player has to react to an event */
  eventTimeout: 60,
  /** Base win chance against the Scrap Golem (tool luck adds to it) */
  golemWinChance: 0.55,
  /** Extra seconds of cooldown after losing to the golem */
  golemPenalty: 20,
  /** Credits per streak day for the first dig of the day (capped) */
  streakBonus: 50,
  streakCap: 14,
  /** Credits per level reached */
  levelReward: 50,
} as const;

/** Game XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number) => 50 + 25 * level;

/** Level and progress from total game XP. */
export function gameLevel(xp: number): { level: number; current: number; needed: number } {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level++;
  }
  return { level, current: remaining, needed: xpToNext(level) };
}
