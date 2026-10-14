import type { GuildMember, PartialGuildMember } from 'discord.js';
import type { GuildSettings } from '../../settings/schema.js';
import { panel } from '../../ui/components.js';
import { colors } from '../../ui/theme.js';

export const PLACEHOLDERS = '`{user}` mention · `{username}` name · `{server}` server · `{count}` member count';

export function fillTemplate(template: string, member: GuildMember | PartialGuildMember): string {
  return template
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user?.username ?? 'Someone')
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', member.guild.memberCount.toLocaleString());
}

export function welcomeMessage(member: GuildMember | PartialGuildMember, settings: GuildSettings, kind: 'join' | 'leave') {
  const s = settings.welcome;
  const body = fillTemplate(kind === 'join' ? s.message : s.leaveMessage, member);
  return panel({
    title: kind === 'join' ? 'Welcome!' : 'Goodbye',
    emoji: kind === 'join' ? 'welcome' : 'leave',
    description: body,
    accent: kind === 'join' ? settings.general.accentColor : colors.muted,
    thumbnail: s.showAvatar ? member.displayAvatarURL({ size: 256 }) : null,
  });
}
