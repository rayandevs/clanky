import {
  ChannelType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { guildComponents, guildSlashCommand, type BotModuleDefinition } from '../../core/types.js';
import { TicketModel, type TicketRecord } from '../../database/models/index.js';
import { notice, v2 } from '../../ui/components.js';
import { reply, respond } from '../../ui/respond.js';
import { ticketHeader, ticketPanel } from './render.js';
import { closeTicket, createTicket, findTicket, isStaff, openTicketCount } from './service.js';

function closeModal(ticketId: number) {
  return new ModalBuilder()
    .setCustomId(cid('tk', 'close', ticketId))
    .setTitle(`Close ticket #${ticketId}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Reason')
        .setDescription('Optional. Shown in the transcript.')
        .setTextInputComponent(new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
    );
}

const ticketCommand = guildSlashCommand({
  module: 'tickets',
  data: inServers(new SlashCommandBuilder().setName('ticket').setDescription('Support tickets'))
    .addSubcommand((s) =>
      s
        .setName('panel')
        .setDescription('Post the "Open a ticket" panel')
        .addChannelOption((o) => o.setName('channel').setDescription('Where to post (default: here)').addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((s) =>
      s.setName('add').setDescription('Add someone to this ticket').addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('remove').setDescription('Remove someone from this ticket').addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('close').setDescription('Close this ticket')),
  execute: async ({ client, interaction, guild }) => {
    const sub = interaction.options.getSubcommand();
    const settings = guild.settings;

    if (sub === 'panel') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return reply(interaction, 'error', 'You need **Manage Server** to post the panel.');
      }
      if (!settings.tickets.parentId) {
        return reply(interaction, 'warning', `Pick a Discord category for tickets first in ${client.cmd('settings')} → Tickets.`);
      }
      const channel = (interaction.options.getChannel('channel') as TextChannel | null) ?? interaction.channel;
      if (!channel?.isSendable()) return reply(interaction, 'error', "I can't post in that channel.");
      await channel.send(v2(ticketPanel(settings)));
      return reply(interaction, 'success', `Ticket panel posted in ${channel}.`);
    }

    const ticket = await findTicket(interaction.channelId);
    if (!ticket) return reply(interaction, 'info', 'Use this inside a ticket channel.');
    const staff = isStaff(interaction.member, settings);

    if (sub === 'close') {
      if (!staff && interaction.user.id !== ticket.openerId) return reply(interaction, 'error', 'Only staff or the ticket owner can close it.');
      return interaction.showModal(closeModal(ticket.ticketId));
    }

    if (!staff) return reply(interaction, 'error', 'Only staff can change who is in a ticket.');
    const user = interaction.options.getUser('user', true);
    const channel = interaction.channel as TextChannel;
    if (sub === 'add') {
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
      return interaction.reply(v2(notice('success', `Added ${user} to this ticket.`)));
    }
    if (user.id === ticket.openerId) return reply(interaction, 'warning', "You can't remove the ticket owner.");
    await channel.permissionOverwrites.delete(user.id);
    return interaction.reply(v2(notice('success', `Removed ${user} from this ticket.`)));
  },
});

const ticketComponents = guildComponents({
  prefix: 'tk',
  module: 'tickets',
  button: async ({ interaction, guild }, [action, id]) => {
    const settings = guild.settings;

    if (action === 'open') {
      if (!settings.tickets.parentId || !interaction.guild.channels.cache.has(settings.tickets.parentId)) {
        return reply(interaction, 'warning', "Tickets aren't fully set up yet. Please tell a staff member.");
      }
      const open = await openTicketCount(interaction.guildId, interaction.user.id);
      if (open >= settings.tickets.maxOpenPerUser) {
        return reply(interaction, 'info', `You already have **${open}** open ticket${open === 1 ? '' : 's'}. Please use ${open === 1 ? 'it' : 'those'} first.`);
      }

      const modal = new ModalBuilder().setCustomId(cid('tk', 'create')).setTitle('Open a ticket');
      if (settings.tickets.categories.length) {
        modal.addLabelComponents(
          new LabelBuilder().setLabel('Category').setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId('category')
              .setPlaceholder('Pick what this is about')
              .addOptions(settings.tickets.categories.map((c) => ({ label: c.label, value: c.id, description: c.description || undefined }))),
          ),
        );
      }
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel('How can we help?')
          .setTextInputComponent(new TextInputBuilder().setCustomId('topic').setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(1000)),
      );
      return interaction.showModal(modal);
    }

    const ticket = await TicketModel.findOne({ guildId: interaction.guildId, ticketId: Number(id), status: 'open' }).lean<TicketRecord>();
    if (!ticket) return reply(interaction, 'info', 'This ticket is already closed.');

    if (action === 'claim') {
      if (!isStaff(interaction.member, settings)) return reply(interaction, 'error', 'Only staff can claim tickets.');
      const updated = await TicketModel.findOneAndUpdate(
        { _id: (ticket as TicketRecord & { _id: unknown })._id, claimedBy: null },
        { $set: { claimedBy: interaction.user.id } },
        { returnDocument: 'after' },
      ).lean<TicketRecord>();
      if (!updated) return reply(interaction, 'info', 'Someone already claimed this ticket.');
      // The header is the second top-level component (after the ping line).
      await interaction.update({ components: [interaction.message.components[0]!, ticketHeader(updated, settings)] });
      return interaction.followUp(v2(notice('success', `${interaction.user} will help you with this ticket.`)));
    }

    if (action === 'close') {
      if (!isStaff(interaction.member, settings) && interaction.user.id !== ticket.openerId) {
        return reply(interaction, 'error', 'Only staff or the ticket owner can close it.');
      }
      return interaction.showModal(closeModal(ticket.ticketId));
    }
  },

  modal: async ({ interaction, guild }, [action, id]) => {
    const settings = guild.settings;

    if (action === 'create') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const topic = interaction.fields.getTextInputValue('topic').trim();
      const category = settings.tickets.categories.length ? (interaction.fields.getStringSelectValues('category')[0] ?? null) : null;
      const open = await openTicketCount(interaction.guildId, interaction.user.id);
      if (open >= settings.tickets.maxOpenPerUser) return respond(interaction, notice('info', 'You already have an open ticket.'));
      const { channel } = await createTicket(interaction.member as GuildMember, settings, topic, category);
      return respond(interaction, notice('success', `Your ticket is ready: ${channel}`));
    }

    if (action === 'close') {
      const ticket = await TicketModel.findOne({ guildId: interaction.guildId, ticketId: Number(id), status: 'open' }).lean<TicketRecord>();
      if (!ticket) return reply(interaction, 'info', 'This ticket is already closed.');
      const channel = interaction.guild.channels.cache.get(ticket.channelId) as TextChannel | undefined;
      if (!channel) return reply(interaction, 'error', "I couldn't find the ticket channel.");
      const reason = interaction.fields.getTextInputValue('reason').trim() || null;
      await interaction.reply(v2(notice('info', 'Closing this ticket in **5 seconds**. A transcript will be saved. 📜')));
      await closeTicket(channel, ticket, interaction.member, reason);
    }
  },
});

export const ticketsModule: BotModuleDefinition = {
  commands: [ticketCommand],
  components: [ticketComponents],
};
