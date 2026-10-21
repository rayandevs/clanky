import {
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { timestamp } from '../../core/time.js';
import { guildComponents, guildSlashCommand } from '../../core/types.js';
import type { CaseRecord } from '../../database/models/index.js';
import { cases } from '../../services/index.js';
import { button, divider, panel, row, text, truncate, v2 } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';
import { reply } from '../../ui/respond.js';
import { CASE_STYLE, caseContainer } from './shared.js';

function caseActions(record: CaseRecord) {
  return [row(
    button({ id: cid('case', 'reason', record.caseId), label: 'Edit reason', emoji: 'edit' }),
    button({ id: cid('case', 'history', record.targetId, 0, 'new'), label: 'History', emoji: 'case' }),
    button({ id: cid('case', 'note', record.caseId), label: 'Add private note', emoji: 'edit' }),
    button({ id: cid('case', 'status', record.caseId, record.status === 'voided' ? 'active' : 'voided'), label: record.status === 'voided' ? 'Reopen' : 'Void case', emoji: record.status === 'voided' ? 'done' : 'delete', style: record.status === 'voided' ? ButtonStyle.Secondary : ButtonStyle.Danger }),
  )];
}

function caseDetails(record: CaseRecord) {
  const container = caseContainer(record);
  const notes = record.notes?.slice(-5) ?? [];
  if (notes.length) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`**Private staff notes**\n${notes.map((note) => `-# <@${note.moderatorId}> · ${timestamp(note.createdAt, 'R')}\n${truncate(note.text, 700)}`).join('\n')}`));
  }
  return container.addActionRowComponents(...caseActions(record));
}

function editModal(action: 'reason' | 'note' | 'status', record: CaseRecord, nextStatus?: 'active' | 'voided') {
  const isReason = action === 'reason';
  const customId = action === 'status' ? cid('case', 'status', record.caseId, nextStatus!) : cid('case', action, record.caseId);
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(action === 'reason' ? `Edit case #${record.caseId}` : action === 'note' ? `Note on case #${record.caseId}` : `${nextStatus === 'voided' ? 'Void' : 'Reopen'} case #${record.caseId}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(isReason ? 'Reason' : action === 'note' ? 'Private staff note' : 'Why is this case changing?')
        .setDescription(action === 'note' ? 'Only moderators with case access can read this note.' : action === 'status' && nextStatus === 'voided' ? 'Voiding keeps the case history but does not undo the Discord action.' : 'Give a clear reason so the case history stays useful.')
        .setTextInputComponent(new TextInputBuilder().setCustomId('text').setStyle(TextInputStyle.Paragraph).setRequired(!isReason).setMaxLength(isReason ? 500 : 1000).setValue(isReason ? record.reason ?? '' : '')),
    );
}

async function historyView(guildId: string, targetId: string, page: number, accent: number) {
  const { entries, total, pages } = await cases.list(guildId, targetId, page);
  const lines = entries.map((c) => {
    const style = CASE_STYLE[c.type];
    const state = c.status === 'voided' ? ' · **Voided**' : '';
    return `${emoji(style.emoji)} **#${c.caseId} ${style.label}**${state} · ${timestamp(c.createdAt, 'R')}\n-# ${truncate(c.reason ?? 'No reason given', 90)} · by <@${c.moderatorId}> · ${(c.notes?.length ?? 0)} private note(s)`;
  });
  const container = panel({ title: 'Case history', emoji: 'case', description: `<@${targetId}> has **${total}** case${total === 1 ? '' : 's'}.`, accent });
  if (lines.length) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(lines.join('\n')));
  if (pages > 1) container.addActionRowComponents(row(
    button({ id: cid('case', 'history', targetId, page - 1, 'edit'), emoji: 'prev', disabled: page <= 0 }),
    button({ id: cid('case', 'noop'), label: `${page + 1} / ${pages}`, disabled: true }),
    button({ id: cid('case', 'history', targetId, page + 1, 'edit'), emoji: 'next', disabled: page >= pages - 1 }),
  ));
  return container;
}

