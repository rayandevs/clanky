import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember, type SlashCommandStringOption } from 'discord.js';
import { inServers } from '../../core/builders.js';
import { moderationBlocker } from '../../core/permissions.js';
import { parseDuration } from '../../core/time.js';
import { guildSlashCommand, type GuildContext } from '../../core/types.js';
import type { CaseType } from '../../database/models/index.js';
import { cases } from '../../services/index.js';
import { notice, v2 } from '../../ui/components.js';
import { reply, respond } from '../../ui/respond.js';
import { actionDone, logCase, notifyMember } from './shared.js';

type Ctx = GuildContext<ChatInputCommandInteraction<'cached'>>;

const MAX_TIMEOUT = 28 * 86_400_000;

/** Reads the reason option and enforces "reason required". */
async function getReason(ctx: Ctx): Promise<string | null | false> {
  const reason = ctx.interaction.options.getString('reason')?.trim() || null;
  if (!reason && ctx.guild.settings.moderation.requireReason) {
    await reply(ctx.interaction, 'warning', 'This server requires a reason for moderation actions.');
    return false;
  }
  return reason;
}

async function getTarget(ctx: Ctx): Promise<GuildMember | null> {
  const { interaction } = ctx;
  const member = interaction.options.getMember('user');
  if (!member) {
    await reply(interaction, 'error', "That user isn't in this server.");
    return null;
  }
  const blocker = moderationBlocker(interaction.member, member, interaction.guild.members.me!);
  if (blocker) {
    await reply(interaction, 'error', blocker);
    return null;
  }
  return member;
}

async function record(ctx: Ctx, type: CaseType, target: { id: string; tag: string }, reason: string | null, duration?: number | null) {
  const created = await cases.create({
    guildId: ctx.interaction.guildId,
    type,
    targetId: target.id,
    targetTag: target.tag,
    moderatorId: ctx.interaction.user.id,
    reason,
    duration,
  });
  await logCase(ctx.interaction.guild, ctx.guild.settings, created);
  return created;
}

const userOption = (b: SlashCommandBuilder, verb: string) => b.addUserOption((o) => o.setName('user').setDescription(`Who to ${verb}`).setRequired(true));
const reasonOption = (description = 'Why? (shown in the case log)') => (o: SlashCommandStringOption) =>
  o.setName('reason').setDescription(description).setMaxLength(500);

