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
import { publishTicketPanel } from './panels.js';
import { ticketHeader } from './render.js';
import { closeTicket, createTicket, findTicket, isStaff, openTicketCount, ticketRouting } from './service.js';

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
        .setDescription('Post or update a ticket panel')
        .addStringOption((o) => o.setName('panel').setDescription('Which configured panel to publish').setAutocomplete(true))
        .addStringOption((o) => o.setName('mode').setDescription('Publish (or refresh) or update an existing panel').addChoices({ name: 'Publish or refresh', value: 'publish' }, { name: 'Update existing only', value: 'update' }))
        .addChannelOption((o) => o.setName('channel').setDescription('Where to post (default: here)').addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((s) =>
      s.setName('add').setDescription('Add someone to this ticket').addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('remove').setDescription('Remove someone from this ticket').addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('close').setDescription('Close this ticket')),
  autocomplete: async ({ interaction, guild }) => {
    if (interaction.options.getFocused(true).name !== 'panel') return interaction.respond([]);
    const query = interaction.options.getFocused().toLowerCase();
    return interaction.respond(
      guild.settings.tickets.panels
        .filter((panel) => `${panel.title} ${panel.id}`.toLowerCase().includes(query))
        .map((panel) => ({ name: panel.title.slice(0, 100), value: panel.id }))
        .slice(0, 25),
    );
  },
  execute: async ({ interaction, guild }) => {
    const sub = interaction.options.getSubcommand();
    const settings = guild.settings;

    if (sub === 'panel') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return reply(interaction, 'error', 'You need **Manage Server** to post the panel.');
      }
      const panelId = interaction.options.getString('panel');
      const panel = panelId ? settings.tickets.panels.find((item) => item.id === panelId) : settings.tickets.panels[0]!;
      if (!panel) return reply(interaction, 'warning', 'That ticket panel is no longer configured. Choose an active panel.');
      const channel = (interaction.options.getChannel('channel') as TextChannel | null) ?? interaction.channel;
      if (!channel?.isSendable() || channel.type !== ChannelType.GuildText) return reply(interaction, 'error', "I can't post in that channel.");
      const mode = interaction.options.getString('mode') as 'publish' | 'update' | null;
      const result = await publishTicketPanel(channel, settings, panel, mode ?? 'publish');
      if (result === 'missing') return reply(interaction, 'warning', 'There is no tracked panel message in that channel to update. Choose “Publish or refresh” to post one.');
      return reply(interaction, 'success', `Ticket panel **${panel.title}** ${result} in ${channel}.`);
    }

    const ticket = await findTicket(interaction.channelId);
    if (!ticket) return reply(interaction, 'info', 'Use this inside a ticket channel.');
    const staff = isStaff(interaction.member, settings, ticket);

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
      const panel = id ? settings.tickets.panels.find((item) => item.id === id) : settings.tickets.panels[0]!;
      if (!panel) return reply(interaction, 'warning', 'That ticket panel has been removed. Please use a current panel.');
      const routing = ticketRouting(settings, panel);
      if (!routing.parentId || !interaction.guild.channels.cache.has(routing.parentId)) {
        return reply(interaction, 'warning', "Tickets aren't fully set up yet. Please tell a staff member.");
      }
      const open = await openTicketCount(interaction.guildId, interaction.user.id);
      if (open >= settings.tickets.maxOpenPerUser) {
        return reply(interaction, 'info', `You already have **${open}** open ticket${open === 1 ? '' : 's'}. Please use ${open === 1 ? 'it' : 'those'} first.`);
      }

      const modal = new ModalBuilder().setCustomId(cid('tk', 'create', panel.id)).setTitle(panel.title.slice(0, 45));
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
      for (const question of panel.questions) {
        const input = new TextInputBuilder()
          .setCustomId(question.id)
          .setStyle(question.style === 'short' ? TextInputStyle.Short : TextInputStyle.Paragraph)
          .setRequired(question.required)
          .setMinLength(question.required ? question.minLength : 0)
          .setMaxLength(question.maxLength);
        if (question.placeholder) input.setPlaceholder(question.placeholder);
        const label = new LabelBuilder().setLabel(question.label).setTextInputComponent(input);
        if (question.description) label.setDescription(question.description);
        modal.addLabelComponents(label);
      }
      return interaction.showModal(modal);
    }

    const ticket = await TicketModel.findOne({ guildId: interaction.guildId, ticketId: Number(id), status: 'open' }).lean<TicketRecord>();
    if (!ticket) return reply(interaction, 'info', 'This ticket is already closed.');

    if (action === 'claim') {
      if (!isStaff(interaction.member, settings, ticket)) return reply(interaction, 'error', 'Only staff can claim tickets.');
      const updated = await TicketModel.findOneAndUpdate(
        { _id: (ticket as TicketRecord & { _id: unknown })._id, claimedBy: null },
        { $set: { claimedBy: interaction.user.id } },
        { returnDocument: 'after' },
      ).lean<TicketRecord>();
      if (!updated) return reply(interaction, 'info', 'Someone already claimed this ticket.');
      await interaction.update({ components: [...interaction.message.components.slice(0, -1), ticketHeader(updated, settings)] });
      return interaction.followUp(v2(notice('success', `${interaction.user} will help you with this ticket.`)));
    }

    if (action === 'close') {
      if (!isStaff(interaction.member, settings, ticket) && interaction.user.id !== ticket.openerId) {
        return reply(interaction, 'error', 'Only staff or the ticket owner can close it.');
      }
      return interaction.showModal(closeModal(ticket.ticketId));
    }
  },

  modal: async ({ interaction, guild }, [action, id]) => {
    const settings = guild.settings;

    if (action === 'create') {
      const panel = settings.tickets.panels.find((item) => item.id === id);
      if (!panel) return reply(interaction, 'warning', 'That ticket form has changed. Please reopen the latest ticket panel.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const categoryValue = settings.tickets.categories.length ? (interaction.fields.getStringSelectValues('category')[0] ?? null) : null;
      const category = settings.tickets.categories.find((item) => item.id === categoryValue)?.id ?? null;
      const answers = panel.questions.map((question) => ({
        questionId: question.id,
        label: question.label,
        answer: interaction.fields.getTextInputValue(question.id).trim(),
      }));
      const open = await openTicketCount(interaction.guildId, interaction.user.id);
      if (open >= settings.tickets.maxOpenPerUser) return respond(interaction, notice('info', 'You already have an open ticket.'));
      const { channel } = await createTicket(interaction.member as GuildMember, settings, panel, category, answers);
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
