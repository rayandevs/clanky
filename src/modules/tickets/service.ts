import {
  AttachmentBuilder,
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  type Collection,
  type GuildMember,
  type Message,
  type TextChannel,
} from 'discord.js';
import { env } from '../../config/env.js';
import { createLogger } from '../../core/logger.js';
import { timestamp } from '../../core/time.js';
import {
  TicketModel,
  TicketTranscriptMessageModel,
  TicketTranscriptModel,
  type TicketRecord,
  type TicketTranscriptMessageRecord,
} from '../../database/models/index.js';
import { archiveMessageAttachments, deleteArchivedTranscriptAttachments, TicketAttachmentArchiveError } from './attachmentArchive.js';
import { renderTicketOpeningCard } from '../../render/ticketCards.js';
import { guilds } from '../../services/index.js';
import type { GuildSettings, TicketPanelSetting } from '../../settings/schema.js';
import { divider, notice, panel, text, v2 } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';
import { colors } from '../../ui/theme.js';
import { ticketHeader } from './render.js';

const log = createLogger('tickets');
const DAY = 86_400_000;
const MAX_TRANSCRIPT_MESSAGES = 1000;
const TICKET_OPENING_IMAGE = 'ticket-opening.png';

export function isStaff(member: GuildMember, settings: GuildSettings, ticket?: TicketRecord): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  const roleIds = ticket?.staffRoleIds ?? settings.tickets.staffRoleIds;
  return roleIds.some((id) => member.roles.cache.has(id));
}

export async function openTicketCount(guildId: string, userId: string): Promise<number> {
  return TicketModel.countDocuments({ guildId, openerId: userId, status: 'open' });
}

export async function findTicket(channelId: string): Promise<TicketRecord | null> {
  return TicketModel.findOne({ channelId, status: 'open' }).lean<TicketRecord>();
}

export function ticketRouting(settings: GuildSettings, panel: TicketPanelSetting) {
  return {
    parentId: panel.parentId ?? settings.tickets.parentId,
    logChannelId: panel.logChannelId ?? settings.tickets.logChannelId,
    staffRoleIds: panel.staffRoleIds ?? settings.tickets.staffRoleIds,
  };
}

export async function ticketOpeningAttachment(ticket: TicketRecord, settings: GuildSettings): Promise<AttachmentBuilder> {
  const categoryLabel = ticket.categoryLabel ?? settings.tickets.categories.find((category) => category.id === ticket.category)?.label ?? null;
  const status = ticket.claimedBy ? `Claimed by ${ticket.claimedByName ?? 'a staff member'}` : 'Waiting for staff';
  const image = await renderTicketOpeningCard({
    accent: settings.general.accentColor,
    ticketId: ticket.ticketId,
    panelTitle: ticket.panelTitle ?? 'Private support',
    displayName: ticket.openerDisplayName ?? ticket.openerId,
    avatarUrl: ticket.openerAvatarUrl ?? undefined,
    categoryLabel,
    status,
  });
  return new AttachmentBuilder(image, { name: TICKET_OPENING_IMAGE });
}