export const warnCommand = guildSlashCommand({
  module: 'moderation',
  data: inServers(userOption(new SlashCommandBuilder().setName('warn').setDescription('Warn a member'), 'warn'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption(reasonOption()),
  execute: async (ctx) => {
    const target = await getTarget(ctx);
    if (!target) return;
    const reason = await getReason(ctx);
    if (reason === false) return;
    const created = await record(ctx, 'warn', { id: target.id, tag: target.user.tag }, reason);
    const dm = ctx.guild.settings.moderation.dmOnAction ? await notifyMember(target.user, ctx.interaction.guild, 'warn', reason) : null;
    const total = await cases.countWarnings(ctx.interaction.guildId, target.id);
    const container = actionDone(created, target.displayName, dm);
    await ctx.interaction.reply(v2([container, notice('info', `They now have **${total}** warning${total === 1 ? '' : 's'}.`)]));
  },
});

export const timeoutCommand = guildSlashCommand({
  module: 'moderation',
  data: inServers(userOption(new SlashCommandBuilder().setName('timeout').setDescription('Time out a member'), 'time out'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption((o) => o.setName('duration').setDescription('e.g. 10m, 2h, 1d (max 28d)').setRequired(true).setMaxLength(20))
    .addStringOption(reasonOption()),
  execute: async (ctx) => {
    const { interaction } = ctx;
    const duration = parseDuration(interaction.options.getString('duration', true));
    if (!duration || duration < 5000 || duration > MAX_TIMEOUT) {
      return reply(interaction, 'error', 'Use a duration between **5s** and **28d**, like `10m` or `2h`.');
    }
    const target = await getTarget(ctx);
    if (!target) return;
    if (!target.moderatable) return reply(interaction, 'error', "I can't time out that member.");
    const reason = await getReason(ctx);
    if (reason === false) return;

    await target.timeout(duration, `${interaction.user.tag}: ${reason ?? 'No reason'}`);
    const created = await record(ctx, 'timeout', { id: target.id, tag: target.user.tag }, reason, duration);
    const dm = ctx.guild.settings.moderation.dmOnAction ? await notifyMember(target.user, interaction.guild, 'timeout', reason, duration) : null;
    await interaction.reply(v2(actionDone(created, target.displayName, dm)));
  },
});

export const untimeoutCommand = guildSlashCommand({
  module: 'moderation',
  data: inServers(userOption(new SlashCommandBuilder().setName('untimeout').setDescription("Remove a member's timeout"), 'un-timeout'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption(reasonOption()),
  execute: async (ctx) => {
    const target = await getTarget(ctx);
    if (!target) return;
    if (!target.isCommunicationDisabled()) return reply(ctx.interaction, 'info', "That member isn't timed out.");
    const reason = await getReason(ctx);
    if (reason === false) return;
    await target.timeout(null, `${ctx.interaction.user.tag}: ${reason ?? 'No reason'}`);
    const created = await record(ctx, 'untimeout', { id: target.id, tag: target.user.tag }, reason);
    await ctx.interaction.reply(v2(actionDone(created, target.displayName, null)));
  },
});

export const kickCommand = guildSlashCommand({
  module: 'moderation',
  data: inServers(userOption(new SlashCommandBuilder().setName('kick').setDescription('Kick a member'), 'kick'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addStringOption(reasonOption()),
  execute: async (ctx) => {
    const target = await getTarget(ctx);
    if (!target) return;
    if (!target.kickable) return reply(ctx.interaction, 'error', "I can't kick that member.");
    const reason = await getReason(ctx);
    if (reason === false) return;
    // DM first — after the kick we can't reach them anymore.
    const dm = ctx.guild.settings.moderation.dmOnAction ? await notifyMember(target.user, ctx.interaction.guild, 'kick', reason) : null;
    await target.kick(`${ctx.interaction.user.tag}: ${reason ?? 'No reason'}`);
    const created = await record(ctx, 'kick', { id: target.id, tag: target.user.tag }, reason);
    await ctx.interaction.reply(v2(actionDone(created, target.displayName, dm)));
  },
});

const DELETE_CHOICES = [
  { name: "Don't delete", value: 0 },
  { name: 'Last hour', value: 3600 },
  { name: 'Last 24 hours', value: 86_400 },
  { name: 'Last 7 days', value: 604_800 },
];

export const banCommand = guildSlashCommand({
  module: 'moderation',
  data: inServers(new SlashCommandBuilder().setName('ban').setDescription('Ban a user, even if they left'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('Who to ban').setRequired(true))
    .addStringOption(reasonOption())
    .addIntegerOption((o) => o.setName('delete_messages').setDescription('Delete their recent messages').addChoices(...DELETE_CHOICES)),
  execute: async (ctx) => {
    const { interaction } = ctx;
    const user = interaction.options.getUser('user', true);
    const member = interaction.options.getMember('user');
    if (member) {
      const blocker = moderationBlocker(interaction.member, member, interaction.guild.members.me!);
      if (blocker) return reply(interaction, 'error', blocker);
      if (!member.bannable) return reply(interaction, 'error', "I can't ban that member.");
    }
    const reason = await getReason(ctx);
    if (reason === false) return;

    const dm = member && ctx.guild.settings.moderation.dmOnAction ? await notifyMember(user, interaction.guild, 'ban', reason) : null;
    await interaction.guild.members.ban(user, {
      reason: `${interaction.user.tag}: ${reason ?? 'No reason'}`,
      deleteMessageSeconds: interaction.options.getInteger('delete_messages') ?? 0,
    });
    const created = await record(ctx, 'ban', { id: user.id, tag: user.tag }, reason);
    await interaction.reply(v2(actionDone(created, member?.displayName ?? user.username, dm)));
  },
});

export const unbanCommand = guildSlashCommand({
  module: 'moderation',
  data: inServers(new SlashCommandBuilder().setName('unban').setDescription('Unban a user'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((o) => o.setName('user').setDescription('Banned user (search by name or ID)').setRequired(true).setAutocomplete(true))
    .addStringOption(reasonOption()),
  autocomplete: async ({ interaction }) => {
    const query = interaction.options.getFocused().toLowerCase();
    const bans = await interaction.guild.bans.fetch({ limit: 1000 }).catch(() => null);
    const matches = [...(bans?.values() ?? [])]
      .filter((b) => b.user.username.toLowerCase().includes(query) || b.user.id.startsWith(query))
      .slice(0, 25)
      .map((b) => ({ name: `${b.user.username} (${b.user.id})`, value: b.user.id }));
    await interaction.respond(matches);
  },
  execute: async (ctx) => {
    const { interaction } = ctx;
    const userId = interaction.options.getString('user', true);
    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) return reply(interaction, 'error', "That user isn't banned.");
    const reason = await getReason(ctx);
    if (reason === false) return;
    await interaction.guild.members.unban(userId, `${interaction.user.tag}: ${reason ?? 'No reason'}`);
    const created = await record(ctx, 'unban', { id: userId, tag: ban.user.tag }, reason);
    await interaction.reply(v2(actionDone(created, ban.user.username, null)));
  },
});

export const purgeCommand = guildSlashCommand({
  module: 'moderation',
  cooldown: 5,
  data: inServers(new SlashCommandBuilder().setName('purge').setDescription('Bulk delete recent messages'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName('amount').setDescription('How many messages to check (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName('from').setDescription('Only delete messages from this user'))
    .addStringOption(reasonOption()),
  execute: async (ctx) => {
    const { interaction } = ctx;
    const channel = interaction.channel;
    if (!channel || !('bulkDelete' in channel)) return reply(interaction, 'error', "I can't purge messages here.");
    const reason = await getReason(ctx);
    if (reason === false) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const amount = interaction.options.getInteger('amount', true);
    const from = interaction.options.getUser('from');
    const fetched = await channel.messages.fetch({ limit: amount });
    const targets = from ? fetched.filter((m) => m.author.id === from.id) : fetched;
    const deleted = await channel.bulkDelete(targets, true);

    await record(ctx, 'purge', { id: channel.id, tag: `#${channel.name}` }, reason ?? `${deleted.size} messages${from ? ` from ${from.tag}` : ''}`);
    const skipped = targets.size - deleted.size;
    await respond(interaction, notice('success', `Deleted **${deleted.size}** message${deleted.size === 1 ? '' : 's'}.${skipped ? `\n-# Skipped ${skipped} older than 14 days.` : ''}`));
  },
});

