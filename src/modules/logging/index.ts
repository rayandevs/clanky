import { createHash } from 'node:crypto';
import { AuditLogEvent, type Guild, type GuildAuditLogsEntry, type GuildMember, type Message, type PartialGuildMember, type PartialMessage } from 'discord.js';
import type { LogCategory, LogEvent } from '../../settings/schema.js';
import { guilds } from '../../services/index.js';
import { attachmentEvidence, recordLoggerEvent } from './service.js';

interface LogEntry {
  eventType: LogEvent;
  category: LogCategory;
  summary: string;
  eventKey: string;
  targetUserId?: string | null;
  channelId?: string | null;
  roleId?: string | null;
  messageId?: string | null;
  actorId?: string | null;
  actorAttribution?: 'self' | 'audit_log' | 'system' | 'unknown';
  actorRoleIds?: string[];
  targetRoleIds?: string[];
  isBot?: boolean;
  evidence?: Parameters<typeof recordLoggerEvent>[1]['evidence'];
}

async function sendLog(guild: Guild, entry: LogEntry): Promise<void> {
  await recordLoggerEvent(guild, { ...entry, source: 'gateway' });
}

export async function logMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.inGuild()) return;
  const author = message.author;
  const attachmentList = attachmentEvidence(message.attachments.values());
  await sendLog(message.guild, {
    eventType: 'messageDelete',
    category: 'messages',
    eventKey: `message-delete:${message.id}`,
    targetUserId: author?.id ?? null,
    targetRoleIds: author ? [...(message.guild.members.cache.get(author.id)?.roles.cache.keys() ?? [])] : [],
    channelId: message.channelId,
    messageId: message.id,
    isBot: author?.bot ?? false,
    summary: `A message${author ? ` from <@${author.id}>` : ''} was deleted in <#${message.channelId}>.`,
    evidence: { content: message.content || undefined, attachments: attachmentList },
  });
}

export async function logMessageEdit(before: Message | PartialMessage, after: Message | PartialMessage): Promise<void> {
  const beforeAttachmentIds = [...before.attachments.keys()].sort().join(':');
  const afterAttachmentIds = [...after.attachments.keys()].sort().join(':');
  if (!after.inGuild() || (before.content === after.content && beforeAttachmentIds === afterAttachmentIds)) return;
  const digest = createHash('sha256').update(`${after.editedTimestamp ?? ''}\u0000${before.content}\u0000${after.content}\u0000${beforeAttachmentIds}\u0000${afterAttachmentIds}`).digest('hex').slice(0, 24);
  await sendLog(after.guild, {
    eventType: 'messageEdit',
    category: 'messages',
    eventKey: `message-edit:${after.id}:${digest}`,
    targetUserId: after.author?.id ?? null,
    targetRoleIds: after.author ? [...(after.guild.members.cache.get(after.author.id)?.roles.cache.keys() ?? [])] : [],
    channelId: after.channelId,
    messageId: after.id,
    isBot: after.author?.bot ?? false,
    summary: `A message${after.author ? ` from <@${after.author.id}>` : ''} was edited in <#${after.channelId}>.`,
    evidence: { beforeContent: before.content || undefined, content: after.content || undefined, attachments: attachmentEvidence(after.attachments.values()) },
  });
}

export async function logMessagesBulkDelete(messages: Iterable<Message | PartialMessage>, channel: { id: string; guild: Guild }): Promise<void> {
  const list = [...messages];
  if (!list.length) return;
  const ids = list.map((message) => message.id).sort();
  const key = createHash('sha256').update(ids.join(':')).digest('hex');
  const authorIds = [...new Set(list.map((message) => message.author?.id).filter((id): id is string => Boolean(id)))];
  const allBots = list.every((message) => message.author?.bot ?? false);
  await sendLog(channel.guild, {
    eventType: 'messageBulkDelete',
    category: 'messages',
    eventKey: `message-bulk-delete:${channel.id}:${key}`,
    targetUserId: authorIds.length === 1 ? authorIds[0]! : null,
    targetRoleIds: [...new Set(authorIds.flatMap((authorId) => [...(channel.guild.members.cache.get(authorId)?.roles.cache.keys() ?? [])]))],
    channelId: channel.id,
    summary: `${list.length} message(s) were deleted in bulk from <#${channel.id}>${authorIds.length ? `; ${authorIds.length} member(s) affected` : ''}.`,
    isBot: allBots,
    evidence: { relatedMessageIds: ids.slice(0, 50) },
  });
}