export async function createTicket(
  member: GuildMember,
  settings: GuildSettings,
  panel: TicketPanelSetting,
  category: string | null,
  answers: Array<{ questionId: string; label: string; answer: string }>,
) {
  const guild = member.guild;
  const ticketId = await guilds.nextCounter(guild.id, 'tickets');
  const me = guild.members.me!;
  const routing = ticketRouting(settings, panel);
  const topic = answers.find((answer) => answer.answer)?.answer ?? '';
  const memberAccess = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
  ];

  const channel = await guild.channels.create({
    name: `ticket-${String(ticketId).padStart(4, '0')}`,
    type: ChannelType.GuildText,
    parent: routing.parentId ?? undefined,
    topic: `Ticket #${ticketId} · ${member.user.tag} · ${topic.slice(0, 200)}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, type: OverwriteType.Member, allow: memberAccess },
      { id: me.id, type: OverwriteType.Member, allow: [...memberAccess, PermissionFlagsBits.ManageChannels] },
      ...routing.staffRoleIds
        .filter((id) => guild.roles.cache.has(id))
        .map((id) => ({ id, type: OverwriteType.Role, allow: memberAccess })),
    ],
    reason: `Ticket #${ticketId} opened by ${member.user.tag}`,
  });

  const categoryLabel = settings.tickets.categories.find((item) => item.id === category)?.label ?? null;
  const ticket = (await TicketModel.create({
    guildId: guild.id,
    ticketId,
    channelId: channel.id,
    openerId: member.id,
    openerDisplayName: member.displayName,
    openerAvatarUrl: member.displayAvatarURL({ extension: 'png', size: 256 }),
    topic,
    category,
    categoryLabel,
    panelId: panel.id,
    panelTitle: panel.title,
    answers,
    staffRoleIds: routing.staffRoleIds,
    logChannelId: routing.logChannelId,
  })).toObject();

  const staffPings = routing.staffRoleIds.map((id) => `<@&${id}>`).join(' ');
  const openingFile = await ticketOpeningAttachment(ticket, settings);
  await channel.send({
    ...v2([text(`${member} ${staffPings}`.trim()), ticketHeader(ticket, settings)]),
    files: [openingFile],
    allowedMentions: { users: [member.id], roles: routing.staffRoleIds },
  });
  return { ticket, channel };
}

async function fetchAllMessages(channel: TextChannel, max = MAX_TRANSCRIPT_MESSAGES): Promise<{ messages: Message[]; truncated: boolean }> {
  const all: Message[] = [];
  let before: string | undefined;
  while (all.length < max) {
    const batch: Collection<string, Message> = await channel.messages.fetch({ limit: Math.min(100, max - all.length), before });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last()?.id;
  }
  const olderMessagesExist = all.length >= max && before
    ? (await channel.messages.fetch({ limit: 1, before })).size > 0
    : false;
  return { messages: all.reverse(), truncated: olderMessagesExist };
}

function componentText(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(componentText);
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  const own = typeof object.content === 'string' ? [object.content] : [];
  const nested = [object.components, object.accessory].filter((part) => part !== undefined).flatMap(componentText);
  return [...own, ...nested];
}

function messageComponentText(message: Message): string {
  return message.components.flatMap((component) => {
    const serializable = component as unknown as { toJSON?: () => unknown };
    return componentText(typeof serializable.toJSON === 'function' ? serializable.toJSON() : component);
  }).filter(Boolean).join('\n');
}

function transcriptMessage(message: Message, ticketId: number, expiresAt: Date | null, archiveIds: Map<string, string>): TicketTranscriptMessageRecord {
  const content = [message.content.trim(), messageComponentText(message)].filter(Boolean).join('\n\n');
  return {
    guildId: message.guildId!,
    ticketId,
    messageId: message.id,
    authorId: message.author.id,
    authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
    authorAvatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 128 }),
    isBot: message.author.bot,
    content,
    embeds: message.embeds.map((embed) => ({
      title: embed.title ?? null,
      description: embed.description ?? null,
      fields: embed.fields.slice(0, 25).map((field) => ({ name: field.name, value: field.value })),
    })),
    attachments: [...message.attachments.values()].map((attachment, index) => ({
      name: attachment.name,
      url: attachment.url,
      contentType: attachment.contentType ?? null,
      size: attachment.size,
      archiveId: archiveIds.get(`${message.id}:${index}`) ?? null,
    })),
    createdAt: message.createdAt,
    expiresAt,
  };
}

