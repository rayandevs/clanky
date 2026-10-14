import type { Clanky } from '../client/Clanky.js';
import { getChangelog } from '../config/changelog.js';
import { version } from '../config/version.js';
import { GuildModel, type GuildRecord } from '../database/models/index.js';
import { guilds } from '../services/index.js';
import { parseGuildSettings } from '../settings/schema.js';
import { divider, panel, text, v2, withFooter } from '../ui/components.js';
import { createLogger } from './logger.js';
import { timestamp } from './time.js';

const log = createLogger('updates');

/**
 * After an update, post "What's new" in servers that picked an update
 * notes channel and haven't seen this version yet.
 */
export async function announceUpdate(client: Clanky): Promise<void> {
  const entry = getChangelog(version.raw);
  if (!entry) return;

  const pending = await GuildModel.find({
    active: true,
    'settings.general.updatesChannelId': { $ne: null },
    'meta.lastAnnouncedVersion': { $ne: version.raw },
  }).lean<GuildRecord[]>();

  let sent = 0;
  for (const record of pending) {
    const guild = client.guilds.cache.get(record.guildId);
    const settings = parseGuildSettings(record.settings);
    const channel = guild?.channels.cache.get(settings.general.updatesChannelId ?? '');
    if (!channel?.isSendable()) continue;

    const container = panel({
      title: `Clanky ${version.label}`,
      emoji: 'sparkles',
      description: `**${entry.title}** · ${timestamp(new Date(entry.date), 'D')}`,
      accent: settings.general.accentColor,
      thumbnail: client.user?.displayAvatarURL({ size: 128 }),
    })
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(entry.highlights.map((h) => `• ${h}`).join('\n')));

    try {
      await channel.send(v2(withFooter(container, 'Turn these off in /settings → General')));
      await guilds.setMeta(record.guildId, { lastAnnouncedVersion: version.raw });
      sent++;
    } catch (error) {
      log.warn(`Could not announce in ${record.guildId}`, error);
    }
  }
  if (sent) log.info(`Announced ${version.label} in ${sent} server(s)`);
}
