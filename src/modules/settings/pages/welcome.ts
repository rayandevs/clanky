import { LabelBuilder, ModalBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { channelMention, roleMentions, row, status, truncate, v2 } from '../../../ui/components.js';
import { emoji } from '../../../ui/emoji.js';
import { PLACEHOLDERS, welcomeMessage } from '../../welcome/render.js';
import {
  actionButton,
  assignableRoles,
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

export const welcomePage: SettingsPage = {
  id: 'welcome',
  render(env) {
    const s = env.settings.welcome;
    const summary = [
      `**Welcome messages** · ${status(s.enabled)}  ·  **Leave messages** · ${status(s.leaveEnabled)}`,
      `${emoji('channel')} **Channel** · ${channelMention(s.channelId)}`,
      `${emoji('role')} **Auto roles** · ${roleMentions(s.autoRoleIds)}`,
      `${emoji('message')} **Welcome** · ${truncate(s.message, 120)}`,
      `${emoji('leave')} **Leave** · ${truncate(s.leaveMessage, 120)}`,
    ].join('\n');

    const container = pageHeader(env, 'welcome', summary)
      .addActionRowComponents(
        row(
          toggleButton('welcome', 'toggle', 'Welcome', s.enabled),
          toggleButton('welcome', 'leave', 'Leave', s.leaveEnabled),
          toggleButton('welcome', 'avatar', 'Avatar', s.showAvatar),
        ),
      )
      .addActionRowComponents(row(actionButton('welcome', 'edit', 'Edit messages', 'edit'), actionButton('welcome', 'test', 'Preview', 'test')))
      .addActionRowComponents(channelPicker(env, 'welcome', 'channel', { current: s.channelId, placeholder: 'Welcome channel' }))
      .addActionRowComponents(rolePicker(env, 'welcome', 'roles', { current: s.autoRoleIds, placeholder: 'Roles to give new members', max: 5 }));
    return finishPage(container, 'welcome');
  },

  async handle(ctx, action) {
    const { interaction } = ctx;
    const s = ctx.guild.settings.welcome;
    switch (action) {
      case 'toggle':
        await save(ctx, (d) => void (d.welcome.enabled = !d.welcome.enabled));
        return 'render';
      case 'leave':
        await save(ctx, (d) => void (d.welcome.leaveEnabled = !d.welcome.leaveEnabled));
        return 'render';
      case 'avatar':
        await save(ctx, (d) => void (d.welcome.showAvatar = !d.welcome.showAvatar));
        return 'render';
      case 'channel':
        await save(ctx, (d) => void (d.welcome.channelId = selectedIds(interaction)[0] ?? null));
        return 'render';
      case 'roles': {
        const { ok, skipped } = assignableRoles(interaction.guild, selectedIds(interaction));
        await save(ctx, (d) => void (d.welcome.autoRoleIds = ok));
        if (skipped) return { warn: `Skipped **${skipped}** role(s) I can't give. Move my role above them.` };
        return 'render';
      }
      case 'edit': {
        if (!interaction.isButton()) return 'done';
        const modal = new ModalBuilder()
          .setCustomId(sid('welcome', 'save'))
          .setTitle('Welcome & leave messages')
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`You can use: ${PLACEHOLDERS}`))
          .addLabelComponents(
            new LabelBuilder()
              .setLabel('Welcome message')
              .setTextInputComponent(new TextInputBuilder().setCustomId('message').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setValue(s.message)),
            new LabelBuilder()
              .setLabel('Leave message')
              .setTextInputComponent(new TextInputBuilder().setCustomId('leave').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setValue(s.leaveMessage)),
          );
        await interaction.showModal(modal);
        return 'done';
      }
      case 'save': {
        if (!interaction.isModalSubmit()) return 'done';
        const message = interaction.fields.getTextInputValue('message').trim();
        const leave = interaction.fields.getTextInputValue('leave').trim();
        await save(ctx, (d) => {
          if (message) d.welcome.message = message;
          if (leave) d.welcome.leaveMessage = leave;
        });
        return 'render';
      }
      case 'test': {
        const preview = welcomeMessage(interaction.member, ctx.guild.settings, 'join');
        await interaction.reply(v2(preview, { ephemeral: true }));
        return 'done';
      }
    }
    return 'done';
  },
};
