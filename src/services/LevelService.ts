import { randomUUID } from 'node:crypto';
import { LevelActivityModel, LevelSeasonModel, LevelSeasonScoreModel, MemberModel, type LevelSeasonRecord, type MemberRecord } from '../database/models/index.js';
import type { GuildSettings } from '../settings/schema.js';

export type CurvePreset = GuildSettings['leveling']['curvePreset'];

const CURVE_SCALE: Record<CurvePreset, number> = { relaxed: 0.75, classic: 1, challenging: 1.5 };
const utcDay = (value: Date) => value.toISOString().slice(0, 10);

/** XP needed to go from `level` to `level + 1` for the selected progression curve. */
export function xpForNext(level: number, curve: CurvePreset = 'classic'): number {
  const classic = 5 * level ** 2 + 50 * level + 100;
  return Math.max(1, Math.round(classic * CURVE_SCALE[curve]));
}

/** Total XP needed to reach `level` from zero on a single curve. */
export function totalXpFor(level: number, curve: CurvePreset = 'classic'): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += xpForNext(i, curve);
  return total;
}

export function levelFromXp(xp: number, curve: CurvePreset = 'classic'): { level: number; current: number; needed: number } {
  let level = 0;
  let remaining = Math.max(0, xp);
  while (remaining >= xpForNext(level, curve)) {
    remaining -= xpForNext(level, curve);
    level++;
  }
  return { level, current: remaining, needed: xpForNext(level, curve) };
}

export function progressForMember(record: Pick<MemberRecord, 'xp' | 'level' | 'levelProgress'>, curve: CurvePreset) {
  const level = record.level ?? 0;
  const needed = xpForNext(level, curve);
  const fraction = Math.min(0.999999, Math.max(0, record.levelProgress ?? 0));
  return { level, current: Math.floor(fraction * needed), needed, fraction };
}

export function xpMultiplier(config: GuildSettings['leveling'], channelId: string, parentId: string | null, roleIds: string[]): number {
  const channelIds = new Set([channelId, ...(parentId ? [parentId] : [])]);
  const channel = Math.max(1, ...config.channelMultipliers.filter((item) => channelIds.has(item.channelId)).map((item) => item.multiplier));
  const memberRoles = new Set(roleIds);
  const role = Math.max(1, ...config.roleMultipliers.filter((item) => memberRoles.has(item.roleId)).map((item) => item.multiplier));
  return Math.min(5, channel * role);
}

interface AwardOptions {
  channelId?: string;
  parentId?: string | null;
  roleIds?: string[];
  contentLength?: number;
}

export interface LevelAnalytics {
  days: Array<{ day: string; messages: number; xp: number; activeMembers: number }>;
  summary: { messages: number; xp: number; activeMembers: number };
  topGainers: Array<{ userId: string; xp: number; messages: number }>;
}

class LevelService {
  /** Process-local cooldowns avoid database reads for messages that cannot earn XP. */
  private readonly cooldowns = new Map<string, number>();
  private readonly locks = new Map<string, Promise<void>>();
  private cooldownsLastCleaned = 0;

