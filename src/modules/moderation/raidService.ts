import { PermissionFlagsBits, type Client, type Guild, type GuildTextBasedChannel } from 'discord.js';
import { createLogger } from '../../core/logger.js';
import { RaidResponseModel, type RaidChannelSnapshot, type RaidResponseRecord } from '../../database/models/index.js';
import { guilds } from '../../services/index.js';

const log = createLogger('raid-response');
const guildLocks = new Map<string, Promise<void>>();

async function withGuildLock<T>(guildId: string, work: () => Promise<T>): Promise<T> {
  const previous = guildLocks.get(guildId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  guildLocks.set(guildId, current);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (guildLocks.get(guildId) === current) guildLocks.delete(guildId);
  }
}

type SlowmodeChannel = GuildTextBasedChannel & { rateLimitPerUser: number; setRateLimitPerUser: (seconds: number, reason?: string) => Promise<unknown> };
function isSlowmodeChannel(channel: unknown): channel is SlowmodeChannel {
  return Boolean(channel && typeof channel === 'object' && 'rateLimitPerUser' in channel && 'setRateLimitPerUser' in channel);
}

export class RaidResponseError extends Error {}

export async function activeRaid(guildId: string): Promise<RaidResponseRecord | null> {
  return RaidResponseModel.findOne({ guildId, status: 'active' }).lean<RaidResponseRecord>();
}

export async function startRaidResponse(guild: Guild, actorId: string, durationMs: number): Promise<RaidResponseRecord> {
  return withGuildLock(guild.id, async () => {
  if (durationMs < 300_000 || durationMs > 86_400_000) throw new RaidResponseError('Choose a duration between 5 minutes and 24 hours.');
  const settings = await guilds.settings(guild.id);
  const channelIds = settings.moderation.raidChannelIds;
  if (!channelIds.length) throw new RaidResponseError('Choose one or more raid-response channels in the dashboard first.');
  if (await activeRaid(guild.id)) throw new RaidResponseError('A raid response is already active. End it before starting another.');

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) throw new RaidResponseError("I need the Manage Channels permission to start raid response.");
  const channels: SlowmodeChannel[] = [];
  for (const id of channelIds) {
    const channel = guild.channels.cache.get(id);
    if (!isSlowmodeChannel(channel)) throw new RaidResponseError(`Configured channel ${id} is not a supported text channel.`);
    if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels)) throw new RaidResponseError(`I can't manage slowmode in <#${id}>.`);
    channels.push(channel);
  }
  const appliedSlowmode = settings.moderation.raidSlowmodeSeconds;
  const snapshots: RaidChannelSnapshot[] = channels.map((channel) => ({ channelId: channel.id, previousSlowmode: channel.rateLimitPerUser, appliedSlowmode }));
  const now = new Date();
  let record: RaidResponseRecord;
  try {
    const saved = await RaidResponseModel.findOneAndUpdate(
      { guildId: guild.id, status: { $ne: 'active' } },
      { $set: { startedBy: actorId, startedAt: now, expiresAt: new Date(now.getTime() + durationMs), status: 'active', channels: snapshots, endedAt: null, endedBy: null } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean<RaidResponseRecord>();
    record = saved;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new RaidResponseError('A raid response is already active.');
    throw error;
  }

  try {
    for (const channel of channels) {
      await channel.setRateLimitPerUser(appliedSlowmode, 'Clanky temporary raid response');
    }
  } catch (error) {
    let rollbackComplete = true;
    for (const channel of [...channels].reverse()) {
      const previous = snapshots.find((snapshot) => snapshot.channelId === channel.id)?.previousSlowmode;
      if (previous !== undefined && channel.rateLimitPerUser === appliedSlowmode) {
        try { await channel.setRateLimitPerUser(previous, 'Rollback incomplete Clanky raid response'); }
        catch { rollbackComplete = false; }
      }
    }
    if (rollbackComplete) {
      await RaidResponseModel.updateOne({ guildId: guild.id }, { $set: { status: 'ended', endedAt: new Date(), endedBy: actorId } });
      throw new RaidResponseError(`Raid response couldn't be applied to every channel. Changes already made were rolled back. ${error instanceof Error ? error.message : ''}`.trim());
    }
    await RaidResponseModel.updateOne({ guildId: guild.id }, { $set: { expiresAt: new Date(Date.now() + 60_000) } });
    throw new RaidResponseError(`Raid response was only partly applied. Clanky will retry restoring slowmode in one minute. ${error instanceof Error ? error.message : ''}`.trim());
  }
  return record;
  });
}

async function restoreLocked(record: RaidResponseRecord, guild: Guild, endedBy: string | null, expired: boolean): Promise<boolean> {
  let complete = true;
  const me = guild.members.me;
  for (const snapshot of record.channels) {
    const channel = guild.channels.cache.get(snapshot.channelId);
    if (!isSlowmodeChannel(channel) || !me || !channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels)) {
      complete = false;
      continue;
    }
    // Do not overwrite a staff member's manual change made during the response.
    if (channel.rateLimitPerUser !== snapshot.appliedSlowmode) continue;
    try {
      await channel.setRateLimitPerUser(snapshot.previousSlowmode, 'Restore Clanky temporary raid response');
    } catch (error) {
      complete = false;
      log.warn(`Could not restore raid slowmode in ${snapshot.channelId}`, error);
    }
  }
  if (complete) {
    await RaidResponseModel.updateOne(
      { guildId: record.guildId, status: 'active' },
      { $set: { status: expired ? 'expired' : 'ended', endedAt: new Date(), endedBy } },
    );
  } else {
    // Keep it active so the expiry worker retries missing channels. Already-restored
    // channels are safe: their current value no longer equals appliedSlowmode.
    await RaidResponseModel.updateOne({ guildId: record.guildId, status: 'active' }, { $set: { expiresAt: new Date(Date.now() + 60_000) } });
  }
  return complete;
}

export async function endRaidResponse(guild: Guild, actorId: string): Promise<boolean> {
  return withGuildLock(guild.id, async () => {
    const record = await activeRaid(guild.id);
    if (!record) return false;
    return restoreLocked(record, guild, actorId, record.expiresAt.getTime() <= Date.now());
  });
}

async function expireRaidResponses(client: Client): Promise<void> {
  const expired = await RaidResponseModel.find({ status: 'active', expiresAt: { $lte: new Date() } }).limit(50).lean<RaidResponseRecord[]>();
  for (const record of expired) {
    const guild = client.guilds.cache.get(record.guildId);
    if (!guild) continue;
    await withGuildLock(record.guildId, async () => {
      const current = await activeRaid(record.guildId);
      if (current && current.expiresAt.getTime() <= Date.now()) await restoreLocked(current, guild, null, true);
    }).catch((error) => log.warn(`Could not expire raid response in ${record.guildId}`, error));
  }
}

export function startRaidResponseWorker(client: Client): () => void {
  void expireRaidResponses(client);
  const timer = setInterval(() => void expireRaidResponses(client).catch((error) => log.warn('Raid expiry pass failed', error)), 15_000);
  timer.unref();
  return () => clearInterval(timer);
}
