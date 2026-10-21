import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction, type GuildMember, type SlashCommandStringOption } from 'discord.js';
import { inServers } from '../../core/builders.js';
import { moderationBlocker } from '../../core/permissions.js';
import { formatDuration, parseDuration } from '../../core/time.js';
import { guildSlashCommand, type GuildContext } from '../../core/types.js';
import type { CaseType } from '../../database/models/index.js';
import { cases } from '../../services/index.js';
import { notice, v2 } from '../../ui/components.js';
import { reply, respond } from '../../ui/respond.js';
import { actionDone, logCase, notifyActionCancelled, notifyMember } from './shared.js';

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

async function createRecord(ctx: Ctx, type: CaseType, target: { id: string; tag: string }, reason: string | null, duration?: number | null, reportId?: string | null) {
  return cases.create({
    guildId: ctx.interaction.guildId,
    type,
    targetId: target.id,
    targetTag: target.tag,
    moderatorId: ctx.interaction.user.id,
    reason,
    duration,
    reportId,
  });
}

async function record(ctx: Ctx, type: CaseType, target: { id: string; tag: string }, reason: string | null, duration?: number | null, reportId?: string | null) {
  const created = await createRecord(ctx, type, target, reason, duration, reportId);
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
    const settings = ctx.guild.settings.moderation;
    const since = new Date(Date.now() - settings.warningWindowDays * 86_400_000);
    const total = await cases.countWarnings(ctx.interaction.guildId, target.id, since);
    const tier = settings.warningEscalations.find((step) => step.warnings === total);
    let escalationCase = null;
    let escalationBlocked = false;
    if (tier && !target.moderatable) escalationBlocked = true;
    if (tier && target.moderatable) {
      const duration = tier.durationSeconds * 1000;
      const timeoutCase = await createRecord(ctx, 'timeout', { id: target.id, tag: target.user.tag }, `Automatic escalation after ${total} active warnings in ${settings.warningWindowDays} days.`, duration);
      try {
        await target.timeout(duration, `${ctx.interaction.user.tag}: Automatic warning escalation (${total} warnings in ${settings.warningWindowDays} days)`);
        escalationCase = timeoutCase;
        await logCase(ctx.interaction.guild, ctx.guild.settings, timeoutCase);
      } catch {
        escalationBlocked = true;
        const voided = await cases.setStatus(ctx.interaction.guildId, timeoutCase.caseId, 'voided', { moderatorId: ctx.interaction.user.id, text: 'Voided: Discord did not apply the automatic escalation timeout.' }).catch(() => null);
        await logCase(ctx.interaction.guild, ctx.guild.settings, voided ?? timeoutCase);
      }
    }
    const dm = settings.dmOnAction
      ? await notifyMember(target.user, ctx.interaction.guild, escalationCase ? 'timeout' : 'warn', escalationCase?.reason ?? reason, escalationCase?.duration ?? undefined, escalationCase ?? created)
      : null;
    const container = actionDone(escalationCase ?? created, target.displayName, dm);
    const summary = escalationCase
      ? notice('warning', `Warning **${total}** reached an escalation tier. Timed out for **${formatDuration(tier!.durationSeconds * 1000)}** (case #${escalationCase.caseId}).`)
      : tier && escalationBlocked
        ? notice('warning', `Warning **${total}** reached an escalation tier, but Clanky couldn't apply the timeout. The warning is saved; check bot permissions, role order, and Discord's response.`)
        : notice('info', `They have **${total}** active warning${total === 1 ? '' : 's'} in the last ${settings.warningWindowDays} days.`);
    await ctx.interaction.reply(v2([container, summary], { ephemeral: true }));
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
    const dm = ctx.guild.settings.moderation.dmOnAction ? await notifyMember(target.user, interaction.guild, 'timeout', reason, duration, created) : null;
    await interaction.reply(v2(actionDone(created, target.displayName, dm), { ephemeral: true }));
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
    await ctx.interaction.reply(v2(actionDone(created, target.displayName, null), { ephemeral: true }));
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
    const created = await createRecord(ctx, 'kick', { id: target.id, tag: target.user.tag }, reason);
    const dm = ctx.guild.settings.moderation.dmOnAction ? await notifyMember(target.user, ctx.interaction.guild, 'kick', reason, undefined, created, true) : null;
    try {
      await target.kick(`${ctx.interaction.user.tag}: ${reason ?? 'No reason'}`);
    } catch {
      const voided = await cases.setStatus(ctx.interaction.guildId, created.caseId, 'voided', { moderatorId: ctx.interaction.user.id, text: 'Voided: Discord did not apply the planned kick.' }).catch(() => null);
      await logCase(ctx.interaction.guild, ctx.guild.settings, voided ?? created);
      if (dm) await notifyActionCancelled(target.user, 'kick', ctx.interaction.guild, created.caseId);
      return reply(ctx.interaction, 'error', 'Discord did not apply the kick. The case was voided; check permissions and the member hierarchy.');
    }
    await logCase(ctx.interaction.guild, ctx.guild.settings, created);
    await ctx.interaction.reply(v2(actionDone(created, target.displayName, dm), { ephemeral: true }));
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

    const created = await createRecord(ctx, 'ban', { id: user.id, tag: user.tag }, reason);
    const dm = ctx.guild.settings.moderation.dmOnAction ? await notifyMember(user, interaction.guild, 'ban', reason, undefined, created, true) : null;
    try {
      await interaction.guild.members.ban(user, {
        reason: `${interaction.user.tag}: ${reason ?? 'No reason'}`,
        deleteMessageSeconds: interaction.options.getInteger('delete_messages') ?? 0,
      });
    } catch {
      const voided = await cases.setStatus(interaction.guildId, created.caseId, 'voided', { moderatorId: interaction.user.id, text: 'Voided: Discord did not apply the planned ban.' }).catch(() => null);
      await logCase(interaction.guild, ctx.guild.settings, voided ?? created);
      if (dm) await notifyActionCancelled(user, 'ban', interaction.guild, created.caseId);
      return reply(interaction, 'error', 'Discord did not apply the ban. The case was voided; check permissions and the member hierarchy.');
    }
    await logCase(interaction.guild, ctx.guild.settings, created);
    await interaction.reply(v2(actionDone(created, member?.displayName ?? user.username, dm), { ephemeral: true }));
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
    await interaction.reply(v2(actionDone(created, ban.user.username, null), { ephemeral: true }));
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
