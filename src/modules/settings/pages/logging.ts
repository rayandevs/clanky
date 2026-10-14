import { StringSelectMenuBuilder } from 'discord.js';
import { LOG_EVENTS, type LogEvent } from '../../../settings/schema.js';
import { channelMention, row, status } from '../../../ui/components.js';
import { emoji } from '../../../ui/emoji.js';
import { channelPicker, finishPage, pageHeader, save, selectedIds, sid, toggleButton, type SettingsPage } from '../kit.js';

export const LOG_EVENT_LABELS: Record<LogEvent, string> = {
  messageDelete: 'Deleted messages',
  messageEdit: 'Edited messages',
  memberJoin: 'Members joining',
  memberLeave: 'Members leaving',
  memberRoles: 'Role changes',
  nickname: 'Nickname changes',
};

export const loggingPage: SettingsPage = {
  id: 'logging',
  render(env) {
    const s = env.settings.logging;
    const summary = [
      `**Status** · ${status(s.enabled)}`,
      `${emoji('channel')} **Log channel** · ${channelMention(s.channelId)}`,
      `${emoji('list')} **Logging** · ${s.events.length ? s.events.map((e) => LOG_EVENT_LABELS[e]).join(', ') : '`Nothing`'}`,
      `${emoji('filter')} **Ignored channels** · ${s.ignoredChannelIds.length}`,
    ].join('\n');

    const container = pageHeader(env, 'logging', summary)
      .addActionRowComponents(row(toggleButton('logging', 'toggle', 'Module', s.enabled)))
      .addActionRowComponents(channelPicker(env, 'logging', 'channel', { current: s.channelId, placeholder: 'Log channel' }))
      .addActionRowComponents(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(sid('logging', 'events'))
            .setPlaceholder('What to log')
            .setMinValues(0)
            .setMaxValues(LOG_EVENTS.length)
            .addOptions(LOG_EVENTS.map((e) => ({ label: LOG_EVENT_LABELS[e], value: e, default: s.events.includes(e) }))),
        ),
      )
      .addActionRowComponents(
        channelPicker(env, 'logging', 'ignore', { current: s.ignoredChannelIds, placeholder: 'Channels to ignore', max: 25 }),
      );
    return finishPage(container, 'logging');
  },

  async handle(ctx, action) {
    const ids = selectedIds(ctx.interaction);
    switch (action) {
      case 'toggle':
        await save(ctx, (s) => void (s.logging.enabled = !s.logging.enabled));
        break;
      case 'channel':
        await save(ctx, (s) => void (s.logging.channelId = ids[0] ?? null));
        break;
      case 'events':
        await save(ctx, (s) => void (s.logging.events = ids as LogEvent[]));
        break;
      case 'ignore':
        await save(ctx, (s) => void (s.logging.ignoredChannelIds = ids));
        break;
      default:
        return 'done';
    }
    return 'render';
  },
};
