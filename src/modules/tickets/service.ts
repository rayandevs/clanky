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
import { createLogger } from '../../core/logger.js';
import { timestamp } from '../../core/time.js';
import { TicketModel, type TicketRecord } from '../../database/models/index.js';
import { renderTicketOpeningCard } from '../../render/ticketCards.js';
import { guilds } from '../../services/index.js';
import type { GuildSettings, TicketPanelSetting } from '../../settings/schema.js';
import { divider, panel, text, v2 } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';
import { colors } from '../../ui/theme.js';
import { ticketArtwork, ticketHeader } from './render.js';

const log = createLogger('tickets');

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

  const ticket = (await TicketModel.create({
    guildId: guild.id,
    ticketId,
    channelId: channel.id,
    openerId: member.id,
    topic,
    category,
    panelId: panel.id,
    panelTitle: panel.title,
    answers,
    staffRoleIds: routing.staffRoleIds,
    logChannelId: routing.logChannelId,
  })).toObject();

  const staffPings = routing.staffRoleIds.map((id) => `<@&${id}>`).join(' ');
  const openingFileName = 'ticket-opening.png';
  const openingCard = await renderTicketOpeningCard({
    accent: settings.general.accentColor,
    displayName: member.displayName,
    avatarUrl: member.displayAvatarURL({ extension: 'png', size: 256 }),
  });
  await channel.send({
    ...v2([
      text(`${member} ${staffPings}`.trim()),
      ticketArtwork(`attachment://${openingFileName}`, `Private support welcome card for ${member.displayName}.`, settings.general.accentColor),
      ticketHeader(ticket, settings),
    ]),
    files: [new AttachmentBuilder(openingCard, { name: openingFileName })],
    allowedMentions: { users: [member.id], roles: routing.staffRoleIds },
  });
  return { ticket, channel };
}

async function fetchAllMessages(channel: TextChannel, max = 1000): Promise<Message[]> {
  const all: Message[] = [];
  let before: string | undefined;
  while (all.length < max) {
    const batch: Collection<string, Message> = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last()?.id;
  }
  return all.reverse();
}

function transcriptText(ticket: TicketRecord, channel: TextChannel, messages: Message[]): string {
  const header = [
    `Ticket #${ticket.ticketId} — ${channel.guild.name}`,
    `Opened by: ${ticket.openerId}  |  Panel: ${ticket.panelTitle ?? 'Ticket'}`,
    ...(ticket.answers?.length ? ticket.answers.map((a) => `${a.label}: ${a.answer || '(no answer)'}`) : [`Topic: ${ticket.topic}`]),
    `Created: ${ticket.createdAt.toISOString()}  |  Closed: ${new Date().toISOString()}`,
    '─'.repeat(60),
  ];
  const lines = messages.map((m) => {
    const time = m.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const body = m.content || (m.components.length ? '[interactive message]' : '');
    const files = m.attachments.size ? ` [${m.attachments.map((a) => a.url).join(', ')}]` : '';
    return `[${time}] ${m.author.tag}: ${body}${files}`;
  });
  return [...header, ...lines].join('\n');
}

export async function closeTicket(channel: TextChannel, ticket: TicketRecord, closedBy: GuildMember, reason: string | null): Promise<void> {
  const settings = await guilds.settings(channel.guild.id);
  await TicketModel.updateOne(
    { _id: (ticket as TicketRecord & { _id: unknown })._id },
    { $set: { status: 'closed', closedBy: closedBy.id, closeReason: reason, closedAt: new Date() } },
  );

  const messages = await fetchAllMessages(channel).catch(() => []);
  const fileName = `ticket-${ticket.ticketId}.txt`;
  const file = new AttachmentBuilder(Buffer.from(transcriptText(ticket, channel, messages), 'utf8'), { name: fileName });

  const summary = panel({ title: `Ticket #${ticket.ticketId} closed`, emoji: 'lock', accent: colors.muted })
    .addTextDisplayComponents(
      text(
        [
          `${emoji('user')} **Opened by** <@${ticket.openerId}> ${timestamp(ticket.createdAt, 'R')}`,
          `${emoji('lock')} **Closed by** ${closedBy}`,
          ticket.claimedBy ? `${emoji('claim')} **Claimed by** <@${ticket.claimedBy}>` : null,
          `${emoji('list')} **Reason** ${reason ?? 'No reason given'}`,
          `${emoji('message')} **Messages** ${messages.length}`,
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addFileComponents((f) => f.setURL(`attachment://${fileName}`));

  const logChannelId = ticket.logChannelId !== undefined ? ticket.logChannelId : settings.tickets.logChannelId;
  const logChannel = logChannelId ? channel.guild.channels.cache.get(logChannelId) : null;
  if (logChannel?.isSendable()) {
    await logChannel.send({ ...v2(summary), files: [file] }).catch((error) => log.warn('Could not send transcript', error));
  }

  // Let the member know, with their own copy of the transcript.
  const opener = await channel.client.users.fetch(ticket.openerId).catch(() => null);
  if (opener) {
    const dmFile = new AttachmentBuilder(Buffer.from(transcriptText(ticket, channel, messages), 'utf8'), { name: fileName });
    const dm = panel({
      title: 'Your ticket was closed',
      emoji: 'ticket',
      description: `Ticket **#${ticket.ticketId}** in **${channel.guild.name}** was closed.\n**Reason** ${reason ?? 'No reason given'}`,
      accent: settings.general.accentColor,
    }).addFileComponents((f) => f.setURL(`attachment://${fileName}`));
    await opener.send({ ...v2(dm), files: [dmFile] }).catch(() => null);
  }

  setTimeout(() => {
    channel.delete(`Ticket #${ticket.ticketId} closed by ${closedBy.user.tag}`).catch((error) => log.warn('Could not delete ticket channel', error));
  }, 5000);
}