export async function logMemberJoin(member: GuildMember): Promise<void> {
  const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
  await sendLog(member.guild, {
    eventType: 'memberJoin',
    category: 'members',
    eventKey: `member-join:${member.id}:${member.joinedTimestamp ?? member.user.createdTimestamp}`,
    actorId: member.id,
    actorAttribution: 'self',
    targetUserId: member.id,
    targetRoleIds: [...member.roles.cache.keys()],
    isBot: member.user.bot,
    summary: `<@${member.id}> joined the server. Account age: ${ageDays} day(s).${ageDays < 7 ? ' Recently created account.' : ''}`,
  });
}

export async function logMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  const roleIds = member.roles?.cache.filter((role) => role.id !== member.guild.id).map((role) => role.id) ?? [];
  await sendLog(member.guild, {
    eventType: 'memberLeave',
    category: 'members',
    eventKey: `member-leave:${member.id}:${Math.floor(Date.now() / 5000)}`,
    targetUserId: member.id,
    targetRoleIds: roleIds,
    isBot: member.user?.bot ?? false,
    summary: `<@${member.id}> left the server${roleIds.length ? ` with ${roleIds.length} role(s)` : ''}.`,
  });
}

export async function logMemberUpdate(before: GuildMember | PartialGuildMember, after: GuildMember): Promise<void> {
  if (before.partial) return;
  const roleAdded = after.roles.cache.filter((role) => !before.roles.cache.has(role.id)).map((role) => role.id);
  const roleRemoved = before.roles.cache.filter((role) => !after.roles.cache.has(role.id)).map((role) => role.id);
  const rolesChanged = roleAdded.length > 0 || roleRemoved.length > 0;
  const nicknameChanged = before.nickname !== after.nickname;
  if (!rolesChanged && !nicknameChanged) return;
  const changedRoles = [...roleAdded, ...roleRemoved];
  const eventType = rolesChanged ? 'memberRoles' : 'nickname';
  const parts = [
    nicknameChanged ? `Nickname changed from ${before.nickname ?? 'none'} to ${after.nickname ?? 'none'}` : '',
    roleAdded.length ? `Roles added: ${roleAdded.map((id) => `<@&${id}>`).join(', ')}` : '',
    roleRemoved.length ? `Roles removed: ${roleRemoved.map((id) => `<@&${id}>`).join(', ')}` : '',
  ].filter(Boolean);
  const digest = createHash('sha256').update(`${before.nickname}:${after.nickname}:${changedRoles.sort().join(',')}:${Math.floor(Date.now() / 2000)}`).digest('hex').slice(0, 24);
  await sendLog(after.guild, {
    eventType,
    category: 'members',
    eventKey: `member-update:${after.id}:${digest}`,
    targetUserId: after.id,
    actorRoleIds: [],
    targetRoleIds: [...new Set([...before.roles.cache.keys(), ...after.roles.cache.keys()])],
    isBot: after.user.bot,
    summary: `<@${after.id}> · ${parts.join(' · ')}`,
  });
}

const AUDIT_EVENT: Partial<Record<AuditLogEvent, { eventType: LogEvent; category: LogCategory; label: string; target: 'member' | 'channel' | 'role' | 'integration' }>> = {
  [AuditLogEvent.MemberBanAdd]: { eventType: 'memberBan', category: 'moderation', label: 'banned a member', target: 'member' },
  [AuditLogEvent.MemberBanRemove]: { eventType: 'memberUnban', category: 'moderation', label: 'unbanned a member', target: 'member' },
  [AuditLogEvent.MemberKick]: { eventType: 'memberKick', category: 'moderation', label: 'kicked a member', target: 'member' },
  [AuditLogEvent.ChannelCreate]: { eventType: 'channelCreate', category: 'server', label: 'created a channel', target: 'channel' },
  [AuditLogEvent.ChannelDelete]: { eventType: 'channelDelete', category: 'server', label: 'deleted a channel', target: 'channel' },
  [AuditLogEvent.ChannelUpdate]: { eventType: 'channelUpdate', category: 'server', label: 'updated a channel', target: 'channel' },
  [AuditLogEvent.RoleCreate]: { eventType: 'roleCreate', category: 'server', label: 'created a role', target: 'role' },
  [AuditLogEvent.RoleDelete]: { eventType: 'roleDelete', category: 'server', label: 'deleted a role', target: 'role' },
  [AuditLogEvent.RoleUpdate]: { eventType: 'roleUpdate', category: 'server', label: 'updated a role', target: 'role' },
  [AuditLogEvent.WebhookCreate]: { eventType: 'webhookCreate', category: 'integrations', label: 'created a webhook', target: 'integration' },
  [AuditLogEvent.WebhookUpdate]: { eventType: 'webhookUpdate', category: 'integrations', label: 'updated a webhook', target: 'integration' },
  [AuditLogEvent.WebhookDelete]: { eventType: 'webhookDelete', category: 'integrations', label: 'deleted a webhook', target: 'integration' },
};

