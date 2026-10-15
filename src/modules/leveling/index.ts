import { AttachmentBuilder, ButtonStyle, ContainerBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type Guild } from 'discord.js';
import { renderLeaderboard } from '../../render/leaderboard.js';
import { renderRankCard } from '../../render/rankCard.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { guildComponents, guildSlashCommand, type BotModuleDefinition } from '../../core/types.js';
import { levels } from '../../services/index.js';
import { levelFromXp, totalXpFor } from '../../services/LevelService.js';
import { button, notice, panel, row, text, v2 } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';
import { reply } from '../../ui/respond.js';
import { applyRewards } from './handler.js';

const PER_PAGE = 10;

/** Builds the leaderboard image + page buttons for a page. */
async function leaderboardView(guild: Guild, page: number, viewerId: string, accent: number) {
  const { entries, pages, total } = await levels.leaderboard(guild.id, page, PER_PAGE);
  if (!total) {
    return { components: [panel({ title: `${guild.name} Leaderboard`, emoji: 'trophy', description: 'Nobody has XP yet. Start chatting! 💬', accent })], files: [] };
  }
  const safePage = Math.min(page, pages - 1);

  const ids = entries.map((e) => e.userId);
  const members = await guild.members.fetch({ user: ids }).catch(() => null);
  const rows = await Promise.all(
    entries.map(async (entry, i) => {
      const member = members?.get(entry.userId);
      const user = member?.user ?? (await guild.client.users.fetch(entry.userId).catch(() => null));
      const progress = levelFromXp(entry.xp);
      return {
        place: safePage * PER_PAGE + i + 1,
        name: member?.displayName ?? user?.displayName ?? 'Unknown user',
        avatarUrl: (member ?? user)?.displayAvatarURL({ extension: 'png', size: 128 }) ?? null,
        level: progress.level,
        xp: entry.xp,
        progress: progress.current / progress.needed,
        isViewer: entry.userId === viewerId,
      };
    }),
  );

  const viewer = await levels.get(guild.id, viewerId);
  const viewerRank = viewer?.xp ? await levels.rank(guild.id, viewer.xp) : null;

  const image = await renderLeaderboard({
    serverName: guild.name,
    serverIconUrl: guild.iconURL({ extension: 'png', size: 128 }),
    page: safePage,
    pages,
    rows,
    viewerRank,
    accent,
  });

  const container = new ContainerBuilder()
    .setAccentColor(accent)
    .addMediaGalleryComponents((g) => g.addItems((item) => item.setURL('attachment://leaderboard.png').setDescription(`${guild.name} leaderboard, page ${safePage + 1}`)));

  if (pages > 1) {
    container.addActionRowComponents(
      row(
        button({ id: cid('lb', 0, viewerId, 'f'), emoji: 'first', disabled: safePage === 0 }),
        button({ id: cid('lb', safePage - 1, viewerId, 'p'), emoji: 'prev', disabled: safePage === 0 }),
        button({ id: cid('lb', 'x', viewerId, 'x'), label: `${safePage + 1} / ${pages}`, disabled: true }),
        button({ id: cid('lb', safePage + 1, viewerId, 'n'), emoji: 'next', disabled: safePage >= pages - 1 }),
        button({ id: cid('lb', pages - 1, viewerId, 'l'), emoji: 'last', disabled: safePage >= pages - 1 }),
      ),
    );
  }
  if (viewerRank) {
    const myPage = Math.floor((viewerRank - 1) / PER_PAGE);
    container.addActionRowComponents(
      row(button({ id: cid('lb', myPage, viewerId, 'me'), label: 'Find me', emoji: 'user', style: ButtonStyle.Primary, disabled: myPage === safePage })),
    );
  }
  return { components: [container], files: [new AttachmentBuilder(image, { name: 'leaderboard.png' })] };
}

const rankCommand = guildSlashCommand({
  module: 'leveling',
  cooldown: 3,
  data: inServers(
    new SlashCommandBuilder()
      .setName('rank')
      .setDescription('See your rank card')
      .addUserOption((o) => o.setName('user').setDescription('Someone else (optional)')),
  ),
  execute: async ({ interaction, user: viewer, accent }) => {
    const user = interaction.options.getUser('user') ?? interaction.user;
    if (user.bot) return reply(interaction, 'info', "Bots don't earn XP.");
    await interaction.deferReply(viewer.preferences.privateReplies ? { flags: MessageFlags.Ephemeral } : {});

    const member = interaction.options.getMember('user') ?? (user.id === interaction.user.id ? interaction.member : null);
    const record = await levels.get(interaction.guildId, user.id);
    const xp = record?.xp ?? 0;
    const progress = levelFromXp(xp);
    const rank = xp ? await levels.rank(interaction.guildId, xp) : null;

    const image = await renderRankCard({
      displayName: member?.displayName ?? user.displayName,
      username: user.username,
      avatarUrl: (member ?? user).displayAvatarURL({ extension: 'png', size: 256 }),
      rank,
      level: progress.level,
      currentXp: progress.current,
      neededXp: progress.needed,
      accent,
    });

    const container = new ContainerBuilder()
      .setAccentColor(accent)
      .addMediaGalleryComponents((g) => g.addItems((item) => item.setURL('attachment://rank.png').setDescription(`${user.username}'s rank card`)))
      .addTextDisplayComponents(text(`-# ${emoji('message')} ${(record?.messages ?? 0).toLocaleString()} messages · ${xp.toLocaleString()} total XP`));

    await interaction.editReply({ components: [container], files: [new AttachmentBuilder(image, { name: 'rank.png' })], flags: MessageFlags.IsComponentsV2 });
  },
});

