import type { GuildMember, PartialGuildMember } from 'discord.js';
import { createLogger } from '../../core/logger.js';
import { guilds } from '../../services/index.js';
import { v2 } from '../../ui/components.js';
import { welcomeMessage } from './render.js';

const log = createLogger('welcome');

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const settings = await guilds.settings(member.guild.id);
  const s = settings.welcome;
  if (!s.enabled) return;

  if (s.autoRoleIds.length && !member.user.bot) {
    const roles = s.autoRoleIds.filter((id) => member.guild.roles.cache.has(id));
    // Members must pass membership screening before getting roles.
    if (roles.length && !member.pending) {
      await member.roles.add(roles, 'Auto roles').catch((error) => log.warn(`Auto roles failed in ${member.guild.id}`, error));
    }
  }

  const channel = s.channelId ? member.guild.channels.cache.get(s.channelId) : null;
  if (!channel?.isSendable()) return;
  await channel.send({ ...v2(welcomeMessage(member, settings, 'join')), allowedMentions: { users: [member.id] } }).catch(() => null);
}

/** Give auto roles after a member passes membership screening. */
export async function handleMemberScreeningPassed(before: GuildMember | PartialGuildMember, after: GuildMember): Promise<void> {
  if (!before.pending || after.pending) return;
  const s = (await guilds.settings(after.guild.id)).welcome;
  if (!s.enabled || !s.autoRoleIds.length) return;
  const roles = s.autoRoleIds.filter((id) => after.guild.roles.cache.has(id));
  if (roles.length) await after.roles.add(roles, 'Auto roles').catch(() => null);
}

export async function handleMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  const settings = await guilds.settings(member.guild.id);
  const s = settings.welcome;
  if (!s.enabled || !s.leaveEnabled || !s.channelId) return;
  const channel = member.guild.channels.cache.get(s.channelId);
  if (!channel?.isSendable()) return;
  await channel.send(v2(welcomeMessage(member, settings, 'leave'))).catch(() => null);
}
