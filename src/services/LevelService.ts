import { MemberModel, type MemberRecord } from '../database/models/index.js';
import type { GuildSettings } from '../settings/schema.js';

/** XP needed to go from `level` to `level + 1`. */
export const xpForNext = (level: number) => 5 * level ** 2 + 50 * level + 100;

/** Total XP needed to reach `level` from zero. */
export function totalXpFor(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += xpForNext(i);
  return total;
}

export function levelFromXp(xp: number): { level: number; current: number; needed: number } {
  let level = 0;
  let remaining = xp;
  while (remaining >= xpForNext(level)) {
    remaining -= xpForNext(level);
    level++;
  }
  return { level, current: remaining, needed: xpForNext(level) };
}

class LevelService {
  /** In-memory cooldowns so we don't hit the database for every message. */
  private readonly cooldowns = new Map<string, number>();

  /**
   * Award XP for a message. Returns the new level if the member leveled up.
   */
  async handleMessage(guildId: string, userId: string, config: GuildSettings['leveling']): Promise<number | null> {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const readyAt = this.cooldowns.get(key) ?? 0;
    if (readyAt > now) return null;
    this.cooldowns.set(key, now + config.cooldownSeconds * 1000);

    const min = Math.min(config.xpMin, config.xpMax);
    const max = Math.max(config.xpMin, config.xpMax);
    const gained = Math.floor(Math.random() * (max - min + 1)) + min;

    const doc = await MemberModel.findOneAndUpdate(
      { guildId, userId },
      { $inc: { xp: gained, messages: 1 }, $set: { lastXpAt: new Date() } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean<MemberRecord>();

    const { level } = levelFromXp(doc!.xp);
    if (level > doc!.level) {
      await MemberModel.updateOne({ guildId, userId }, { $set: { level } });
      return level;
    }
    return null;
  }

  async get(guildId: string, userId: string): Promise<MemberRecord | null> {
    return MemberModel.findOne({ guildId, userId }).lean<MemberRecord>();
  }

  async rank(guildId: string, xp: number): Promise<number> {
    return (await MemberModel.countDocuments({ guildId, xp: { $gt: xp } })) + 1;
  }

  async leaderboard(guildId: string, page: number, perPage = 10) {
    const [entries, total] = await Promise.all([
      MemberModel.find({ guildId, xp: { $gt: 0 } })
        .sort({ xp: -1 })
        .skip(page * perPage)
        .limit(perPage)
        .lean<MemberRecord[]>(),
      MemberModel.countDocuments({ guildId, xp: { $gt: 0 } }),
    ]);
    return { entries, total, pages: Math.max(1, Math.ceil(total / perPage)) };
  }

  /** Change a member's XP (admin tool). Returns the updated record. */
  async adjust(guildId: string, userId: string, change: { add?: number; set?: number }): Promise<MemberRecord> {
    const current = (await this.get(guildId, userId))?.xp ?? 0;
    const xp = Math.max(0, change.set ?? current + (change.add ?? 0));
    const { level } = levelFromXp(xp);
    const doc = await MemberModel.findOneAndUpdate(
      { guildId, userId },
      { $set: { xp, level } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean<MemberRecord>();
    return doc!;
  }

  async reset(guildId: string): Promise<number> {
    const result = await MemberModel.updateMany({ guildId }, { $set: { xp: 0, level: 0 } });
    return result.modifiedCount;
  }
}

export const levels = new LevelService();
