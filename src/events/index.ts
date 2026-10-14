import { ActivityType, ApplicationCommandType, Events, type Guild } from 'discord.js';
import type { Clanky } from '../client/Clanky.js';
import { env } from '../config/env.js';
import { version } from '../config/version.js';
import { announceUpdate } from '../core/announcements.js';
import { createLogger } from '../core/logger.js';
import { routeInteraction } from '../core/router.js';
import { watchAutomodToggle } from '../modules/automod/service.js';
import { handleLevelingMessage } from '../modules/leveling/handler.js';
import { logMemberJoin, logMemberLeave, logMemberUpdate, logMessageDelete, logMessageEdit } from '../modules/logging/index.js';
import { startReminderScheduler } from '../modules/reminders/index.js';
import { handleMemberJoin, handleMemberLeave, handleMemberScreeningPassed } from '../modules/welcome/index.js';
import { guilds } from '../services/index.js';
import { panel, v2, withFooter } from '../ui/components.js';

const log = createLogger('events');

/** Runs an event handler and logs errors instead of crashing. */
function safe<A extends unknown[]>(name: string, handler: (...args: A) => Promise<unknown>) {
  return (...args: A) => {
    handler(...args).catch((error) => log.error(`${name} handler failed`, error));
  };
}

async function loadCommandIds(client: Clanky): Promise<void> {
  const commands = env.DEV_GUILD_ID
    ? await client.guilds.cache.get(env.DEV_GUILD_ID)?.commands.fetch()
    : await client.application?.commands.fetch();
  commands?.forEach((c) => {
    if (c.type === ApplicationCommandType.ChatInput) client.commandIds.set(c.name, c.id);
  });
}

async function sendOnboarding(client: Clanky, guild: Guild): Promise<void> {
  const channel =
    guild.systemChannel ??
    guild.channels.cache.find((c) => c.isTextBased() && c.isSendable() && c.permissionsFor(guild.members.me!)?.has('SendMessages'));
  if (!channel?.isSendable()) return;
  const container = panel({
    title: 'Thanks for adding Clanky!',
    emoji: 'welcome',
    description: [
      "I help with moderation, tickets, welcome messages, roles, leveling and more.",
      '',
      `**1.** Run ${client.cmd('settings')} to turn on what you need.`,
      `**2.** Check ${client.cmd('help')} to see every command.`,
    ].join('\n'),
    thumbnail: client.user?.displayAvatarURL({ size: 128 }),
  });
  await channel.send(v2(withFooter(container, `${version.label} · Only admins see the settings`))).catch(() => null);
}

export function registerEvents(client: Clanky): void {
  client.once(
    Events.ClientReady,
    safe('ready', async (ready) => {
      log.info(`Logged in as ${ready.user.tag} · ${version.label} · ${ready.guilds.cache.size} servers`);
      ready.user.setPresence({ activities: [{ name: `/help · ${version.short}`, type: ActivityType.Custom, state: `/help · ${version.label}` }] });

      await loadCommandIds(client).catch((e) => log.warn('Could not load command IDs', e));
      for (const guild of ready.guilds.cache.values()) await guilds.sync(guild).catch(() => null);

      guilds.watchExternalChanges();
      watchAutomodToggle(client);
      startReminderScheduler(client);
      await announceUpdate(client);
    }),
  );

  client.on(Events.InteractionCreate, safe('interaction', (interaction) => routeInteraction(client, interaction)));

  client.on(
    Events.GuildCreate,
    safe('guildCreate', async (guild) => {
      log.info(`Joined ${guild.name} (${guild.id})`);
      await guilds.sync(guild);
      await sendOnboarding(client, guild);
    }),
  );
  client.on(Events.GuildDelete, safe('guildDelete', (guild) => guilds.markLeft(guild.id)));
  client.on(Events.GuildUpdate, safe('guildUpdate', (_, guild) => guilds.sync(guild)));

  client.on(
    Events.MessageCreate,
    safe('messageCreate', async (message) => {
      // Clanky has no prefix commands. Messages are only used for XP.
      if (!message.inGuild() || message.author.bot || message.system || message.webhookId) return;
      await handleLevelingMessage(message);
    }),
  );
  client.on(Events.MessageDelete, safe('messageDelete', logMessageDelete));
  client.on(Events.MessageUpdate, safe('messageUpdate', logMessageEdit));

  client.on(
    Events.GuildMemberAdd,
    safe('memberAdd', async (member) => {
      await Promise.all([handleMemberJoin(member), logMemberJoin(member)]);
    }),
  );
  client.on(
    Events.GuildMemberRemove,
    safe('memberRemove', async (member) => {
      await Promise.all([handleMemberLeave(member), logMemberLeave(member)]);
    }),
  );
  client.on(
    Events.GuildMemberUpdate,
    safe('memberUpdate', async (before, after) => {
      await Promise.all([handleMemberScreeningPassed(before, after), logMemberUpdate(before, after)]);
    }),
  );

  client.on(Events.Error, (error) => log.error('Client error', error));
  client.on(Events.Warn, (message) => log.warn(message));
}