function transcriptText(ticket: TicketRecord, channel: TextChannel, messages: Message[], truncated: boolean, closedAt: Date): string {
  const openerName = ticket.openerDisplayName ?? ticket.openerId;
  const header = [
    `Ticket #${ticket.ticketId} — ${channel.guild.name}`,
    `Opened by: ${openerName} (${ticket.openerId})  |  Panel: ${ticket.panelTitle ?? 'Ticket'}`,
    ticket.categoryLabel ? `Category: ${ticket.categoryLabel}` : null,
    ...(ticket.answers?.length ? ticket.answers.map((answer) => `${answer.label}: ${answer.answer || '(no answer)'}`) : [`Topic: ${ticket.topic}`]),
    `Created: ${ticket.createdAt.toISOString()}  |  Closed: ${closedAt.toISOString()}`,
    truncated ? 'Transcript limited to the most recent 1,000 messages.' : null,
    '─'.repeat(60),
  ].filter((line): line is string => Boolean(line));
  const lines = messages.map((message) => {
    const time = message.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const body = [message.content, messageComponentText(message)].filter(Boolean).join('\n') || (message.components.length ? '[interactive message]' : '');
    const files = message.attachments.size ? ` [${message.attachments.map((attachment) => `${attachment.name}: ${attachment.url}`).join(', ')}]` : '';
    return `[${time}] ${message.member?.displayName ?? message.author.tag}: ${body}${files}`;
  });
  return [...header, ...lines].join('\n');
}

function dashboardTranscriptUrl(guildId: string, ticketId: number): string | null {
  try {
    const base = new URL(env.DASHBOARD_URL);
    if (['localhost', '127.0.0.1', '::1'].includes(base.hostname)) return null;
    return `${env.DASHBOARD_URL.replace(/\/+$/, '')}/dashboard/${guildId}/transcripts?ticketId=${ticketId}`;
  } catch {
    return null;
  }
}

