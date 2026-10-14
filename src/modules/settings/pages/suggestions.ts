import { channelMention, roleMentions, row, status } from '../../../ui/components.js';
import { emoji } from '../../../ui/emoji.js';
import { channelPicker, finishPage, pageHeader, rolePicker, save, selectedIds, toggleButton, type SettingsPage } from '../kit.js';

export const suggestionsPage: SettingsPage = {
  id: 'suggestions',
  render(env) {
    const s = env.settings.suggestions;
    const summary = [
      `**Status** · ${status(s.enabled)}`,
      `${emoji('channel')} **Channel** · ${channelMention(s.channelId)}`,
      `${emoji('shield')} **Reviewers** · ${roleMentions(s.reviewerRoleIds)}`,
      `${emoji('privacy')} **Anonymous** · ${status(s.anonymous)}  ·  ${emoji('message')} **Discussion threads** · ${status(s.createThreads)}`,
      `-# Members with Manage Server can always review.`,
    ].join('\n');

    const container = pageHeader(env, 'suggestions', summary)
      .addActionRowComponents(
        row(
          toggleButton('suggestions', 'toggle', 'Module', s.enabled),
          toggleButton('suggestions', 'anon', 'Anonymous', s.anonymous),
          toggleButton('suggestions', 'threads', 'Threads', s.createThreads),
        ),
      )
      .addActionRowComponents(channelPicker(env, 'suggestions', 'channel', { current: s.channelId, placeholder: 'Suggestions channel' }))
      .addActionRowComponents(rolePicker(env, 'suggestions', 'reviewers', { current: s.reviewerRoleIds, placeholder: 'Reviewer roles', max: 10 }));
    return finishPage(container, 'suggestions');
  },

  async handle(ctx, action) {
    const ids = selectedIds(ctx.interaction);
    switch (action) {
      case 'toggle':
        await save(ctx, (d) => void (d.suggestions.enabled = !d.suggestions.enabled));
        break;
      case 'anon':
        await save(ctx, (d) => void (d.suggestions.anonymous = !d.suggestions.anonymous));
        break;
      case 'threads':
        await save(ctx, (d) => void (d.suggestions.createThreads = !d.suggestions.createThreads));
        break;
      case 'channel':
        await save(ctx, (d) => void (d.suggestions.channelId = ids[0] ?? null));
        break;
      case 'reviewers':
        await save(ctx, (d) => void (d.suggestions.reviewerRoleIds = ids));
        break;
      default:
        return 'done';
    }
    return 'render';
  },
};
