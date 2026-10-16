import {
  LabelBuilder,
  ModalBuilder,
  RadioGroupBuilder,
  RadioGroupOptionBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type GuildMember,
} from 'discord.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { guildComponents, guildSlashCommand, type BotModuleDefinition } from '../../core/types.js';
import { SuggestionModel, type SuggestionRecord, type SuggestionStatus } from '../../database/models/index.js';
import { guilds } from '../../services/index.js';
import { reply } from '../../ui/respond.js';
import { SUGGESTION_STATUSES, getSubmissionBlockReason, isSuggestionReviewer, publishSuggestion, renderSuggestion, reviewSuggestion, voteSuggestion } from './service.js';

const STATUS_KEYS = Object.keys(SUGGESTION_STATUSES) as SuggestionStatus[];

const suggestCommand = guildSlashCommand({
  module: 'suggestions',
  cooldown: 0,
  data: inServers(
    new SlashCommandBuilder()
      .setName('suggest')
      .setDescription('Share an idea with the server')
      .addBooleanOption((option) => option.setName('anonymous').setDescription('Hide your name if this server allows anonymous suggestions')),
  ),
  execute: async ({ interaction, guild }) => {
    const settings = guild.settings.suggestions;
    if (!settings.channelId) return reply(interaction, 'warning', "Suggestions aren't set up here yet.");
    const wantsAnonymous = interaction.options.getBoolean('anonymous') ?? false;
    if (wantsAnonymous && !settings.anonymous && !settings.allowAnonymousChoice) {
      return reply(interaction, 'warning', 'Anonymous suggestions are not available in this server.');
    }
    const blocked = await getSubmissionBlockReason(interaction.guildId, interaction.user.id, settings);
    if (blocked) return reply(interaction, 'info', blocked);

    const categoryLabel = settings.categories.length ? `Category · ${settings.categories.join(' / ')}` : null;
    const modal = new ModalBuilder()
      .setCustomId(cid('sg', 'create', settings.anonymous || wantsAnonymous))
      .setTitle('New suggestion')
      .addLabelComponents(
        new LabelBuilder().setLabel('Your idea in a few words').setTextInputComponent(new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setMaxLength(100)),
        new LabelBuilder().setLabel('Tell us more').setDescription('Why would it help?').setTextInputComponent(new TextInputBuilder().setCustomId('content').setStyle(TextInputStyle.Paragraph).setMinLength(10).setMaxLength(1500)),
      );
    if (categoryLabel) {
      modal.addLabelComponents(
        new LabelBuilder().setLabel('Category (optional)').setDescription(settings.categories.join(' · ').slice(0, 100)).setTextInputComponent(new TextInputBuilder().setCustomId('category').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(40)),
      );
    }
    await interaction.showModal(modal);
  },
});

const suggestionComponents = guildComponents({
  prefix: 'sg',
  module: 'suggestions',
  modal: async ({ interaction, client, guild }, [action, rawId]) => {
    const settings = guild.settings;

    if (action === 'create') {
      const channelId = settings.suggestions.channelId;
      const channel = channelId ? interaction.guild.channels.cache.get(channelId) : null;
      if (!channel?.isSendable() || !channel.isTextBased()) return reply(interaction, 'error', "I can't post in the suggestions channel.");
      const blocked = await getSubmissionBlockReason(interaction.guildId, interaction.user.id, settings.suggestions);
      if (blocked) return reply(interaction, 'info', blocked);
      const title = interaction.fields.getTextInputValue('title').trim();
      const content = interaction.fields.getTextInputValue('content').trim();
      if (!title) return reply(interaction, 'warning', 'Please add a short title for your suggestion.');
      if (content.length < 10) return reply(interaction, 'warning', 'Please add at least 10 non-space characters describing your idea.');
      const rawCategory = settings.suggestions.categories.length ? interaction.fields.getTextInputValue('category').trim() : '';
      const category = rawCategory
        ? settings.suggestions.categories.find((item) => item.toLocaleLowerCase() === rawCategory.toLocaleLowerCase()) ?? null
        : null;
      if (rawCategory && !category) return reply(interaction, 'warning', `Choose one of these categories: ${settings.suggestions.categories.join(', ')}.`);
      const suggestionId = await guilds.nextCounter(interaction.guildId, 'suggestions');
      await SuggestionModel.create({
        guildId: interaction.guildId,
        suggestionId,
        authorId: interaction.user.id,
        title,
        content,
        category,
        anonymous: rawId === 'true',
        channelId: channel.id,
        postStatus: 'queued',
      });
      try {
        await publishSuggestion(client, interaction.guildId, suggestionId);
        return reply(interaction, 'success', `Your suggestion **#${suggestionId}** was posted in ${channel}. 💡`);
      } catch {
        return reply(interaction, 'warning', `Your suggestion **#${suggestionId}** was saved, but Discord couldn't post it. A server reviewer can retry it from the dashboard.`);
      }
    }

    if (action === 'review') {
      if (!isSuggestionReviewer(interaction.member, settings)) return reply(interaction, 'error', 'Only configured reviewers can do this.');
      const status = interaction.fields.getRadioGroup('status', true) as SuggestionStatus;
      const note = interaction.fields.getTextInputValue('note').trim() || null;
      try {
        const result = await reviewSuggestion(client, interaction.guildId, Number(rawId), interaction.user.id, status, note, settings);
        if (interaction.isFromMessage()) await interaction.update({ components: [renderSuggestion(result.record, settings)] });
        else await reply(interaction, 'success', 'Suggestion review saved.');
      } catch (error) {
        return reply(interaction, 'error', error instanceof Error ? error.message : 'Could not save that review.');
      }
    }
  },

  button: async ({ interaction, guild }, [action, id]) => {
    const settings = guild.settings;
    const suggestionId = Number(id);

    if (action === 'review') {
      if (!isSuggestionReviewer(interaction.member as GuildMember, settings)) return reply(interaction, 'error', 'Only configured reviewers can do this.');
      const current = await SuggestionModel.findOne({ guildId: interaction.guildId, suggestionId }).lean<SuggestionRecord>();
      if (!current) return reply(interaction, 'error', 'That suggestion was deleted.');
      if (current.postStatus === 'failed' || current.postStatus === 'queued') return reply(interaction, 'warning', 'Recover the Discord post from the dashboard before reviewing it.');
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId(cid('sg', 'review', suggestionId))
          .setTitle(`Review suggestion #${suggestionId}`)
          .addLabelComponents(
            new LabelBuilder().setLabel('Decision').setRadioGroupComponent(
              new RadioGroupBuilder().setCustomId('status').setRequired(true).setOptions(
                STATUS_KEYS.map((key) => new RadioGroupOptionBuilder().setValue(key).setLabel(SUGGESTION_STATUSES[key].label)),
              ),
            ),
            new LabelBuilder().setLabel('Note').setDescription('Optional. Shown on the suggestion and sent to its author.').setTextInputComponent(new TextInputBuilder().setCustomId('note').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
          ),
      );
    }

    if (action !== 'up' && action !== 'down') return;
    try {
      const updated = await voteSuggestion(interaction.guildId, suggestionId, interaction.user.id, action);
      await interaction.update({ components: [renderSuggestion(updated, settings)] });
    } catch (error) {
      return reply(interaction, 'info', error instanceof Error ? error.message : 'Voting is closed.');
    }
  },
});

export const suggestionsModule: BotModuleDefinition = {
  commands: [suggestCommand],
  components: [suggestionComponents],
};
