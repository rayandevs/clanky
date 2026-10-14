import type { Guild } from 'discord.js';
import { env } from '../config/env.js';
import { createLogger } from '../core/logger.js';
import { GuildModel, SettingsAuditModel, type GuildRecord } from '../database/models/index.js';
import {
  GuildSettingsSchema,
  parseGuildSettings,
  type GuildSettings,
  type SettingsSection,
} from '../settings/schema.js';
import { TTLCache } from './cache.js';
import { bus } from './events.js';

const log = createLogger('guilds');

export interface Actor {
  id: string;
  source?: 'bot' | 'dashboard' | 'system';
}

type Counter = keyof GuildRecord['counters'];

function normalize(doc: GuildRecord): GuildRecord {
  return { ...doc, settings: parseGuildSettings(doc.settings) };
}

class GuildService {
  private readonly cache = new TTLCache<string, GuildRecord>(5 * 60_000);

  /** Get a server's record (created with defaults if missing). */
  async get(guildId: string): Promise<GuildRecord> {
    const cached = this.cache.get(guildId);
    if (cached) return cached;

    const doc = await GuildModel.findOneAndUpdate(
      { guildId },
      { $setOnInsert: { guildId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean<GuildRecord>();

    const record = normalize(doc!);
    this.cache.set(guildId, record);
    return record;
  }

  /** Sync identifying information (name, icon, owner). */
  async sync(guild: Guild): Promise<GuildRecord> {
    const doc = await GuildModel.findOneAndUpdate(
      { guildId: guild.id },
      {
        $set: { name: guild.name, icon: guild.icon, ownerId: guild.ownerId, active: true, leftAt: null },
        $setOnInsert: { joinedAt: guild.joinedAt ?? new Date() },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean<GuildRecord>();
    const record = normalize(doc!);
    this.cache.set(guild.id, record);
    return record;
  }

  async markLeft(guildId: string): Promise<void> {
    await GuildModel.updateOne({ guildId }, { $set: { active: false, leftAt: new Date() } });
    this.cache.delete(guildId);
  }

  async settings(guildId: string): Promise<GuildSettings> {
    return (await this.get(guildId)).settings;
  }

  /**
   * Update settings with a mutator. Changes are validated against the
   * schema, saved, recorded in the audit log and broadcast on the bus.
   */
  async update(
    guildId: string,
    mutate: (draft: GuildSettings) => void,
    actor: Actor,
  ): Promise<GuildSettings> {
    const current = await this.settings(guildId);
    const draft = structuredClone(current);
    mutate(draft);
    const next = GuildSettingsSchema.parse(draft);

    const changed = (Object.keys(next) as SettingsSection[]).filter(
      (key) => JSON.stringify(next[key]) !== JSON.stringify(current[key]),
    );
    if (!changed.length) return current;

    const $set = Object.fromEntries(changed.map((key) => [`settings.${key}`, next[key]]));
    const doc = await GuildModel.findOneAndUpdate({ guildId }, { $set }, { returnDocument: 'after' }).lean<GuildRecord>();
    if (doc) this.cache.set(guildId, normalize(doc));

    const source = actor.source ?? 'bot';
    SettingsAuditModel.insertMany(
      changed.map((section) => ({ guildId, actorId: actor.id, source, section, before: current[section], after: next[section] })),
    ).catch((error) => log.warn('Could not write settings audit', error));

    bus.emit('settingsChanged', { guildId, sections: changed, actorId: actor.id, source });
    return next;
  }

  /** Atomically get the next number for cases, tickets or suggestions. */
  async nextCounter(guildId: string, counter: Counter): Promise<number> {
    const doc = await GuildModel.findOneAndUpdate(
      { guildId },
      { $inc: { [`counters.${counter}`]: 1 } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean<GuildRecord>();
    this.cache.delete(guildId);
    return doc!.counters[counter];
  }

  async setMeta(guildId: string, meta: Partial<GuildRecord['meta']>): Promise<void> {
    const $set = Object.fromEntries(Object.entries(meta).map(([k, v]) => [`meta.${k}`, v]));
    await GuildModel.updateOne({ guildId }, { $set });
    this.cache.delete(guildId);
  }

  invalidate(guildId: string): void {
    this.cache.delete(guildId);
  }

  /**
   * Keep the cache fresh when another process (the dashboard) edits a
   * server's settings. Requires MongoDB running as a replica set.
   */
  watchExternalChanges(): void {
    if (!env.MONGODB_WATCH_CHANGES) return;
    try {
      const stream = GuildModel.watch([], { fullDocument: 'updateLookup' });
      stream.on('change', (change: { documentKey?: { _id: unknown }; fullDocument?: GuildRecord }) => {
        const guildId = change.fullDocument?.guildId;
        if (guildId) this.cache.delete(guildId);
      });
      stream.on('error', (error) => log.warn('Change stream stopped', error));
      log.info('Watching for external settings changes');
    } catch (error) {
      log.warn('Change streams are not available', error);
    }
  }
}

export const guilds = new GuildService();
