import type { Guild, GuildMember, Message, PartialGuildMember, PartialMessage } from 'discord.js';
import { timestamp } from '../../core/time.js';
import { guilds } from '../../services/index.js';
import type { LogEvent } from '../../settings/schema.js';
import { divider, panel, text, truncate, v2 } from '../../ui/components.js';
import { emoji, type EmojiKey } from '../../ui/emoji.js';
import { colors } from '../../ui/theme.js';

interface LogEntry {
  title: string;
  emoji: EmojiKey;
  color: number;
  lines: string[];
  body?: string;
  thumbnail?: string;
  channelId?: string | null;
}

async function sendLog(guild: Guild, event: LogEvent, entry: LogEntry): Promise<void> {
  const settings = await guilds.settings(guild.id);
  const s = settings.logging;
  if (!s.enabled || !s.channelId || !s.events.includes(event)) return;
  if (entry.channelId && s.ignoredChannelIds.includes(entry.channelId)) return;

  const channel = guild.channels.cache.get(s.channelId);
  if (!channel?.isSendable()) return;

  const container = panel({ title: entry.title, emoji: entry.emoji, accent: entry.color, thumbnail: entry.thumbnail }).addTextDisplayComponents(
    text(entry.lines.join('\n')),
  );
  if (entry.body) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(entry.body));
  container.addTextDisplayComponents(text(`-# ${timestamp(Date.now(), 'f')}`));
  await channel.send(v2(container)).catch(() => null);
}

export async function logMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.inGuild() || message.author?.bot) return;
  const files = message.attachments.size ? `\n-# ${emoji('link')} ${message.attachments.size} attachment(s)` : '';
  await sendLog(message.guild, 'messageDelete', {
    title: 'Message deleted',
    emoji: 'delete',
    color: colors.error,
    channelId: message.channelId,
    lines: [`${emoji('user')} **Author** ${message.author ? `${message.author} · \`${message.author.id}\`` : 'Unknown'}`, `${emoji('channel')} **Channel** ${message.channel}`],
    body: `${message.content ? truncate(message.content, 1500) : '*No text or not cached*'}${files}`,
  });
}

export async function logMessageEdit(before: Message | PartialMessage, after: Message | PartialMessage): Promise<void> {
  if (!after.inGuild() || after.author?.bot) return;
  if (before.content === after.content || !after.content) return;
  await sendLog(after.guild, 'messageEdit', {
    title: 'Message edited',
    emoji: 'edit',
    color: colors.warning,
    channelId: after.channelId,
    lines: [`${emoji('user')} **Author** ${after.author} · \`${after.author.id}\``, `${emoji('link')} [Jump to message](${after.url})`],
    body: `**Before**\n${before.content ? truncate(before.content, 900) : '*Not cached*'}\n**After**\n${truncate(after.content, 900)}`,
  });
}

export async function logMemberJoin(member: GuildMember): Promise<void> {
  const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
  await sendLog(member.guild, 'memberJoin', {
    title: 'Member joined',
    emoji: 'welcome',
    color: colors.success,
    thumbnail: member.displayAvatarURL({ size: 128 }),
    lines: [
      `${emoji('user')} ${member} · \`${member.user.tag}\``,
      `${emoji('calendar')} **Account created** ${timestamp(member.user.createdAt, 'R')}${ageDays < 7 ? ` ${emoji('warning')} New account` : ''}`,
      `${emoji('members')} **Member** #${member.guild.memberCount.toLocaleString()}`,
    ],
  });
}

export async function logMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  const roles = member.roles?.cache.filter((r) => r.id !== member.guild.id).map((r) => `${r}`) ?? [];
  await sendLog(member.guild, 'memberLeave', {
    title: 'Member left',
    emoji: 'leave',
    color: colors.muted,
    thumbnail: member.displayAvatarURL({ size: 128 }),
    lines: [
      `${emoji('user')} <@${member.id}> · \`${member.user?.tag ?? member.id}\``,
      member.joinedAt ? `${emoji('calendar')} **Joined** ${timestamp(member.joinedAt, 'R')}` : '',
      roles.length ? `${emoji('role')} **Roles** ${roles.slice(0, 15).join(' ')}` : '',
    ].filter(Boolean),
  });
}

export async function logMemberUpdate(before: GuildMember | PartialGuildMember, after: GuildMember): Promise<void> {
  if (before.partial) return;
  if (before.nickname !== after.nickname) {
    await sendLog(after.guild, 'nickname', {
      title: 'Nickname changed',
      emoji: 'edit',
      color: colors.info,
      lines: [`${emoji('user')} ${after}`, `**Before** ${before.nickname ?? '*None*'}`, `**After** ${after.nickname ?? '*None*'}`],
    });
  }
  const added = after.roles.cache.filter((r) => !before.roles.cache.has(r.id));
  const removed = before.roles.cache.filter((r) => !after.roles.cache.has(r.id));
  if (added.size || removed.size) {
    await sendLog(after.guild, 'memberRoles', {
      title: 'Roles changed',
      emoji: 'role',
      color: colors.info,
      lines: [
        `${emoji('user')} ${after}`,
        added.size ? `${emoji('add')} ${added.map((r) => `${r}`).join(' ')}` : '',
        removed.size ? `${emoji('remove')} ${removed.map((r) => `${r}`).join(' ')}` : '',
      ].filter(Boolean),
    });
  }
}