const leaderboardCommand = guildSlashCommand({
  module: 'leveling',
  cooldown: 5,
  data: inServers(new SlashCommandBuilder().setName('leaderboard').setDescription('Top members by XP')),
  execute: async ({ interaction, accent, user }) => {
    await interaction.deferReply(user.preferences.privateReplies ? { flags: MessageFlags.Ephemeral } : {});
    const view = await leaderboardView(interaction.guild, 0, interaction.user.id, accent);
    await interaction.editReply({ ...view, flags: MessageFlags.IsComponentsV2 });
  },
});

const leaderboardComponents = guildComponents({
  prefix: 'lb',
  module: 'leveling',
  button: async ({ interaction, accent }, [page, ownerId]) => {
    if (interaction.user.id !== ownerId) return reply(interaction, 'info', 'Use `/leaderboard` to get your own copy.');
    // Rendering takes a moment, so acknowledge first.
    await interaction.deferUpdate();
    const view = await leaderboardView(interaction.guild, Math.max(0, Number(page) || 0), ownerId, accent);
    // `attachments: []` drops the old image so only the new page is shown.
    await interaction.editReply({ ...view, attachments: [] });
  },
});

const xpCommand = guildSlashCommand({
  module: 'leveling',
  data: inServers(new SlashCommandBuilder().setName('xp').setDescription('Manage member XP'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('give')
        .setDescription('Give XP to a member')
        .addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('How much').setRequired(true).setMinValue(1).setMaxValue(1_000_000)),
    )
    .addSubcommand((s) =>
      s
        .setName('take')
        .setDescription('Take XP from a member')
        .addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('How much').setRequired(true).setMinValue(1).setMaxValue(1_000_000)),
    )
    .addSubcommand((s) =>
      s
        .setName('set-level')
        .setDescription("Set a member's level")
        .addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true))
        .addIntegerOption((o) => o.setName('level').setDescription('New level').setRequired(true).setMinValue(0).setMaxValue(500)),
    )
    .addSubcommand((s) => s.setName('reset-all').setDescription('Reset XP for everyone in this server')),
  execute: async ({ interaction, guild }) => {
    const sub = interaction.options.getSubcommand();
    if (sub === 'reset-all') {
      const confirm = notice('warning', "This sets **everyone's** XP and level to 0. It can't be undone.", 'Reset all XP?').addActionRowComponents(
        row(
          button({ id: cid('xpreset', 'yes'), label: 'Yes, reset', emoji: 'delete', style: ButtonStyle.Danger }),
          button({ id: cid('xpreset', 'no'), label: 'Cancel', emoji: 'back' }),
        ),
      );
      return interaction.reply(v2(confirm, { ephemeral: true }));
    }

    const user = interaction.options.getUser('user', true);
    if (user.bot) return reply(interaction, 'info', "Bots don't earn XP.");
    const amount = interaction.options.getInteger('amount') ?? 0;
    const change =
      sub === 'give' ? { add: amount } : sub === 'take' ? { add: -amount } : { set: totalXpFor(interaction.options.getInteger('level', true)) };
    const record = await levels.adjust(interaction.guildId, user.id, change);

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member) await applyRewards(member, record.level, guild.settings);
    return reply(interaction, 'success', `${user} is now level **${record.level}** with **${record.xp.toLocaleString()}** XP.`);
  },
});

const xpResetComponents = guildComponents({
  prefix: 'xpreset',
  module: 'leveling',
  button: async ({ interaction }, [answer]) => {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) return reply(interaction, 'error', 'You need **Manage Server**.');
    if (answer !== 'yes') return interaction.update({ components: [notice('info', 'Cancelled. Nothing changed.')] });
    const count = await levels.reset(interaction.guildId);
    return interaction.update({ components: [notice('success', `Reset XP for **${count}** members.`)] });
  },
});

export const levelingModule: BotModuleDefinition = {
  commands: [rankCommand, leaderboardCommand, xpCommand],
  components: [leaderboardComponents, xpResetComponents],
};