  private async withMemberLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.locks.set(key, current);
    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }

  /** Migrate legacy XP-derived levels and retain the old awarded-message count separately. */
  async migrateMemberProgress(): Promise<number> {
    const cursor = MemberModel.find({
      $or: [
        { levelProgress: { $exists: false } },
        { xpMessages: { $exists: false } },
        { messageTrackingStartedAt: { $exists: false } },
        { curvePreset: { $exists: false } },
      ],
    }).lean().cursor();
    const startedAt = new Date();
    let updates: Array<Record<string, unknown>> = [];
    let migrated = 0;
    const flush = async () => {
      if (!updates.length) return;
      await MemberModel.bulkWrite(updates as never[], { ordered: false });
      updates = [];
    };

    for await (const record of cursor) {
      const progress = levelFromXp(record.xp ?? 0, 'classic');
      const set: Record<string, unknown> = {
        level: progress.level,
        levelProgress: progress.needed ? progress.current / progress.needed : 0,
        curvePreset: 'classic',
        xpMessages: record.xpMessages ?? record.messages ?? 0,
        messageTrackingStartedAt: record.messageTrackingStartedAt ?? startedAt,
      };
      if (!record.messageTrackingStartedAt) set.messages = 0;
      updates.push({ updateOne: { filter: { _id: record._id }, update: { $set: set } } });
      migrated++;
      if (updates.length >= 500) await flush();
    }
    await flush();
    return migrated;
  }

  /** Count every human guild message independently of leveling, channel exclusions, and XP cooldowns. */
  async recordMessage(guildId: string, userId: string): Promise<void> {
    const day = utcDay(new Date());
    await Promise.all([
      MemberModel.updateOne(
        { guildId, userId },
        { $inc: { messages: 1 }, $setOnInsert: { messageTrackingStartedAt: new Date(), curvePreset: 'classic' } },
        { upsert: true, setDefaultsOnInsert: true },
      ),
      LevelActivityModel.updateOne(
        { guildId, userId, day },
        { $inc: { messages: 1 }, $setOnInsert: { guildId, userId, day } },
        { upsert: true, setDefaultsOnInsert: true },
      ),
    ]);
  }

  /** Award XP after channel, content, role, multiplier, and cooldown rules pass. */
  async handleMessage(guildId: string, userId: string, config: GuildSettings['leveling'], options: AwardOptions = {}): Promise<number | null> {
    if (!config.enabled) return null;
    const channelId = options.channelId ?? '';
    if (config.ignoredChannelIds.includes(channelId) || (options.parentId && config.ignoredChannelIds.includes(options.parentId))) return null;
    if ((options.contentLength ?? 0) < config.minMessageLength) return null;

    const key = `${guildId}:${userId}`;
    return this.withMemberLock(key, async () => {
      const now = Date.now();
      if ((this.cooldowns.get(key) ?? 0) > now) return null;
      if (this.cooldowns.size > 50_000 && now - this.cooldownsLastCleaned > 60_000) {
        for (const [memberKey, until] of this.cooldowns) if (until <= now) this.cooldowns.delete(memberKey);
        this.cooldownsLastCleaned = now;
      }
      this.cooldowns.set(key, now + config.cooldownSeconds * 1000);

      const min = Math.min(config.xpMin, config.xpMax);
      const max = Math.max(config.xpMin, config.xpMax);
      const base = Math.floor(Math.random() * (max - min + 1)) + min;
      const multiplier = xpMultiplier(config, channelId, options.parentId ?? null, options.roleIds ?? []);
      const gained = Math.max(1, Math.round(base * multiplier));
      return this.awardXp(guildId, userId, gained, config.curvePreset, true);
    });
  }

  private async awardXp(guildId: string, userId: string, gained: number, curve: CurvePreset, fromMessage: boolean): Promise<number | null> {
    const record = await MemberModel.findOneAndUpdate(
      { guildId, userId },
      { $setOnInsert: { guildId, userId, level: 0, levelProgress: 0, curvePreset: curve, messageTrackingStartedAt: new Date() } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean<MemberRecord>();
    let level = record!.level ?? 0;
    let fraction = Math.max(0, record!.levelProgress ?? 0);
    let remaining = Math.floor(fraction * xpForNext(level, curve)) + gained;
    while (remaining >= xpForNext(level, curve)) {
      remaining -= xpForNext(level, curve);
      level++;
    }
    const nextFraction = remaining / xpForNext(level, curve);
    await MemberModel.updateOne(
      { guildId, userId },
      { $inc: { xp: gained, ...(fromMessage ? { xpMessages: 1 } : {}) }, $set: { level, levelProgress: nextFraction, curvePreset: curve, lastXpAt: new Date() } },
    );
    const day = utcDay(new Date());
    await LevelActivityModel.updateOne(
      { guildId, userId, day },
      { $inc: { xp: gained }, $setOnInsert: { guildId, userId, day } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    const season = await LevelSeasonModel.findOne({ guildId, active: true }).select({ seasonId: 1 }).lean<LevelSeasonRecord>();
    if (season) {
      await LevelSeasonScoreModel.updateOne(
        { guildId, seasonId: season.seasonId, userId },
        { $inc: { xp: gained }, $setOnInsert: { guildId, seasonId: season.seasonId, userId } },
        { upsert: true, setDefaultsOnInsert: true },
      );
    }
    return level > record!.level ? level : null;
  }

  async get(guildId: string, userId: string): Promise<MemberRecord | null> {
    return MemberModel.findOne({ guildId, userId }).lean<MemberRecord>();
  }

  async rank(guildId: string, level: number, progress: number): Promise<number> {
    const ahead = await MemberModel.countDocuments({
      guildId,
      $or: [{ level: { $gt: level } }, { level, levelProgress: { $gt: progress } }],
    });
    return ahead + 1;
  }

  async leaderboard(guildId: string, page: number, perPage = 10) {
    const filter = { guildId, xp: { $gt: 0 } };
    const [entries, total] = await Promise.all([
      MemberModel.find(filter).sort({ level: -1, levelProgress: -1, xp: -1 }).skip(page * perPage).limit(perPage).lean<MemberRecord[]>(),
      MemberModel.countDocuments(filter),
    ]);
    return { entries, total, pages: Math.max(1, Math.ceil(total / perPage)) };
  }

  async adjust(guildId: string, userId: string, change: { add?: number; set?: number }, curve: CurvePreset = 'classic'): Promise<MemberRecord> {
    return this.withMemberLock(`${guildId}:${userId}`, async () => {
      let record = await MemberModel.findOne({ guildId, userId }).lean<MemberRecord>();
      if (!record) {
        await MemberModel.create({ guildId, userId, xp: 0, level: 0, levelProgress: 0, curvePreset: curve, messages: 0, xpMessages: 0 });
        record = (await MemberModel.findOne({ guildId, userId }).lean<MemberRecord>())!;
      }
      const xp = Math.max(0, change.set ?? (record.xp ?? 0) + (change.add ?? 0));
      let level: number;
      let fraction: number;
      if (change.set !== undefined) {
        const progress = levelFromXp(xp, curve);
        level = progress.level;
        fraction = progress.current / progress.needed;
      } else {
        let remaining = Math.floor((record.levelProgress ?? 0) * xpForNext(record.level, curve)) + (change.add ?? 0);
        level = record.level;
        while (remaining >= xpForNext(level, curve)) { remaining -= xpForNext(level, curve); level++; }
        while (remaining < 0 && level > 0) { level--; remaining += xpForNext(level, curve); }
        remaining = Math.max(0, remaining);
        fraction = remaining / xpForNext(level, curve);
      }
      await MemberModel.updateOne({ guildId, userId }, { $set: { xp, level, levelProgress: fraction, curvePreset: curve } });
      return (await MemberModel.findOne({ guildId, userId }).lean<MemberRecord>())!;
    });
  }

  async reset(guildId: string): Promise<number> {
    const result = await MemberModel.updateMany({ guildId }, { $set: { xp: 0, level: 0, levelProgress: 0 } });
    return result.modifiedCount;
  }

  async analytics(guildId: string, days = 14): Promise<LevelAnalytics> {
    const count = Math.max(7, Math.min(90, Math.floor(days)));
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (count - 1));
    const startDay = utcDay(start);
    const raw = await LevelActivityModel.aggregate([
      { $match: { guildId, day: { $gte: startDay } } },
      { $group: { _id: '$day', messages: { $sum: '$messages' }, xp: { $sum: '$xp' }, activeMembers: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]) as Array<{ _id: string; messages: number; xp: number; activeMembers: number }>;
    const byDay = new Map(raw.map((row) => [row._id, row]));
    const daysData = Array.from({ length: count }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const day = utcDay(date);
      const row = byDay.get(day);
      return { day, messages: row?.messages ?? 0, xp: row?.xp ?? 0, activeMembers: row?.activeMembers ?? 0 };
    });
    const topGainers = await LevelActivityModel.aggregate([
      { $match: { guildId, day: { $gte: startDay } } },
      { $group: { _id: '$userId', xp: { $sum: '$xp' }, messages: { $sum: '$messages' } } },
      { $sort: { xp: -1, messages: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, userId: '$_id', xp: 1, messages: 1 } },
    ]) as Array<{ userId: string; xp: number; messages: number }>;
    const activeMembers = await LevelActivityModel.distinct('userId', { guildId, day: { $gte: startDay } }).then((users) => users.length);
    return {
      days: daysData,
      summary: {
        messages: daysData.reduce((sum, row) => sum + row.messages, 0),
        xp: daysData.reduce((sum, row) => sum + row.xp, 0),
        activeMembers,
      },
      topGainers,
    };
  }

  async activeSeason(guildId: string): Promise<LevelSeasonRecord | null> {
    return LevelSeasonModel.findOne({ guildId, active: true }).lean<LevelSeasonRecord>();
  }

  async latestSeason(guildId: string): Promise<LevelSeasonRecord | null> {
    return LevelSeasonModel.findOne({ guildId }).sort({ startedAt: -1 }).lean<LevelSeasonRecord>();
  }

  async listSeasons(guildId: string, limit = 10): Promise<LevelSeasonRecord[]> {
    return LevelSeasonModel.find({ guildId }).sort({ startedAt: -1 }).limit(limit).lean<LevelSeasonRecord[]>();
  }

  async startSeason(guildId: string, name: string, createdBy: string, rewardRoleId: string | null, rewardTopCount: number): Promise<LevelSeasonRecord> {
    const active = await this.activeSeason(guildId);
    if (active) throw new Error('A season is already active. End it before starting another.');
    return LevelSeasonModel.create({ guildId, seasonId: randomUUID(), name: name.trim(), active: true, startedAt: new Date(), rewardRoleId, rewardTopCount, createdBy });
  }

  async endSeason(guildId: string): Promise<LevelSeasonRecord | null> {
    return LevelSeasonModel.findOneAndUpdate({ guildId, active: true }, { $set: { active: false, endedAt: new Date() } }, { returnDocument: 'after' }).lean<LevelSeasonRecord>();
  }

  async seasonLeaderboard(guildId: string, page = 0, perPage = 10, seasonId?: string) {
    const season = seasonId
      ? await LevelSeasonModel.findOne({ guildId, seasonId }).lean<LevelSeasonRecord>()
      : await this.activeSeason(guildId);
    if (!season) return { season: null, entries: [], total: 0, pages: 1 };
    const filter = { guildId, seasonId: season.seasonId, xp: { $gt: 0 } };
    const [entries, total] = await Promise.all([
      LevelSeasonScoreModel.find(filter).sort({ xp: -1 }).skip(page * perPage).limit(perPage).lean(),
      LevelSeasonScoreModel.countDocuments(filter),
    ]);
    return { season, entries, total, pages: Math.max(1, Math.ceil(total / perPage)) };
  }

  async seasonMember(guildId: string, seasonId: string, userId: string) {
    return LevelSeasonScoreModel.findOne({ guildId, seasonId, userId }).lean();
  }

  async seasonRank(guildId: string, seasonId: string, xp: number): Promise<number> {
    return (await LevelSeasonScoreModel.countDocuments({ guildId, seasonId, xp: { $gt: xp } })) + 1;
  }

  async seasonRewardsPreview(guildId: string, seasonId: string, limit = 3) {
    const scores = await LevelSeasonScoreModel.find({ guildId, seasonId }).sort({ xp: -1 }).limit(limit).lean();
    return scores.map((score, index) => ({ rank: index + 1, userId: score.userId, xp: score.xp }));
  }
}

export const levels = new LevelService();
