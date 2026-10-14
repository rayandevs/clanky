import { ChannelType, LabelBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { TOGGLEABLE } from '../../../settings/registry.js';
import { channelMention, row } from '../../../ui/components.js';
import { componentEmoji, emoji } from '../../../ui/emoji.js';
import { colors, hexToInt, intToHex } from '../../../ui/theme.js';
import { reply } from '../../../ui/respond.js';
import { actionButton, channelPicker, finishPage, pageHeader, save, selectedIds, sid, type SettingsPage } from '../kit.js';

export const generalPage: SettingsPage = {
  id: 'general',
  render(env) {
    const { general } = env.settings;
    const enabled = TOGGLEABLE.filter((m) => (env.settings[m.id] as { enabled?: boolean }).enabled !== false);
    const summary = [
      `${emoji('palette')} **Accent color** · \`${intToHex(general.accentColor)}\``,
      `${emoji('sparkles')} **Update notes channel** · ${channelMention(general.updatesChannelId)}`,
      `${emoji('modules')} **Modules on** · ${enabled.length}/${TOGGLEABLE.length}`,
    ].join('\n');

    const container = pageHeader(env, 'general', summary)
      .addActionRowComponents(row(actionButton('general', 'accent', 'Accent color', 'palette'), actionButton('general', 'accent-reset', 'Reset color', 'refresh')))
      .addActionRowComponents(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(sid('general', 'modules'))
            .setPlaceholder('Modules that are on')
            .setMinValues(0)
            .setMaxValues(TOGGLEABLE.length)
            .addOptions(
              TOGGLEABLE.map((m) => ({
                label: m.name,
                value: m.id,
                description: m.description.slice(0, 100),
                emoji: componentEmoji(m.emoji),
                default: enabled.includes(m),
              })),
            ),
        ),
      )
      .addActionRowComponents(
        channelPicker(env, 'general', 'updates', {
          current: general.updatesChannelId,
          placeholder: "Channel for Clanky's update notes",
          types: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
        }),
      );
    return finishPage(container, 'general');
  },

  async handle(ctx, action) {
    const { interaction } = ctx;
    switch (action) {
      case 'accent': {
        if (!interaction.isButton()) return 'done';
        const modal = new ModalBuilder()
          .setCustomId(sid('general', 'accent-save'))
          .setTitle('Accent color')
          .addLabelComponents(
            new LabelBuilder()
              .setLabel('Hex color')
              .setDescription('Used on all Clanky messages here, e.g. #7C5CFF')
              .setTextInputComponent(
                new TextInputBuilder()
                  .setCustomId('color')
                  .setStyle(TextInputStyle.Short)
                  .setMinLength(6)
                  .setMaxLength(7)
                  .setValue(intToHex(ctx.guild.settings.general.accentColor)),
              ),
          );
        await interaction.showModal(modal);
        return 'done';
      }
      case 'accent-save': {
        if (!interaction.isModalSubmit()) return 'done';
        const color = hexToInt(interaction.fields.getTextInputValue('color'));
        if (color === null) {
          await reply(interaction, 'error', "That isn't a valid hex color. Try something like `#7C5CFF`.");
          return 'done';
        }
        await save(ctx, (s) => void (s.general.accentColor = color));
        return 'render';
      }
      case 'accent-reset':
        await save(ctx, (s) => void (s.general.accentColor = colors.brand));
        return 'render';
      case 'modules': {
        const on = new Set(selectedIds(interaction));
        await save(ctx, (s) => {
          for (const m of TOGGLEABLE) (s[m.id] as { enabled: boolean }).enabled = on.has(m.id);
        });
        return 'render';
      }
      case 'updates':
        await save(ctx, (s) => void (s.general.updatesChannelId = selectedIds(interaction)[0] ?? null));
        return 'render';
    }
    return 'done';
  },
};
