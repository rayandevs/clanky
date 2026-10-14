import {
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  RadioGroupBuilder,
  RadioGroupOptionBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  type GuildMember,
} from 'discord.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { timestamp } from '../../core/time.js';
import { guildComponents, guildSlashCommand, type BotModuleDefinition } from '../../core/types.js';
import { SuggestionModel, type SuggestionRecord, type SuggestionStatus } from '../../database/models/index.js';
import { guilds } from '../../services/index.js';
import type { GuildSettings } from '../../settings/schema.js';
import { button, divider, panel, progressBar, row, text, truncate, v2 } from '../../ui/components.js';
import { emoji, type EmojiKey } from '../../ui/emoji.js';
import { reply } from '../../ui/respond.js';
import { colors } from '../../ui/theme.js';

const STATUS: Record<SuggestionStatus, { label: string; emoji: EmojiKey; color?: number }> = {
  pending: { label: 'Open for votes', emoji: 'loading' },
  approved: { label: 'Approved', emoji: 'approve', color: colors.success },
  denied: { label: 'Denied', emoji: 'deny', color: colors.error },
  implemented: { label: 'Implemented', emoji: 'rocket', color: colors.info },
};

function render(s: SuggestionRecord, settings: GuildSettings) {
  const up = s.upvotes.length;
  const down = s.downvotes.length;
  const total = up + down;
  const percent = total ? Math.round((up / total) * 100) : 0;
  const status = STATUS[s.status];
  const author = settings.suggestions.anonymous ? 'Anonymous' : `<@${s.authorId}>`;

  const container = panel({
    title: `Suggestion #${s.suggestionId}`,
    emoji: 'suggestion',
    description: `**${s.title}**\n${s.content}`,
    accent: status.color ?? settings.general.accentColor,
  })
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          `${emoji('upvote')} **${up}** · ${emoji('downvote')} **${down}**  ${progressBar(up, total, 10)} ${total ? `${percent}%` : ''}`,
          `${emoji(status.emoji)} **${status.label}**${s.reviewerId ? ` by <@${s.reviewerId}>` : ''}`,
          s.reviewNote ? `> ${truncate(s.reviewNote, 300)}` : null,
          `-# By ${author} · ${timestamp(s.createdAt, 'R')}`,
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    );

  const closed = s.status !== 'pending';
  container.addActionRowComponents(
    row(
      button({ id: cid('sg', 'up', s.suggestionId), label: String(up), emoji: 'upvote', style: ButtonStyle.Success, disabled: closed }),
      button({ id: cid('sg', 'down', s.suggestionId), label: String(down), emoji: 'downvote', style: ButtonStyle.Danger, disabled: closed }),
      button({ id: cid('sg', 'review', s.suggestionId), label: 'Review', emoji: 'shield' }),
    ),
  );
  return container;
}

function isReviewer(member: GuildMember, settings: GuildSettings): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild) || settings.suggestions.reviewerRoleIds.some((id) => member.roles.cache.has(id));
}

const suggestCommand = guildSlashCommand({
  module: 'suggestions',
  cooldown: 60,
  data: inServers(new SlashCommandBuilder().setName('suggest').setDescription('Share an idea with the server')),
  execute: async ({ interaction, guild }) => {
    if (!guild.settings.suggestions.channelId) return reply(interaction, 'warning', "Suggestions aren't set up here yet.");
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(cid('sg', 'create'))
        .setTitle('New suggestion')
        .addLabelComponents(
          new LabelBuilder().setLabel('Your idea in a few words').setTextInputComponent(new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setMaxLength(100)),
          new LabelBuilder()
            .setLabel('Tell us more')
            .setDescription('Why would it help?')
            .setTextInputComponent(new TextInputBuilder().setCustomId('content').setStyle(TextInputStyle.Paragraph).setMinLength(10).setMaxLength(1500)),
        ),
    );
  },
});

