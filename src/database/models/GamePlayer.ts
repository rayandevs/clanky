import { Schema, model } from 'mongoose';

export type GameEventType = 'golem' | 'crate';

/**
 * A Salvage player. Progress is global: it follows the user to every
 * server. `guildIds` records where they've played, for server leaderboards.
 */
export interface GamePlayerRecord {
  userId: string;
  xp: number;
  level: number;
  credits: number;
  lifetimeCredits: number;
  digs: number;
  zone: string;
  tool: string;
  ownedTools: string[];
  /** Bag key (itemId, or itemId__shiny) → count. Plain object when read with lean(). */
  inventory: Record<string, number>;
  /** itemId → how many were ever found (collection log) */
  found: Record<string, number>;
  shinies: string[];
  bestFind: { itemId: string; shiny: boolean } | null;
  streak: number;
  /** UTC day (YYYY-MM-DD) of the last streak check-in */
  streakDay: string | null;
  cooldownUntil: Date;
  pendingEvent: { type: GameEventType; zone: string; expiresAt: Date } | null;
  golemWins: number;
  bestStreak: number;
  /** Upgrade id → level */
  upgrades: Record<string, number>;
  /** Digs left on each boost (bait = uses) */
  boosts: { luck: number; xp: number; bait: number };
  /** Black Market purchases today */
  market: { day: string; bought: number[] } | null;
  theme: string;
  ownedThemes: string[];
  title: string;
  ownedTitles: string[];
  guildIds: string[];
}

const gamePlayerSchema = new Schema<GamePlayerRecord>(
  {
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    credits: { type: Number, default: 0 },
    lifetimeCredits: { type: Number, default: 0 },
    digs: { type: Number, default: 0 },
    zone: { type: String, default: 'scrapyard' },
    tool: { type: String, default: 'rusty_shovel' },
    ownedTools: { type: [String], default: ['rusty_shovel'] },
    inventory: { type: Map, of: Number, default: {} },
    found: { type: Map, of: Number, default: {} },
    shinies: { type: [String], default: [] },
    bestFind: { type: new Schema({ itemId: String, shiny: Boolean }, { _id: false }), default: null },
    streak: { type: Number, default: 0 },
    streakDay: { type: String, default: null },
    cooldownUntil: { type: Date, default: () => new Date(0) },
    pendingEvent: { type: new Schema({ type: { type: String }, zone: String, expiresAt: Date }, { _id: false }), default: null },
    golemWins: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    upgrades: { type: Map, of: Number, default: {} },
    boosts: { type: new Schema({ luck: { type: Number, default: 0 }, xp: { type: Number, default: 0 }, bait: { type: Number, default: 0 } }, { _id: false }), default: () => ({}) },
    market: { type: new Schema({ day: String, bought: [Number] }, { _id: false }), default: null },
    theme: { type: String, default: 'hazard' },
    ownedThemes: { type: [String], default: ['hazard'] },
    title: { type: String, default: 'rookie' },
    ownedTitles: { type: [String], default: ['rookie'] },
    guildIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

gamePlayerSchema.index({ xp: -1 });
gamePlayerSchema.index({ guildIds: 1, xp: -1 });

export const GamePlayerModel = model<GamePlayerRecord>('GamePlayer', gamePlayerSchema);
