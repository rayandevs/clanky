import { ButtonStyle, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { formatDuration, parseDuration, timestamp } from '../../core/time.js';
import { guildComponents, guildSlashCommand } from '../../core/types.js';
import { guilds } from '../../services/index.js';
import { button, panel, row, text, v2 } from '../../ui/components.js';
import { reply } from '../../ui/respond.js';
import { activeRaid, endRaidResponse, RaidResponseError, startRaidResponse } from './raidService.js';

export const raidCommand = guildSlashCommand({
  module: 'moderation',
  cooldown: 3,
  data: inServers(new SlashCommandBuilder().setName('raid').setDescription('Temporarily slow selected channels during a raid or spam burst'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('start').setDescription('Preview and start temporary raid response')
      .addStringOption((option) => option.setName('duration').setDescription('How long, from 5m to 24h (default: 30m)').setRequired(false).setMaxLength(20)))
    .addSubcommand((sub) => sub.setName('status').setDescription('Check whether raid response is active'))
    .addSubcommand((sub) => sub.setName('end').setDescription('Restore the original channel slowmodes')),
  execute: async ({ interaction }) => {
    const action = interaction.options.getSubcommand();
    if (action === 'start') {
      const duration = parseDuration(interaction.options.getString('duration') ?? '30m');
      if (!duration || duration < 300_000 || duration > 86_400_000) return reply(interaction, 'error', 'Choose a duration between 5 minutes and 24 hours, such as `30m`.');
      const settings = await guilds.settings(interaction.guildId);
      const channels = settings.moderation.raidChannelIds.map((id) => interaction.guild.channels.cache.get(id)).filter((channel) => channel?.isTextBased());
      if (!channels.length) return reply(interaction, 'warning', 'Select raid-response channels in the dashboard before starting.');
      const current = await activeRaid(interaction.guildId);
      if (current) return reply(interaction, 'warning', `Raid response is already active until ${timestamp(current.expiresAt, 'R')}.`);
      const names = channels.slice(0, 20).map((channel) => `• ${channel}`).join('\n');
      const extra = channels.length > 20 ? `\n…and ${channels.length - 20} more.` : '';
      const card = panel({ title: 'Confirm raid response', emoji: 'shield', description: `Clanky will apply ${settings.moderation.raidSlowmodeSeconds}s slowmode in these ${channels.length} channel${channels.length === 1 ? '' : 's'} for ${formatDuration(duration)}. It will restore each original value when the response ends, without overwriting later staff changes.`, accent: 0xe67e22 })
        .addTextDisplayComponents(text(`${names}${extra}`))
        .addActionRowComponents(row(
          button({ id: cid('raid', 'confirm', Math.floor(duration / 1000), interaction.user.id), label: 'Start response', emoji: 'shield', style: ButtonStyle.Danger }),
          button({ id: cid('raid', 'cancel', interaction.user.id), label: 'Cancel' }),
        ));
      return interaction.reply(v2(card, { ephemeral: true }));
    }
    if (action === 'status') {
      const current = await activeRaid(interaction.guildId);
      return reply(interaction, current ? 'warning' : 'info', current ? `Raid response is active in ${current.channels.length} channels until ${timestamp(current.expiresAt, 'R')}. Use /raid end to restore it now.` : 'No raid response is active.');
    }
    const ended = await endRaidResponse(interaction.guild, interaction.user.id);
    return reply(interaction, ended ? 'success' : 'info', ended ? 'Raid response ended. Original slowmodes were restored where they had not been changed by staff.' : 'No active raid response was found, or restoration needs another retry.');
  },
});

export const raidComponents = guildComponents({
  prefix: 'raid',
  module: 'moderation',
  button: async ({ interaction }, [action, value, actorId]) => {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) return reply(interaction, 'error', 'Only server managers can start or cancel raid response.');
    if (actorId !== interaction.user.id) return reply(interaction, 'error', 'Only the moderator who opened this confirmation can use it.');
    if (action === 'cancel') return interaction.update({ components: [panel({ title: 'Cancelled', emoji: 'done', description: 'Nothing was changed.', accent: 0x4ade80 })] });
    if (action !== 'confirm') return reply(interaction, 'error', 'That response is no longer available.');
    const seconds = Number(value);
    if (!Number.isSafeInteger(seconds) || seconds < 300 || seconds > 86_400) return reply(interaction, 'error', 'That duration is not valid. Start the command again.');
    try {
      const raid = await startRaidResponse(interaction.guild, interaction.user.id, seconds * 1000);
      return interaction.update({ components: [panel({ title: 'Raid response active', emoji: 'shield', description: `Slowmode is active in ${raid.channels.length} channels until ${timestamp(raid.expiresAt, 'R')}. Use /raid end to stop it early.`, accent: 0xe67e22 })] });
    } catch (error) {
      const message = error instanceof RaidResponseError ? error.message : 'Could not start raid response. Check the bot permissions and selected channels.';
      return reply(interaction, 'error', message);
    }
  },
});
