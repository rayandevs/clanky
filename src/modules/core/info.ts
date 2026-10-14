import { ChannelType, ContextMenuCommandBuilder, ApplicationCommandType, SlashCommandBuilder, type GuildMember, type User } from 'discord.js';
import { inServers } from '../../core/builders.js';
import { timestamp } from '../../core/time.js';
import { guildSlashCommand, guildUserMenu } from '../../core/types.js';
import { levels } from '../../services/index.js';
import { divider, panel, text, v2 } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';

async function userView(user: User, member: GuildMember | null, guildId: string, accent: number) {
  const lines = [
    `${emoji('user')} ${user} · \`${user.id}\``,
    `${emoji('calendar')} **Account created** ${timestamp(user.createdAt, 'R')}`,
  ];
  if (member?.joinedAt) lines.push(`${emoji('welcome')} **Joined** ${timestamp(member.joinedAt, 'R')}`);

  const record = await levels.get(guildId, user.id);
  if (record?.xp) lines.push(`${emoji('level')} **Level** ${record.level} · ${record.xp.toLocaleString()} XP`);

  const container = panel({
    title: member?.displayName ?? user.displayName,
    emoji: user.bot ? 'bot' : 'user',
    description: lines.join('\n'),
    accent: member?.displayColor || accent,
    thumbnail: (member ?? user).displayAvatarURL({ size: 256 }),
  });

  if (member) {
    const roles = member.roles.cache
      .filter((r) => r.id !== member.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => `${r}`);
    if (roles.length) {
      const shown = roles.slice(0, 15).join(' ');
      container
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(text(`${emoji('role')} **Roles (${roles.length})**\n${shown}${roles.length > 15 ? ' …' : ''}`));
    }
  }
  return container;
}

export const userInfoCommand = guildSlashCommand({
  module: 'core',
  data: inServers(
    new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('Show info about a member')
      .addUserOption((o) => o.setName('user').setDescription('Who to look up (default: you)')),
  ),
  execute: async ({ interaction, accent, user: record }) => {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.options.getMember('user') ?? (user.id === interaction.user.id ? interaction.member : null);
    const container = await userView(user, member, interaction.guildId, accent);
    await interaction.reply(v2(container, { ephemeral: record.preferences.privateReplies }));
  },
});

export const userInfoMenu = guildUserMenu({
  module: 'core',
  data: inServers(new ContextMenuCommandBuilder().setName('User info').setType(ApplicationCommandType.User)),
  execute: async ({ interaction, accent }) => {
    const container = await userView(interaction.targetUser, interaction.targetMember, interaction.guildId, accent);
    await interaction.reply(v2(container, { ephemeral: true }));
  },
});

export const serverInfoCommand = guildSlashCommand({
  module: 'core',
  data: inServers(new SlashCommandBuilder().setName('serverinfo').setDescription('Show info about this server')),
  execute: async ({ interaction, accent, user }) => {
    const { guild } = interaction;
    const channels = guild.channels.cache;
    const text_ = channels.filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).size;
    const voice = channels.filter((c) => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size;

    const container = panel({
      title: guild.name,
      emoji: 'server',
      description: guild.description ?? undefined,
      accent,
      thumbnail: guild.iconURL({ size: 256 }),
    })
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(
          [
            `${emoji('crown')} **Owner** <@${guild.ownerId}>`,
            `${emoji('calendar')} **Created** ${timestamp(guild.createdAt, 'D')}`,
            `${emoji('members')} **Members** ${guild.memberCount.toLocaleString()}`,
            `${emoji('channel')} **Channels** ${text_} text · ${voice} voice`,
            `${emoji('role')} **Roles** ${guild.roles.cache.size - 1}`,
            `${emoji('rocket')} **Boosts** ${guild.premiumSubscriptionCount ?? 0} (tier ${guild.premiumTier})`,
          ].join('\n'),
        ),
      );
    await interaction.reply(v2(container, { ephemeral: user.preferences.privateReplies }));
  },
});