export async function logAuditEntry(entry: GuildAuditLogsEntry, guild: Guild): Promise<void> {
  const mapped = AUDIT_EVENT[entry.action];
  if (!mapped) return;
  const changedFields = [...new Set(entry.changes.map((change) => String(change.key)))].slice(0, 20);
  const actorId = entry.executorId ?? null;
  const targetId = entry.targetId ?? null;
  const targetUserId = mapped.target === 'member' ? targetId : null;
  const channelId = mapped.target === 'channel' ? targetId : null;
  const roleId = mapped.target === 'role' ? targetId : null;
  const summary = `${actorId ? `<@${actorId}>` : 'An unattributed moderator'} ${mapped.label}${targetId ? ` (object ${targetId})` : ''}.`;
  const actorIsBot = actorId ? guild.members.cache.get(actorId)?.user.bot ?? false : false;
  const related = mapped.target === 'member' ? guild.members.cache.get(targetId ?? '')?.roles.cache.keys() : undefined;
  await recordLoggerEvent(guild, {
    eventKey: `audit-log:${entry.id}`,
    eventType: mapped.eventType,
    category: mapped.category,
    source: 'audit_log',
    occurredAt: entry.createdAt,
    actorId,
    actorAttribution: actorId ? 'audit_log' : 'unknown',
    targetUserId,
    channelId,
    roleId,
    actorRoleIds: actorId ? [...(guild.members.cache.get(actorId)?.roles.cache.keys() ?? [])] : [],
    targetRoleIds: related ? [...related] : [],
    isBot: actorIsBot,
    summary,
    evidence: { changedFields },
  });
}

const linkWindows = new Map<string, { times: number[]; messageIds: string[]; lastAlertAt: number }>();
const LINK_WINDOW_MS = 60_000;
const LINK_ALERT_COOLDOWN_MS = 5 * 60_000;
const NEW_ACCOUNT_MS = 7 * 86_400_000;
let lastLinkWindowSweepAt = 0;

/** Examine link metadata in memory only; the message text is not saved unless evidence capture is explicitly enabled. */
export async function detectSuspiciousLinks(message: Message): Promise<void> {
  if (!message.inGuild() || message.author.bot || message.webhookId || !message.content) return;
  if (Date.now() - message.author.createdTimestamp > NEW_ACCOUNT_MS) return;
  const linkMatches = message.content.match(/(?:https?:\/\/|www\.)\S+/gi);
  if (!linkMatches?.length) return;
  const logging = (await guilds.settings(message.guildId)).logging;
  if (!logging.enabled || !logging.detectionEnabled || !logging.events.includes('suspiciousLinks')) return;
  if (logging.ignoredChannelIds.includes(message.channelId) || [...(message.member?.roles.cache.keys() ?? [])].some((roleId) => logging.ignoredRoleIds.includes(roleId))) return;
  const key = `${message.guildId}:${message.author.id}`;
  const now = Date.now();
  const window = linkWindows.get(key) ?? { times: [], messageIds: [], lastAlertAt: 0 };
  window.times = window.times.filter((time) => now - time <= LINK_WINDOW_MS);
  window.messageIds = window.messageIds.slice(-10);
  window.times.push(now);
  window.messageIds.push(message.id);
  linkWindows.set(key, window);
  if (linkWindows.size > 5000 && now - lastLinkWindowSweepAt > LINK_WINDOW_MS) {
    lastLinkWindowSweepAt = now;
    for (const [entryKey, value] of linkWindows) {
      if (!value.times.some((time) => now - time <= LINK_WINDOW_MS) && now - value.lastAlertAt > LINK_ALERT_COOLDOWN_MS * 2) linkWindows.delete(entryKey);
    }
  }
  if (window.times.length < 5 || now - window.lastAlertAt < LINK_ALERT_COOLDOWN_MS) return;
  window.lastAlertAt = now;
  const sourceIds = [...window.messageIds];
  const eventKey = createHash('sha256').update(`${message.guildId}:${message.author.id}:${sourceIds.sort().join(':')}`).digest('hex');
  await recordLoggerEvent(message.guild, {
    eventKey: `suspicious-links:${eventKey}`,
    eventType: 'suspiciousLinks',
    category: 'messages',
    source: 'detector',
    occurredAt: new Date(now),
    targetUserId: message.author.id,
    channelId: message.channelId,
    messageId: message.id,
    targetRoleIds: [...(message.member?.roles.cache.keys() ?? [])],
    summary: `A recently created account sent link-containing messages ${window.times.length} times within one minute. Message text is not included in this signal.`,
    evidence: { linkCount: window.times.length, relatedMessageIds: sourceIds.slice(0, 10) },
  });
}
