import { LabelBuilder, MessageFlags, ModalBuilder, StringSelectMenuBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle, type InteractionReplyOptions } from 'discord.js';
import { channelMention, roleMentions, row, status, truncate } from '../../../ui/components.js';
import { emoji } from '../../../ui/emoji.js';
import { PLACEHOLDERS, welcomeMessage } from '../../welcome/render.js';
import type { WelcomeEventKind } from '../../../render/welcomeCard.js';
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

const WELCOME_FORMATS = [
  { label: 'Container message', value: 'container', description: 'Clanky’s card-style Components V2 layout' },
  { label: 'Plain text', value: 'text', description: 'A normal Discord text message' },
  { label: 'Message + image', value: 'text_image', description: 'Text with a generated member card' },
  { label: 'Image only', value: 'image_only', description: 'A generated member card with the message on the image' },
] as const;

const isEvent = (value: string | undefined): value is WelcomeEventKind => value === 'join' || value === 'leave';

export const welcomePage: SettingsPage = {
  id: 'welcome',
  render(env, state = []) {
    const s = env.settings.welcome;
    const view = state[0] ?? 'overview';
    if (view === 'roles') {
      const container = pageHeader(env, 'welcome', `${emoji('role')} **Auto roles** · ${roleMentions(s.autoRoleIds)}`)
        .addActionRowComponents(row(actionButton('welcome', 'overview', 'Back to Welcome', 'settings')))
        .addActionRowComponents(rolePicker(env, 'welcome', 'roles', { current: s.autoRoleIds, placeholder: 'Roles to give new members', max: 5 }));
      return finishPage(container, 'welcome');
    }
    if (view === 'join' || view === 'leave') {
      const event = view;
      const config = s[event];
      const channelId = event === 'leave' && !config.channelId ? s.join.channelId : config.channelId;
      const summary = [
        `**${event === 'join' ? 'Join' : 'Leave'} messages** · ${status(event === 'join' ? s.enabled : s.leaveEnabled)}`,
        `${emoji('channel')} **Channel** · ${channelMention(channelId)}${event === 'leave' && !config.channelId ? ' _(inherited from Join)_' : ''}`,
        `${emoji('message')} **Format** · ${config.format.replace('_', ' + ')}`,
        `**Message** · ${truncate(config.message, 100)}`,
      ].join('\n');
      const eventControls = event === 'join'
        ? row(
            actionButton('welcome', 'overview', 'Back', 'settings'),
            toggleButton('welcome', 'ping-join', 'Mention', config.pingUser),
            toggleButton('welcome', 'bots-join', 'Include bots', config.includeBots),
            toggleButton('welcome', 'avatar-join', 'Avatar', config.artwork.showAvatar),
          )
        : row(
            actionButton('welcome', 'overview', 'Back', 'settings'),
            toggleButton('welcome', 'toggle-leave', 'Leave', s.leaveEnabled),
            toggleButton('welcome', 'ping-leave', 'Mention', config.pingUser),
            toggleButton('welcome', 'bots-leave', 'Include bots', config.includeBots),
            toggleButton('welcome', 'avatar-leave', 'Avatar', config.artwork.showAvatar),
          );
      const container = pageHeader(env, 'welcome', summary)
        .addActionRowComponents(eventControls)
        .addActionRowComponents(
          row(
            new StringSelectMenuBuilder()
              .setCustomId(sid('welcome', 'format', event))
              .setPlaceholder('Choose message format')
              .addOptions(WELCOME_FORMATS.map((option) => ({ ...option, default: option.value === config.format }))),
          ),
        )
        .addActionRowComponents(
          channelPicker(env, 'welcome', 'channel', {
            current: config.channelId,
            placeholder: event === 'join' ? 'Join message channel' : 'Leave channel (empty to inherit Join)',
          }, [event]),
        )
        .addActionRowComponents(row(actionButton('welcome', `edit-${event}`, 'Edit message', 'edit'), actionButton('welcome', `test-${event}`, 'Preview', 'welcome')));
      return finishPage(container, 'welcome');
    }

    const summary = [
      `**Welcome messages** · ${status(s.enabled)}  ·  **Leave messages** · ${status(s.leaveEnabled)}`,
      `${emoji('channel')} **Join** · ${channelMention(s.join.channelId)}  ·  **Leave** · ${s.leave.channelId ? channelMention(s.leave.channelId) : 'Same as join channel'}`,
      `${emoji('message')} **Formats** · Join: ${s.join.format.replace('_', ' + ')}  ·  Leave: ${s.leave.format.replace('_', ' + ')}`,
      `**Screening** · ${s.waitForScreening ? 'Welcome waits until screening passes' : 'Welcome sends on join'}  ·  **Auto roles** · ${roleMentions(s.autoRoleIds)}`,
    ].join('\n');
    const container = pageHeader(env, 'welcome', summary)
      .addActionRowComponents(
        row(
          toggleButton('welcome', 'toggle', 'Welcome', s.enabled),
          toggleButton('welcome', 'toggle-leave', 'Leave', s.leaveEnabled),
          toggleButton('welcome', 'screening', 'After screening', s.waitForScreening),
        ),
      )
      .addActionRowComponents(
        row(
          actionButton('welcome', 'join', 'Join setup', 'welcome'),
          actionButton('welcome', 'leave-view', 'Leave setup', 'leave'),
          actionButton('welcome', 'roles-view', 'Auto roles', 'role'),
        ),
      );
    return finishPage(container, 'welcome');
  },

  async handle(ctx, action, args) {
    const { interaction } = ctx;
    const s = ctx.guild.settings.welcome;
    const event = isEvent(args[0]) ? args[0] : null;
    switch (action) {
      case 'overview':
        return { state: [] };
      case 'join':
        return { state: ['join'] };
      case 'leave-view':
        return { state: ['leave'] };
      case 'roles-view':
        return { state: ['roles'] };
      case 'toggle':
        await save(ctx, (d) => void (d.welcome.enabled = !d.welcome.enabled));
        return { state: ['overview'] };
      case 'toggle-leave':
        await save(ctx, (d) => void (d.welcome.leaveEnabled = !d.welcome.leaveEnabled));
        return { state: ['leave'] };
      case 'screening':
        await save(ctx, (d) => void (d.welcome.waitForScreening = !d.welcome.waitForScreening));
        return { state: ['overview'] };
      case 'ping-join':
      case 'bots-join':
      case 'avatar-join':
        await save(ctx, (d) => {
          if (action === 'ping-join') d.welcome.join.pingUser = !d.welcome.join.pingUser;
          if (action === 'bots-join') d.welcome.join.includeBots = !d.welcome.join.includeBots;
          if (action === 'avatar-join') d.welcome.join.artwork.showAvatar = !d.welcome.join.artwork.showAvatar;
        });
        return { state: ['join'] };
      case 'ping-leave':
      case 'bots-leave':
      case 'avatar-leave':
        await save(ctx, (d) => {
          if (action === 'ping-leave') d.welcome.leave.pingUser = !d.welcome.leave.pingUser;
          if (action === 'bots-leave') d.welcome.leave.includeBots = !d.welcome.leave.includeBots;
          if (action === 'avatar-leave') d.welcome.leave.artwork.showAvatar = !d.welcome.leave.artwork.showAvatar;
        });
        return { state: ['leave'] };
      case 'format': {
        if (!event || !interaction.isStringSelectMenu()) return { state: ['overview'] };
        const format = interaction.values[0];
        if (!WELCOME_FORMATS.some((option) => option.value === format)) return { state: [event] };
        await save(ctx, (d) => void (d.welcome[event].format = format as typeof d.welcome.join.format));
        return { state: [event] };
      }
      case 'channel': {
        if (!event) return { state: ['overview'] };
        await save(ctx, (d) => void (d.welcome[event].channelId = selectedIds(interaction)[0] ?? null));
        return { state: [event] };
      }
      case 'roles': {
        const { ok, skipped } = assignableRoles(interaction.guild, selectedIds(interaction));
        await save(ctx, (d) => void (d.welcome.autoRoleIds = ok));
        if (skipped) return { warn: `Skipped **${skipped}** role(s) I can't give. Move my role above them.`, state: ['roles'] };
        return { state: ['roles'] };
      }
      case 'edit-join':
      case 'edit-leave': {
        if (!interaction.isButton()) return 'done';
        const kind = action === 'edit-join' ? 'join' : 'leave';
        const message = s[kind].message;
        const modal = new ModalBuilder()
          .setCustomId(sid('welcome', `save-${kind}`))
          .setTitle(`${kind === 'join' ? 'Join' : 'Leave'} message`)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Use: ${PLACEHOLDERS}`))
          .addLabelComponents(
            new LabelBuilder()
              .setLabel('Message')
              .setTextInputComponent(new TextInputBuilder().setCustomId('message').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setValue(message)),
          );
        await interaction.showModal(modal);
        return 'done';
      }
      case 'save-join':
      case 'save-leave': {
        if (!interaction.isModalSubmit()) return 'done';
        const kind = action === 'save-join' ? 'join' : 'leave';
        const message = interaction.fields.getTextInputValue('message').trim();
        if (message) await save(ctx, (d) => void (d.welcome[kind].message = message));
        return { state: [kind] };
      }
      case 'test-join':
      case 'test-leave': {
        if (!interaction.isButton()) return 'done';
        const kind = action === 'test-join' ? 'join' : 'leave';
        const preview = await welcomeMessage(interaction.member, ctx.guild.settings, kind);
        const config = s[kind];
        const flags = MessageFlags.Ephemeral | (config.format === 'container' ? MessageFlags.IsComponentsV2 : 0);
        await interaction.reply({ ...preview, flags } as InteractionReplyOptions);
        return 'done';
      }
    }
    return 'done';
  },
};
