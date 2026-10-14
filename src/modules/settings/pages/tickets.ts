import { ChannelType, LabelBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { channelMention, roleMentions, row, status, v2 } from '../../../ui/components.js';
import { emoji } from '../../../ui/emoji.js';
import { reply } from '../../../ui/respond.js';
import { ticketPanel } from '../../tickets/render.js';
import {
  actionButton,
  channelPicker,
  finishPage,
  pageHeader,
  rolePicker,
  save,
  selectedIds,
  sid,
  toggleButton,
  type SettingsPage,
} from '../kit.js';

export const ticketsPage: SettingsPage = {
  id: 'tickets',
  render(env) {
    const s = env.settings.tickets;
    const summary = [
      `**Status** · ${status(s.enabled)}`,
      `${emoji('channel')} **Create tickets in** · ${channelMention(s.parentId)}`,
      `${emoji('transcript')} **Transcripts** · ${channelMention(s.logChannelId)}`,
      `${emoji('shield')} **Staff** · ${roleMentions(s.staffRoleIds)}`,
      `${emoji('list')} **Categories** · ${s.categories.length ? s.categories.map((c) => c.label).join(', ') : '`None`'}`,
      `${emoji('user')} **Open tickets per member** · ${s.maxOpenPerUser}`,
    ].join('\n');

    const container = pageHeader(env, 'tickets', summary)
      .addActionRowComponents(
        row(
          toggleButton('tickets', 'toggle', 'Module', s.enabled),
          actionButton('tickets', 'panel', 'Panel text', 'edit'),
          actionButton('tickets', 'add-cat', 'Add category', 'add'),
          actionButton('tickets', 'post', 'Post panel here', 'rocket'),
        ),
      )
      .addActionRowComponents(
        channelPicker(env, 'tickets', 'parent', { current: s.parentId, placeholder: 'Discord category for ticket channels', types: [ChannelType.GuildCategory] }),
      )
      .addActionRowComponents(channelPicker(env, 'tickets', 'log', { current: s.logChannelId, placeholder: 'Transcript channel' }))
      .addActionRowComponents(rolePicker(env, 'tickets', 'staff', { current: s.staffRoleIds, placeholder: 'Staff roles', max: 10 }));

    if (s.categories.length) {
      container.addActionRowComponents(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(sid('tickets', 'remove-cat'))
            .setPlaceholder('Remove a category')
            .addOptions(s.categories.map((c) => ({ label: c.label, value: c.id, description: c.description || undefined }))),
        ),
      );
    }
    return finishPage(container, 'tickets');
  },

  async handle(ctx, action) {
    const { interaction } = ctx;
    const s = ctx.guild.settings.tickets;
    switch (action) {
      case 'toggle':
        await save(ctx, (d) => void (d.tickets.enabled = !d.tickets.enabled));
        return 'render';
      case 'parent':
        await save(ctx, (d) => void (d.tickets.parentId = selectedIds(interaction)[0] ?? null));
        return 'render';
      case 'log':
        await save(ctx, (d) => void (d.tickets.logChannelId = selectedIds(interaction)[0] ?? null));
        return 'render';
      case 'staff':
        await save(ctx, (d) => void (d.tickets.staffRoleIds = selectedIds(interaction)));
        return 'render';
      case 'remove-cat': {
        const id = selectedIds(interaction)[0];
        await save(ctx, (d) => void (d.tickets.categories = d.tickets.categories.filter((c) => c.id !== id)));
        return 'render';
      }
      case 'panel': {
        if (!interaction.isButton()) return 'done';
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(sid('tickets', 'panel-save'))
            .setTitle('Ticket panel')
            .addLabelComponents(
              new LabelBuilder().setLabel('Title').setTextInputComponent(new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setMaxLength(100).setValue(s.panelTitle)),
              new LabelBuilder()
                .setLabel('Description')
                .setTextInputComponent(new TextInputBuilder().setCustomId('description').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setValue(s.panelDescription)),
              new LabelBuilder()
                .setLabel('Open tickets per member')
                .setDescription('A number from 1 to 5')
                .setTextInputComponent(new TextInputBuilder().setCustomId('max').setStyle(TextInputStyle.Short).setMaxLength(1).setValue(String(s.maxOpenPerUser))),
            ),
        );
        return 'done';
      }
      case 'panel-save': {
        if (!interaction.isModalSubmit()) return 'done';
        const max = Number(interaction.fields.getTextInputValue('max'));
        if (!Number.isInteger(max) || max < 1 || max > 5) {
          await reply(interaction, 'error', 'Open tickets per member must be a number from **1** to **5**.');
          return 'done';
        }
        await save(ctx, (d) => {
          d.tickets.panelTitle = interaction.fields.getTextInputValue('title').trim() || d.tickets.panelTitle;
          d.tickets.panelDescription = interaction.fields.getTextInputValue('description').trim() || d.tickets.panelDescription;
          d.tickets.maxOpenPerUser = max;
        });
        return 'render';
      }
      case 'add-cat': {
        if (!interaction.isButton()) return 'done';
        if (s.categories.length >= 10) {
          await reply(interaction, 'warning', 'You can have up to **10** categories. Remove one first.');
          return 'done';
        }
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(sid('tickets', 'add-cat-save'))
            .setTitle('New ticket category')
            .addLabelComponents(
              new LabelBuilder().setLabel('Name').setDescription('e.g. Support, Report a member, Billing').setTextInputComponent(new TextInputBuilder().setCustomId('label').setStyle(TextInputStyle.Short).setMaxLength(50)),
              new LabelBuilder().setLabel('Short description').setTextInputComponent(new TextInputBuilder().setCustomId('description').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false)),
            ),
        );
        return 'done';
      }
      case 'add-cat-save': {
        if (!interaction.isModalSubmit()) return 'done';
        const label = interaction.fields.getTextInputValue('label').trim();
        const description = interaction.fields.getTextInputValue('description').trim();
        await save(ctx, (d) => void d.tickets.categories.push({ id: Date.now().toString(36), label, description }));
        return 'render';
      }
      case 'post': {
        const channel = interaction.channel;
        if (!channel?.isSendable()) {
          await reply(interaction, 'error', "I can't post in this channel.");
          return 'done';
        }
        await channel.send(v2(ticketPanel(ctx.guild.settings)));
        return { warn: 'Ticket panel posted in this channel. ✅' };
      }
    }
    return 'done';
  },
};
