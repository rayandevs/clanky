import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { channelMention, roleMentions, row, status } from '../../../ui/components.js';
import { emoji } from '../../../ui/emoji.js';
import { actionButton, channelPicker, finishPage, pageHeader, rolePicker, save, selectedIds, toggleButton, type SettingsPage } from '../kit.js';

export const suggestionsPage: SettingsPage = {
  id: 'suggestions',
  render(env) {
    const s = env.settings.suggestions;
    const summary = [
      `**Status** · ${status(s.enabled)}`,
      `${emoji('channel')} **Channel** · ${channelMention(s.channelId)}`,
      `${emoji('shield')} **Reviewers** · ${roleMentions(s.reviewerRoleIds)}`,
      `${emoji('privacy')} **Anonymous for everyone** · ${status(s.anonymous)}  ·  **Submitter choice** · ${status(s.allowAnonymousChoice)}`,
      `**Open limit** · ${s.maxOpenPerUser || 'Off'} per member  ·  **Cooldown** · ${s.cooldownSeconds ? `${s.cooldownSeconds}s` : 'Off'}`,
      `**Categories** · ${s.categories.length ? s.categories.join(', ') : 'None'}  ·  **Digest** · ${s.digestIntervalHours ? `${s.digestIntervalHours}h` : 'Off'}`,
      `-# Members with Manage Server can always review. The first enabled digest runs as soon as pending suggestions exist.`,
    ].join('\n');

    const container = pageHeader(env, 'suggestions', summary)
      .addActionRowComponents(
        row(
          toggleButton('suggestions', 'toggle', 'Module', s.enabled),
          toggleButton('suggestions', 'anon', 'Always anonymous', s.anonymous),
          toggleButton('suggestions', 'anonChoice', 'Anonymous choice', s.allowAnonymousChoice),
          toggleButton('suggestions', 'threads', 'Threads', s.createThreads),
          actionButton('suggestions', 'limits', 'Configure', 'settings'),
        ),
      )
      .addActionRowComponents(channelPicker(env, 'suggestions', 'channel', { current: s.channelId, placeholder: 'Suggestions channel' }))
      .addActionRowComponents(channelPicker(env, 'suggestions', 'digestChannel', { current: s.digestChannelId, placeholder: 'Digest channel (optional)' }))
      .addActionRowComponents(rolePicker(env, 'suggestions', 'reviewers', { current: s.reviewerRoleIds, placeholder: 'Reviewer roles', max: 10 }));
    return finishPage(container, 'suggestions');
  },

  async handle(ctx, action) {
    const ids = selectedIds(ctx.interaction);
    const settings = ctx.guild.settings.suggestions;
    switch (action) {
      case 'toggle':
        await save(ctx, (d) => void (d.suggestions.enabled = !d.suggestions.enabled));
        break;
      case 'anon':
        await save(ctx, (d) => void (d.suggestions.anonymous = !d.suggestions.anonymous));
        break;
      case 'anonChoice':
        await save(ctx, (d) => void (d.suggestions.allowAnonymousChoice = !d.suggestions.allowAnonymousChoice));
        break;
      case 'threads':
        await save(ctx, (d) => void (d.suggestions.createThreads = !d.suggestions.createThreads));
        break;
      case 'channel':
        await save(ctx, (d) => void (d.suggestions.channelId = ids[0] ?? null));
        break;
      case 'digestChannel':
        await save(ctx, (d) => void (d.suggestions.digestChannelId = ids[0] ?? null));
        break;
      case 'reviewers':
        await save(ctx, (d) => void (d.suggestions.reviewerRoleIds = ids));
        break;
      case 'limits':
        if (ctx.interaction.isButton()) {
          await ctx.interaction.showModal(
            new ModalBuilder()
              .setCustomId('set:suggestions:limits')
              .setTitle('Suggestion categories & limits')
              .addLabelComponents(
                new LabelBuilder().setLabel('Categories · one per line').setDescription('Optional · up to 10 categories').setTextInputComponent(new TextInputBuilder().setCustomId('categories').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500).setValue(settings.categories.join('\n'))),
                new LabelBuilder().setLabel('Open suggestions per member · 0 off').setTextInputComponent(new TextInputBuilder().setCustomId('maxOpen').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2).setValue(String(settings.maxOpenPerUser))),
                new LabelBuilder().setLabel('Cooldown in seconds · 0 off').setTextInputComponent(new TextInputBuilder().setCustomId('cooldown').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6).setValue(String(settings.cooldownSeconds))),
                new LabelBuilder().setLabel('Digest interval · 0 off, 24 daily, 168 weekly').setTextInputComponent(new TextInputBuilder().setCustomId('digest').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3).setValue(String(settings.digestIntervalHours))),
              ),
          );
          return 'done';
        }
        if (!ctx.interaction.isModalSubmit()) return 'done';
        {
          const categories = ctx.interaction.fields.getTextInputValue('categories').split('\n').map((item) => item.trim()).filter(Boolean);
          const maxOpenPerUser = Number(ctx.interaction.fields.getTextInputValue('maxOpen').trim());
          const cooldownSeconds = Number(ctx.interaction.fields.getTextInputValue('cooldown').trim());
          const digestIntervalHours = Number(ctx.interaction.fields.getTextInputValue('digest').trim());
          if (categories.length > 10 || categories.some((item) => item.length > 40)) return { warn: 'Use up to 10 category names, each 40 characters or fewer.' };
          if (new Set(categories.map((item) => item.toLocaleLowerCase())).size !== categories.length) return { warn: 'Category names must be unique.' };
          if (!Number.isInteger(maxOpenPerUser) || maxOpenPerUser < 0 || maxOpenPerUser > 20) return { warn: 'Open limit must be between 0 and 20.' };
          if (!Number.isInteger(cooldownSeconds) || cooldownSeconds < 0 || cooldownSeconds > 604800) return { warn: 'Cooldown must be between 0 and 604800 seconds.' };
          if (![0, 24, 168].includes(digestIntervalHours)) return { warn: 'Digest interval must be 0, 24, or 168 hours.' };
          await save(ctx, (d) => {
            d.suggestions.categories = categories;
            d.suggestions.maxOpenPerUser = maxOpenPerUser;
            d.suggestions.cooldownSeconds = cooldownSeconds;
            d.suggestions.digestIntervalHours = digestIntervalHours as 0 | 24 | 168;
          });
        }
        break;
      default:
        return 'done';
    }
    return 'render';
  },
};
