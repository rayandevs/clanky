import { ButtonStyle, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { guildComponents, guildSlashCommand, type BotModuleDefinition } from '../../core/types.js';
import { levels } from '../../services/index.js';
import { levelFromXp, totalXpFor } from '../../services/LevelService.js';
import { button, divider, notice, panel, progressBar, row, text, v2 } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';
import { reply } from '../../ui/respond.js';
import { applyRewards } from './handler.js';

const MEDALS = ['🥇', '🥈', '🥉'];

async function leaderboardView(guildId: string, guildName: string, page: number, viewerId: string, accent: number) {
  const { entries, pages, total } = await levels.leaderboard(guildId, page);
  const lines = entries.map((m, i) => {
    const place = page * 10 + i + 1;
    const badge = MEDALS[place - 1] ?? `\`#${place}\``;
    return `${badge} <@${m.userId}> · Level **${m.level}** · ${m.xp.toLocaleString()} XP`;
  });
  const container = panel({
    title: `${guildName} Leaderboard`,
    emoji: 'trophy',
    description: total ? `${total.toLocaleString()} members ranked` : 'Nobody has XP yet. Start chatting! 💬',
    accent,
  });
  if (lines.length) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(lines.join('\n')));
  if (pages > 1) {
    container.addActionRowComponents(
      row(
        button({ id: cid('lb', 0, viewerId, 'f'), emoji: 'first', disabled: page === 0 }),
        button({ id: cid('lb', page - 1, viewerId, 'p'), emoji: 'prev', disabled: page === 0 }),
        button({ id: cid('lb', 'x', viewerId, 'x'), label: `${page + 1} / ${pages}`, disabled: true }),
        button({ id: cid('lb', page + 1, viewerId, 'n'), emoji: 'next', disabled: page >= pages - 1 }),
        button({ id: cid('lb', pages - 1, viewerId, 'l'), emoji: 'last', disabled: page >= pages - 1 }),
      ),
    );
  }
  return container;
}

const rankCommand = guildSlashCommand({
  module: 'leveling',
  data: inServers(
    new SlashCommandBuilder()
      .setName('rank')
      .setDescription('See your level and XP')
      .addUserOption((o) => o.setName('user').setDescription('Someone else (optional)')),
  ),
  execute: async ({ interaction, user: viewer, accent }) => {
    const user = interaction.options.getUser('user') ?? interaction.user;
    if (user.bot) return reply(interaction, 'info', "Bots don't earn XP.");
    const record = await levels.get(interaction.guildId, user.id);
    const xp = record?.xp ?? 0;
    const progress = levelFromXp(xp);
    const position = xp ? await levels.rank(interaction.guildId, xp) : null;

    const container = panel({
      title: user.displayName,
      emoji: 'level',
      description: [
        `**Level ${progress.level}**${position ? ` · Rank **#${position}**` : ''}`,
        `${progressBar(progress.current, progress.needed)} ${progress.current.toLocaleString()} / ${progress.needed.toLocaleString()} XP`,
        `-# ${emoji('message')} ${(record?.messages ?? 0).toLocaleString()} messages · ${xp.toLocaleString()} total XP`,
      ].join('\n'),
      accent,
      thumbnail: user.displayAvatarURL({ size: 256 }),
    });
    await interaction.reply(v2(container, { ephemeral: viewer.preferences.privateReplies }));
  },
});

const leaderboardCommand = guildSlashCommand({
  module: 'leveling',
  cooldown: 5,
  data: inServers(new SlashCommandBuilder().setName('leaderboard').setDescription('Top members by XP')),
  execute: async ({ interaction, accent, user }) => {
    const view = await leaderboardView(interaction.guildId, interaction.guild.name, 0, interaction.user.id, accent);
    await interaction.reply(v2(view, { ephemeral: user.preferences.privateReplies }));
  },
});

const leaderboardComponents = guildComponents({
  prefix: 'lb',
  module: 'leveling',
  button: async ({ interaction, accent }, [page, ownerId]) => {
    if (interaction.user.id !== ownerId) return reply(interaction, 'info', 'Use `/leaderboard` to get your own copy.');
    const view = await leaderboardView(interaction.guildId, interaction.guild.name, Math.max(0, Number(page) || 0), ownerId, accent);
    await interaction.update({ components: [view] });
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
