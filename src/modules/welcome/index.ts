import type { GuildMember, PartialGuildMember } from 'discord.js';
import { createLogger } from '../../core/logger.js';
import { guilds } from '../../services/index.js';
import type { GuildSettings } from '../../settings/schema.js';
import { welcomeMessage } from './render.js';
import type { WelcomeEventKind } from '../../render/welcomeCard.js';

const log = createLogger('welcome');

async function sendWelcomeEvent(member: GuildMember | PartialGuildMember, settings: GuildSettings, kind: WelcomeEventKind): Promise<void> {
  const event = settings.welcome[kind];
  const channelId = kind === 'leave' ? event.channelId ?? settings.welcome.join.channelId : event.channelId;
  const channel = channelId ? member.guild.channels.cache.get(channelId) : null;
  if (!channel?.isSendable()) return;
  try {
    await channel.send(await welcomeMessage(member, settings, kind));
  } catch (error) {
    log.warn(`Could not send ${kind} message in ${member.guild.id}`, error);
  }
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const settings = await guilds.settings(member.guild.id);
  const s = settings.welcome;
  if (!s.enabled) return;

  if (!member.user.bot && s.autoRoleIds.length) {
    const roles = s.autoRoleIds.filter((id) => member.guild.roles.cache.has(id));
    // Members must pass membership screening before getting roles.
    if (roles.length && !member.pending) {
      await member.roles.add(roles, 'Auto roles').catch((error) => log.warn(`Auto roles failed in ${member.guild.id}`, error));
    }
  }

  if (member.user.bot && !s.join.includeBots) return;
  if (member.pending && s.waitForScreening) return;
  await sendWelcomeEvent(member, settings, 'join');
}

/** Apply auto roles and optionally greet a member after Discord screening completes. */
export async function handleMemberScreeningPassed(before: GuildMember | PartialGuildMember, after: GuildMember): Promise<void> {
  if (!before.pending || after.pending) return;
  const settings = await guilds.settings(after.guild.id);
  const s = settings.welcome;
  if (!s.enabled) return;

  if (!after.user.bot && s.autoRoleIds.length) {
    const roles = s.autoRoleIds.filter((id) => after.guild.roles.cache.has(id));
    if (roles.length) await after.roles.add(roles, 'Auto roles').catch(() => null);
  }
  if (s.waitForScreening && (!after.user.bot || s.join.includeBots)) {
    await sendWelcomeEvent(after, settings, 'join');
  }
}

export async function handleMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  const settings = await guilds.settings(member.guild.id);
  const s = settings.welcome;
  if (!s.enabled || !s.leaveEnabled) return;
  if (member.user?.bot && !s.leave.includeBots) return;
  await sendWelcomeEvent(member, settings, 'leave');
}
