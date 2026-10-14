import {
  ApplicationCommandType,
  ButtonStyle,
  ContainerBuilder,
  ContextMenuCommandBuilder,
  LabelBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  RadioGroupBuilder,
  RadioGroupOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type APIContainerComponent,
} from 'discord.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { guildComponents, guildMessageMenu } from '../../core/types.js';
import { cases } from '../../services/index.js';
import { button, divider, panel, row, text, truncate, v2 } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';
import { reply } from '../../ui/respond.js';
import { colors } from '../../ui/theme.js';
import { logCase } from './shared.js';

const REASONS = {
  spam: 'Spam or scam',
  harassment: 'Harassment or hate',
  nsfw: 'NSFW content',
  other: 'Something else',
} as const;

export const reportMenu = guildMessageMenu({
  module: 'moderation',
  cooldown: 30,
  data: inServers(new ContextMenuCommandBuilder().setName('Report message').setType(ApplicationCommandType.Message)),
  execute: async ({ interaction, guild }) => {
    if (!guild.settings.moderation.reportsChannelId) {
      return reply(interaction, 'warning', "Reports aren't set up in this server yet.");
    }
    const message = interaction.targetMessage;
    if (message.author.id === interaction.user.id) return reply(interaction, 'info', "You can't report your own message.");
    if (message.author.bot) return reply(interaction, 'info', "You can't report bot messages.");

    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(cid('rep', 'submit', message.channelId, message.id))
        .setTitle('Report message')
        .addLabelComponents(
          new LabelBuilder().setLabel("What's wrong?").setRadioGroupComponent(
            new RadioGroupBuilder()
              .setCustomId('reason')
              .setRequired(true)
              .setOptions(Object.entries(REASONS).map(([value, label]) => new RadioGroupOptionBuilder().setValue(value).setLabel(label))),
          ),
          new LabelBuilder()
            .setLabel('Anything else?')
            .setDescription('Optional. Only staff can see this.')
            .setTextInputComponent(new TextInputBuilder().setCustomId('details').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
        ),
    );
  },
});

function closeReport(interaction: { message: { components: unknown[] } }, line: string): ContainerBuilder {
  const original = interaction.message.components[0] as { toJSON(): APIContainerComponent };
  const container = new ContainerBuilder(original.toJSON());
  // Remove the action buttons (last component) and add who handled it.
  container.spliceComponents(-1, 1);
  return container.setAccentColor(colors.muted).addTextDisplayComponents(text(line));
}

export const reportComponents = guildComponents({
  prefix: 'rep',
  module: 'moderation',
  modal: async ({ interaction, guild }, [, channelId, messageId]) => {
    const reportsChannel = interaction.guild.channels.cache.get(guild.settings.moderation.reportsChannelId ?? '');
    if (!reportsChannel?.isSendable()) return reply(interaction, 'error', "I can't reach the reports channel. Let an admin know.");

    const source = interaction.guild.channels.cache.get(channelId!);
    const message = source?.isTextBased() ? await source.messages.fetch(messageId!).catch(() => null) : null;
    if (!message) return reply(interaction, 'error', 'That message was already deleted.');

    const reason = REASONS[interaction.fields.getRadioGroup('reason', true) as keyof typeof REASONS] ?? 'Other';
    const details = interaction.fields.getTextInputValue('details').trim();

    const container = panel({ title: 'New report', emoji: 'report', accent: colors.error })
      .addTextDisplayComponents(
        text(
          [
            `${emoji('user')} **Author** ${message.author} · \`${message.author.id}\``,
            `${emoji('report')} **Reported by** ${interaction.user}`,
            `${emoji('list')} **Reason** ${reason}${details ? `\n> ${truncate(details, 400)}` : ''}`,
          ].join('\n'),
        ),
      )
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(`**Message** in ${message.channel}\n${truncate(message.content || '*No text — maybe an attachment.*', 900)}`))
      .addActionRowComponents(
        row(
          button({ url: message.url, label: 'Jump', emoji: 'link' }),
          button({ id: cid('rep', 'delete', message.channelId, message.id), label: 'Delete message', emoji: 'delete', style: ButtonStyle.Danger }),
          button({ id: cid('rep', 'timeout', message.author.id), label: 'Timeout 1h', emoji: 'timeout', style: ButtonStyle.Danger }),
          button({ id: cid('rep', 'dismiss'), label: 'Dismiss', emoji: 'done' }),
        ),
      );

    await reportsChannel.send(v2(container));
    await reply(interaction, 'success', 'Thanks! Your report was sent to the staff team.');
  },

  button: async ({ interaction, guild }, [action, a, b]) => {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      return reply(interaction, 'error', 'Only moderators can handle reports.');
    }
    const by = `-# ${emoji('success')} Handled by ${interaction.user}`;

    if (action === 'dismiss') {
      return interaction.update({ components: [closeReport(interaction, `${by} · Dismissed`)] });
    }
    if (action === 'delete') {
      const channel = interaction.guild.channels.cache.get(a!);
      const deleted = channel?.isTextBased() ? await channel.messages.delete(b!).then(() => true).catch(() => false) : false;
      return interaction.update({ components: [closeReport(interaction, `${by} · ${deleted ? 'Message deleted' : 'Message was already gone'}`)] });
    }
    if (action === 'timeout') {
      const member = await interaction.guild.members.fetch(a!).catch(() => null);
      if (!member?.moderatable) return reply(interaction, 'error', "I can't time out that member.");
      const reason = 'Reported message';
      await member.timeout(3_600_000, `${interaction.user.tag}: ${reason}`);
      const record = await cases.create({
        guildId: interaction.guildId,
        type: 'timeout',
        targetId: member.id,
        targetTag: member.user.tag,
        moderatorId: interaction.user.id,
        reason,
        duration: 3_600_000,
      });
      await logCase(interaction.guild, guild.settings, record);
      return interaction.update({ components: [closeReport(interaction, `${by} · Timed out for 1h (case #${record.caseId})`)] });
    }
  },
});
