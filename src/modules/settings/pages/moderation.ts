import { channelMention, row, status } from '../../../ui/components.js';
import { formatDuration } from '../../../core/time.js';
import { emoji } from '../../../ui/emoji.js';
import { channelPicker, finishPage, pageHeader, save, selectedIds, toggleButton, type SettingsPage } from '../kit.js';

export const moderationPage: SettingsPage = {
  id: 'moderation',
  render(env) {
    const s = env.settings.moderation;
    const summary = [
      `**Status** · ${status(s.enabled)}`,
      `${emoji('case')} **Mod log** · ${channelMention(s.logChannelId)}`,
      `${emoji('report')} **Reports** · ${channelMention(s.reportsChannelId)}`,
      `${emoji('dm')} **DM members** · ${status(s.dmOnAction)}`,
      `${emoji('edit')} **Reason required** · ${status(s.requireReason)}`,
      `${emoji('warn')} **Warning window** · ${s.warningWindowDays} days${s.warningEscalations.length ? ` · ${s.warningEscalations.map((tier) => `${tier.warnings} warnings → ${formatDuration(tier.durationSeconds * 1000)} timeout`).join(' · ')}` : ' · no automatic escalation'}`,
      `${emoji('shield')} **Raid response** · ${s.raidChannelIds.length} selected channels · ${s.raidSlowmodeSeconds}s slowmode · start with /raid start`,
      `${emoji('clock')} **Report and appeal retention** · ${s.reviewRetentionDays} days`,
    ].join('\n');

    const container = pageHeader(env, 'moderation', summary)
      .addActionRowComponents(
        row(
          toggleButton('moderation', 'toggle', 'Module', s.enabled),
          toggleButton('moderation', 'dm', 'DM members', s.dmOnAction),
          toggleButton('moderation', 'reason', 'Reason required', s.requireReason),
        ),
      )
      .addActionRowComponents(channelPicker(env, 'moderation', 'log', { current: s.logChannelId, placeholder: 'Mod log channel' }))
      .addActionRowComponents(channelPicker(env, 'moderation', 'reports', { current: s.reportsChannelId, placeholder: 'Reports channel (for "Report message")' }));
    return finishPage(container, 'moderation');
  },

  async handle(ctx, action) {
    const pick = selectedIds(ctx.interaction)[0] ?? null;
    switch (action) {
      case 'toggle':
        await save(ctx, (s) => void (s.moderation.enabled = !s.moderation.enabled));
        break;
      case 'dm':
        await save(ctx, (s) => void (s.moderation.dmOnAction = !s.moderation.dmOnAction));
        break;
      case 'reason':
        await save(ctx, (s) => void (s.moderation.requireReason = !s.moderation.requireReason));
        break;
      case 'log':
        await save(ctx, (s) => void (s.moderation.logChannelId = pick));
        break;
      case 'reports':
        await save(ctx, (s) => void (s.moderation.reportsChannelId = pick));
        break;
      default:
        return 'done';
    }
    return 'render';
  },
};
