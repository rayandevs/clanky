import { MODULES } from '../../../settings/registry.js';
import { status } from '../../../ui/components.js';
import { emoji } from '../../../ui/emoji.js';
import { finishPage, pageHeader, type SettingsPage } from '../kit.js';

export const homePage: SettingsPage = {
  id: 'home',
  render(env) {
    const lines = MODULES.filter((m) => m.toggleable).map((m) => {
      const on = (env.settings[m.id] as { enabled?: boolean }).enabled !== false;
      return `${emoji(m.emoji)} **${m.name}** · ${status(on)}`;
    });
    const summary = [
      `Set up Clanky for **${env.guild.name}**. Pick a module below to change it.`,
      '',
      ...lines,
      '',
      `-# Turn modules on or off in **General**. Control who can use commands in Server Settings → Integrations.`,
    ].join('\n');
    return finishPage(pageHeader(env, 'home', summary), 'home');
  },
};