async function persistTranscript(ticket: TicketRecord, channel: TextChannel, messages: Message[], truncated: boolean, settings: GuildSettings, closedBy: GuildMember, reason: string | null, closedAt: Date) {
  const retention = settings.tickets.transcriptRetentionDays;
  const expiresAt = retention === 'forever' ? null : new Date(closedAt.getTime() + Number(retention) * DAY);
  const currentPanel = settings.tickets.panels.find((panel) => panel.id === ticket.panelId);
  const categoryLabel = ticket.categoryLabel ?? settings.tickets.categories.find((category) => category.id === ticket.category)?.label ?? null;
  const staffRoleIds = ticket.staffRoleIds ?? (currentPanel?.staffRoleIds ?? settings.tickets.staffRoleIds);
  const ticketId = ticket.ticketId;
  const previousRows = await TicketTranscriptMessageModel.find({ guildId: channel.guild.id, ticketId }).select({ attachments: 1 }).lean();
  const previousArchiveIds = previousRows.flatMap((row) => row.attachments.map((attachment) => attachment.archiveId).filter((id): id is string => Boolean(id)));
  const archiveIds = await archiveMessageAttachments(messages, channel.guild.id, ticketId, expiresAt);
  const rows = messages.map((message) => transcriptMessage(message, ticketId, expiresAt, archiveIds));

  try {
    await TicketTranscriptMessageModel.deleteMany({ guildId: channel.guild.id, ticketId });
    if (rows.length) await TicketTranscriptMessageModel.insertMany(rows, { ordered: true });
    await TicketTranscriptModel.findOneAndUpdate(
      { guildId: channel.guild.id, ticketId },
      {
        $set: {
          guildId: channel.guild.id,
          ticketId,
          channelId: channel.id,
          openerId: ticket.openerId,
          openerDisplayName: ticket.openerDisplayName ?? ticket.openerId,
          openerAvatarUrl: ticket.openerAvatarUrl ?? null,
          panelId: ticket.panelId ?? 'legacy',
          panelTitle: ticket.panelTitle ?? 'Ticket',
          categoryId: ticket.category,
          categoryLabel,
          answers: ticket.answers ?? [],
          staffRoleIds,
          claimedBy: ticket.claimedBy,
          claimedByName: ticket.claimedByName ?? null,
          closedBy: closedBy.id,
          closedByName: closedBy.displayName,
          closeReason: reason,
          createdAt: ticket.createdAt,
          closedAt,
          messageCount: rows.length,
          truncated,
          expiresAt,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  } catch (error) {
    await deleteArchivedTranscriptAttachments([...archiveIds.values()]);
    throw error;
  }
  await deleteArchivedTranscriptAttachments(previousArchiveIds);
}

export async function closeTicket(channel: TextChannel, ticket: TicketRecord, closedBy: GuildMember, reason: string | null): Promise<void> {
  const settings = await guilds.settings(channel.guild.id);
  let transcriptData: { messages: Message[]; truncated: boolean };
  try {
    transcriptData = await fetchAllMessages(channel);
  } catch (error) {
    log.warn('Could not fetch ticket messages for transcript', error);
    await channel.send(v2(notice('error', 'I could not read this ticket’s message history, so the ticket has been left open. Check Clanky’s View Channel and Read Message History permissions, then try closing it again.'))).catch(() => null);
    return;
  }
  const { messages, truncated } = transcriptData;
  const closedAt = new Date();
  try {
    await persistTranscript(ticket, channel, messages, truncated, settings, closedBy, reason, closedAt);
  } catch (error) {
    log.error(`Could not persist transcript for ticket #${ticket.ticketId}`, error);
    const message = error instanceof TicketAttachmentArchiveError
      ? error.message
      : 'I could not save the dashboard transcript, so this ticket has been left open. Please ask an administrator to try again.';
    await channel.send(v2(notice('error', message))).catch(() => null);
    return;
  }
  await TicketModel.updateOne(
    { _id: (ticket as TicketRecord & { _id: unknown })._id, status: 'open' },
    { $set: { status: 'closed', closedBy: closedBy.id, closeReason: reason, closedAt } },
  );

  const fileName = `ticket-${ticket.ticketId}.txt`;
  const transcript = transcriptText(ticket, channel, messages, truncated, closedAt);
  const file = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: fileName });
  const dashboardUrl = dashboardTranscriptUrl(channel.guild.id, ticket.ticketId);

  const summary = panel({ title: `Ticket #${ticket.ticketId} closed`, emoji: 'lock', accent: colors.muted })
    .addTextDisplayComponents(
      text(
        [
          `${emoji('user')} **Opened by** <@${ticket.openerId}> ${timestamp(ticket.createdAt, 'R')}`,
          `${emoji('lock')} **Closed by** ${closedBy}`,
          ticket.claimedBy ? `${emoji('claim')} **Claimed by** <@${ticket.claimedBy}>` : null,
          `${emoji('list')} **Reason** ${reason ?? 'No reason given'}`,
          `${emoji('message')} **Messages** ${messages.length}`,
          dashboardUrl ? `📄 [View transcript in dashboard](${dashboardUrl})` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addFileComponents((attachment) => attachment.setURL(`attachment://${fileName}`));

  const logChannelId = ticket.logChannelId !== undefined ? ticket.logChannelId : settings.tickets.logChannelId;
  const logChannel = logChannelId ? channel.guild.channels.cache.get(logChannelId) : null;
  if (logChannel?.isSendable()) {
    await logChannel.send({ ...v2(summary), files: [file] }).catch((error) => log.warn('Could not send transcript', error));
  }

  // Let the member know, with their own copy of the transcript.
  const opener = await channel.client.users.fetch(ticket.openerId).catch(() => null);
  if (opener) {
    const dmFile = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: fileName });
    const dm = panel({
      title: 'Your ticket was closed',
      emoji: 'ticket',
      description: `Ticket **#${ticket.ticketId}** in **${channel.guild.name}** was closed.\n**Reason** ${reason ?? 'No reason given'}`,
      accent: settings.general.accentColor,
    }).addFileComponents((attachment) => attachment.setURL(`attachment://${fileName}`));
    await opener.send({ ...v2(dm), files: [dmFile] }).catch(() => null);
  }

  setTimeout(() => {
    channel.delete(`Ticket #${ticket.ticketId} closed by ${closedBy.user.tag}`).catch((error) => log.warn('Could not delete ticket channel', error));
  }, 5000);
}
