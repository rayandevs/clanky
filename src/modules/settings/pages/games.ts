import { status } from '../../../ui/components.js';
import { emoji } from '../../../ui/emoji.js';
import { channelPicker, finishPage, pageHeader, save, selectedIds, toggleButton, type SettingsPage } from '../kit.js';
import { row } from '../../../ui/components.js';

export const gamesPage: SettingsPage = {
  id: 'games',
  render(env) {
    const s = env.settings.games;
    const channels = s.channelIds.length ? s.channelIds.map((id) => `<#${id}>`).join(' ') : '`Everywhere`';
    const summary = [
      `**Status** · ${status(s.enabled)}`,
      `${emoji('channel')} **Where members can play** · ${channels}`,
      `-# Salvage progress is global, so players keep it in every server.`,
    ].join('\n');

    const container = pageHeader(env, 'games', summary)
      .addActionRowComponents(row(toggleButton('games', 'toggle', 'Module', s.enabled)))
      .addActionRowComponents(channelPicker(env, 'games', 'channels', { current: s.channelIds, placeholder: 'Game channels (empty = everywhere)', max: 25 }));
    return finishPage(container, 'games');
  },

  async handle(ctx, action) {
    switch (action) {
      case 'toggle':
        await save(ctx, (d) => void (d.games.enabled = !d.games.enabled));
        break;
      case 'channels':
        await save(ctx, (d) => void (d.games.channelIds = selectedIds(ctx.interaction)));
        break;
    }
    return 'render';
  },
};