export const casesCommand = guildSlashCommand({
  module: 'moderation',
  data: inServers(new SlashCommandBuilder().setName('cases').setDescription('Look up moderation cases'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((s) => s.setName('view').setDescription('Show one case').addIntegerOption((o) => o.setName('id').setDescription('Case number').setRequired(true).setMinValue(1)))
    .addSubcommand((s) => s.setName('user').setDescription("Show a user's case history").addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true))),
  execute: async ({ interaction, accent }) => {
    if (interaction.options.getSubcommand() === 'user') {
      const user = interaction.options.getUser('user', true);
      return interaction.reply(v2(await historyView(interaction.guildId, user.id, 0, accent), { ephemeral: true }));
    }
    const record = await cases.get(interaction.guildId, interaction.options.getInteger('id', true));
    if (!record) return reply(interaction, 'error', "I couldn't find that case.");
    await interaction.reply(v2(caseDetails(record), { ephemeral: true }));
  },
});

export const caseComponents = guildComponents({
  prefix: 'case',
  module: 'moderation',
  button: async ({ interaction, accent }, [action, a, b, mode]) => {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) return reply(interaction, 'error', 'You need the **Timeout Members** permission for cases.');
    const guildId = interaction.guildId;
    switch (action) {
      case 'view': {
        const record = await cases.get(guildId, Number(a));
        if (!record) return reply(interaction, 'error', 'That case could not be found.');
        return interaction.reply(v2(caseDetails(record), { ephemeral: true }));
      }
      case 'history': {
        const view = await historyView(guildId, a!, Math.max(0, Number(b) || 0), accent);
        if (mode === 'edit') return interaction.update({ components: [view] });
        return interaction.reply(v2(view, { ephemeral: true }));
      }
      case 'reason':
      case 'note': {
        const record = await cases.get(guildId, Number(a));
        if (!record) return reply(interaction, 'error', 'That case could not be found.');
        return interaction.showModal(editModal(action, record));
      }
      case 'status': {
        const record = await cases.get(guildId, Number(a));
        if (!record || (b !== 'active' && b !== 'voided')) return reply(interaction, 'error', 'That case status change is not available.');
        return interaction.showModal(editModal('status', record, b));
      }
      default:
        return reply(interaction, 'error', 'That case action is not available.');
    }
  },
  modal: async ({ interaction }, [action, rawId, nextStatus]) => {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) return reply(interaction, 'error', 'You need the Timeout Members permission to update cases.');
    const caseId = Number(rawId);
    const input = interaction.fields.getTextInputValue('text').trim();
    if (!Number.isSafeInteger(caseId) || caseId < 1) return reply(interaction, 'error', 'That case could not be found.');
    let record: CaseRecord | null = null;
    if (action === 'reason') {
      record = await cases.setReason(interaction.guildId, caseId, input);
    } else if (action === 'note') {
      if (!input) return reply(interaction, 'warning', 'Write a note before saving.');
      record = await cases.addNote(interaction.guildId, caseId, interaction.user.id, input);
    } else if (action === 'status' && (nextStatus === 'active' || nextStatus === 'voided')) {
      if (input.length < 5) return reply(interaction, 'warning', 'Add a short reason (at least 5 characters).');
      record = await cases.setStatus(interaction.guildId, caseId, nextStatus, { moderatorId: interaction.user.id, text: `${nextStatus === 'voided' ? 'Voided' : 'Reopened'}: ${input}` });
    }
    if (!record) return reply(interaction, 'error', 'That case could not be found.');
    if (record.logChannelId && record.logMessageId) {
      const channel = interaction.guild.channels.cache.get(record.logChannelId);
      if (channel?.isTextBased()) await channel.messages.edit(record.logMessageId, { components: [caseContainer(record)] }).catch(() => null);
    }
    if (interaction.isFromMessage()) return interaction.update({ components: [caseDetails(record)] });
    return reply(interaction, 'success', `Updated case **#${record.caseId}**.`);
  },
});
