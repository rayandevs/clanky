import type { GuildMember, Message } from 'discord.js';
import { createLogger } from '../../core/logger.js';
import { guilds, levels, users } from '../../services/index.js';
import type { GuildSettings } from '../../settings/schema.js';
import { panel, v2 } from '../../ui/components.js';

const log = createLogger('leveling');

export function desiredRewardRoleIds(level: number, settings: GuildSettings): string[] {
  const earned = [...settings.leveling.rewards].sort((a, b) => a.level - b.level).filter((reward) => reward.level <= level);
  if (!earned.length) return [];
  return settings.leveling.stackRewards ? earned.map((reward) => reward.roleId) : [earned.at(-1)!.roleId];
}

/** Gives (and optionally removes old) reward roles for the member's level. */
export async function applyRewards(member: GuildMember, level: number, settings: GuildSettings): Promise<string[]> {
  const rewards = [...settings.leveling.rewards].sort((a, b) => a.level - b.level);
  const earned = rewards.filter((r) => r.level <= level);
  if (!earned.length) return [];

  const me = member.guild.members.me;
  const canGive = (id: string) => {
    const role = member.guild.roles.cache.get(id);
    return Boolean(role && me && role.position < me.roles.highest.position && !role.managed);
  };

  const keep = desiredRewardRoleIds(level, settings);
  const add = keep.filter((id) => canGive(id) && !member.roles.cache.has(id));
  const remove = settings.leveling.stackRewards
    ? []
    : rewards.map((r) => r.roleId).filter((id) => !keep.includes(id) && member.roles.cache.has(id) && canGive(id));

  if (add.length) await member.roles.add(add, `Reached level ${level}`).catch((e) => log.warn('Could not add reward', e));
  if (remove.length) await member.roles.remove(remove, 'Level reward replaced').catch(() => null);
  return add;
}

export async function handleLevelingMessage(message: Message<true>): Promise<void> {
  const settings = await guilds.settings(message.guildId);
  const config = settings.leveling;
  const level = await levels.handleMessage(message.guildId, message.author.id, config, {
    channelId: message.channelId,
    parentId: message.channel.isThread() ? message.channel.parentId : null,
    roleIds: message.member ? [...message.member.roles.cache.keys()] : [],
    contentLength: message.content.trim().length,
  });
  if (level === null) return;

  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  const rewards = member ? await applyRewards(member, level, settings) : [];
  if (config.announce === 'off') return;

  const channel = config.announce === 'channel' && config.announceChannelId ? message.guild.channels.cache.get(config.announceChannelId) : message.channel;
  if (!channel?.isSendable()) return;

  const prefs = await users.preferences(message.author.id);
  const body = config.message.replaceAll('{user}', `<@${message.author.id}>`).replaceAll('{level}', String(level));
  const rewardLine = rewards.length ? `\n-# Unlocked ${rewards.map((id) => `<@&${id}>`).join(' ')}` : '';

  const container = panel({
    title: `Level ${level}`,
    emoji: 'level',
    description: body + rewardLine,
    accent: settings.general.accentColor,
    thumbnail: message.author.displayAvatarURL({ size: 128 }),
  });
  await channel
    .send({ ...v2(container), allowedMentions: { users: prefs.levelUpPings ? [message.author.id] : [] } })
    .catch(() => null);
}