const suggestionComponents = guildComponents({
  prefix: 'sg',
  module: 'suggestions',
  modal: async ({ interaction, guild }, [action, id]) => {
    const settings = guild.settings;

    if (action === 'create') {
      const channel = interaction.guild.channels.cache.get(settings.suggestions.channelId ?? '');
      if (!channel?.isSendable() || !channel.isTextBased()) return reply(interaction, 'error', "I can't post in the suggestions channel.");
      const suggestionId = await guilds.nextCounter(interaction.guildId, 'suggestions');
      const doc = (
        await SuggestionModel.create({
          guildId: interaction.guildId,
          suggestionId,
          authorId: interaction.user.id,
          title: interaction.fields.getTextInputValue('title').trim(),
          content: interaction.fields.getTextInputValue('content').trim(),
          channelId: channel.id,
        })
      ).toObject();
      const message = await channel.send(v2(render(doc, settings)));
      let threadId: string | null = null;
      if (settings.suggestions.createThreads && 'startThread' in message) {
        const thread = await message
          .startThread({ name: truncate(`💡 ${doc.title}`, 100), autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays })
          .catch(() => null);
        threadId = thread?.id ?? null;
      }
      await SuggestionModel.updateOne({ guildId: interaction.guildId, suggestionId }, { $set: { messageId: message.id, threadId } });
      return reply(interaction, 'success', `Your suggestion was posted in ${channel}. 💡`);
    }

    if (action === 'review') {
      const status = interaction.fields.getRadioGroup('status', true) as SuggestionStatus;
      const note = interaction.fields.getTextInputValue('note').trim() || null;
      const updated = await SuggestionModel.findOneAndUpdate(
        { guildId: interaction.guildId, suggestionId: Number(id) },
        { $set: { status, reviewNote: note, reviewerId: interaction.user.id } },
        { returnDocument: 'after' },
      ).lean<SuggestionRecord>();
      if (!updated) return reply(interaction, 'error', 'That suggestion was deleted.');
      if (interaction.isFromMessage()) await interaction.update({ components: [render(updated, settings)] });

      // Let the author know.
      const author = await interaction.client.users.fetch(updated.authorId).catch(() => null);
      const info = STATUS[status];
      await author
        ?.send(
          v2(
            panel({
              title: `Your suggestion was ${info.label.toLowerCase()}`,
              emoji: info.emoji,
              description: `**${updated.title}** in **${interaction.guild.name}**${note ? `\n> ${note}` : ''}`,
              accent: info.color ?? settings.general.accentColor,
            }),
          ),
        )
        .catch(() => null);
    }
  },

  button: async ({ interaction, guild }, [action, id]) => {
    const settings = guild.settings;
    const suggestionId = Number(id);
    const userId = interaction.user.id;

    if (action === 'review') {
      if (!isReviewer(interaction.member, settings)) return reply(interaction, 'error', 'Only reviewers can do this.');
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId(cid('sg', 'review', suggestionId))
          .setTitle(`Review suggestion #${suggestionId}`)
          .addLabelComponents(
            new LabelBuilder().setLabel('Decision').setRadioGroupComponent(
              new RadioGroupBuilder()
                .setCustomId('status')
                .setRequired(true)
                .setOptions(
                  (Object.keys(STATUS) as SuggestionStatus[]).map((key) => new RadioGroupOptionBuilder().setValue(key).setLabel(STATUS[key].label)),
                ),
            ),
            new LabelBuilder()
              .setLabel('Note')
              .setDescription('Optional. Shown on the suggestion.')
              .setTextInputComponent(new TextInputBuilder().setCustomId('note').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
          ),
      );
    }

    const current = await SuggestionModel.findOne({ guildId: interaction.guildId, suggestionId }).lean<SuggestionRecord>();
    if (!current) return reply(interaction, 'error', 'That suggestion was deleted.');
    if (current.status !== 'pending') return reply(interaction, 'info', 'Voting is closed for this suggestion.');

    const [mine, other] = action === 'up' ? (['upvotes', 'downvotes'] as const) : (['downvotes', 'upvotes'] as const);
    const update = current[mine].includes(userId)
      ? { $pull: { [mine]: userId } } // click again to remove your vote
      : { $addToSet: { [mine]: userId }, $pull: { [other]: userId } };
    const updated = await SuggestionModel.findOneAndUpdate({ guildId: interaction.guildId, suggestionId }, update, { returnDocument: 'after' }).lean<SuggestionRecord>();
    await interaction.update({ components: [render(updated!, settings)] });
  },
});

export const suggestionsModule: BotModuleDefinition = {
  commands: [suggestCommand],
  components: [suggestionComponents],
};
