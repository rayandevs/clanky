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
  return row(
    button({ id: cid('case', 'reason', record.caseId), label: 'Edit reason', emoji: 'edit' }),
    button({ id: cid('case', 'history', record.targetId, 0, 'new'), label: 'History', emoji: 'case' }),
    button({ id: cid('case', 'delete', record.caseId), label: 'Delete', emoji: 'delete', style: ButtonStyle.Danger }),
  );
}

async function historyView(guildId: string, targetId: string, page: number, accent: number) {
  const { entries, total, pages } = await cases.list(guildId, targetId, page);
  const lines = entries.map((c) => {
    const style = CASE_STYLE[c.type];
    return `${emoji(style.emoji)} **#${c.caseId} ${style.label}** · ${timestamp(c.createdAt, 'R')}\n-# ${truncate(c.reason ?? 'No reason given', 90)} · by <@${c.moderatorId}>`;
  });
  const container = panel({
    title: 'Case history',
    emoji: 'case',
    description: `<@${targetId}> has **${total}** case${total === 1 ? '' : 's'}.`,
    accent,
  });
  if (lines.length) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(lines.join('\n')));
  if (pages > 1) {
    container.addActionRowComponents(
      row(
        button({ id: cid('case', 'history', targetId, page - 1, 'edit'), emoji: 'prev', disabled: page <= 0 }),
        button({ id: cid('case', 'noop'), label: `${page + 1} / ${pages}`, disabled: true }),
        button({ id: cid('case', 'history', targetId, page + 1, 'edit'), emoji: 'next', disabled: page >= pages - 1 }),
      ),
    );
  }
  return container;
}

export const casesCommand = guildSlashCommand({
  module: 'moderation',
  data: inServers(new SlashCommandBuilder().setName('cases').setDescription('Look up moderation cases'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((s) =>
      s.setName('view').setDescription('Show one case').addIntegerOption((o) => o.setName('id').setDescription('Case number').setRequired(true).setMinValue(1)),
    )
    .addSubcommand((s) =>
      s.setName('user').setDescription("Show a user's history").addUserOption((o) => o.setName('user').setDescription('Who').setRequired(true)),
    ),
  execute: async ({ interaction, accent }) => {
    if (interaction.options.getSubcommand() === 'user') {
      const user = interaction.options.getUser('user', true);
      return interaction.reply(v2(await historyView(interaction.guildId, user.id, 0, accent), { ephemeral: true }));
    }
    const record = await cases.get(interaction.guildId, interaction.options.getInteger('id', true));
    if (!record) return reply(interaction, 'error', "I couldn't find that case.");
    await interaction.reply(v2(caseContainer(record).addActionRowComponents(caseActions(record)), { ephemeral: true }));
  },
});

export const caseComponents = guildComponents({
  prefix: 'case',
  module: 'moderation',
  button: async ({ interaction, accent }, [action, a, b, mode]) => {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      return reply(interaction, 'error', 'You need the **Timeout Members** permission for cases.');
    }
    const guildId = interaction.guildId;
    switch (action) {
      case 'view': {
        const record = await cases.get(guildId, Number(a));
        if (!record) return reply(interaction, 'error', 'That case was deleted.');
        return interaction.reply(v2(caseContainer(record).addActionRowComponents(caseActions(record)), { ephemeral: true }));
      }
      case 'history': {
        const view = await historyView(guildId, a!, Math.max(0, Number(b) || 0), accent);
        // Paging edits the message; opening from a case shows a new private one.
        if (mode === 'edit') return interaction.update({ components: [view] });
        return interaction.reply(v2(view, { ephemeral: true }));
      }
      case 'reason': {
        const record = await cases.get(guildId, Number(a));
        if (!record) return reply(interaction, 'error', 'That case was deleted.');
        return interaction.showModal(
          new ModalBuilder()
            .setCustomId(cid('case', 'reason', record.caseId))
            .setTitle(`Case #${record.caseId}`)
            .addLabelComponents(
              new LabelBuilder()
                .setLabel('Reason')
                .setTextInputComponent(new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setValue(record.reason ?? '')),
            ),
        );
      }
      case 'delete': {
        const ok = await cases.delete(guildId, Number(a));
        return interaction.update({ components: [panel({ title: ok ? `Case #${a} deleted` : 'Already deleted', emoji: 'delete', accent })] });
      }
    }
  },
  modal: async ({ interaction }, [, id]) => {
    const record = await cases.setReason(interaction.guildId, Number(id), interaction.fields.getTextInputValue('reason').trim());
    if (!record) return reply(interaction, 'error', 'That case was deleted.');
    // Keep the mod log in sync.
    if (record.logChannelId && record.logMessageId) {
      const channel = interaction.guild.channels.cache.get(record.logChannelId);
      if (channel?.isTextBased()) {
        await channel.messages.edit(record.logMessageId, { components: [caseContainer(record)] }).catch(() => null);
      }
    }
    if (interaction.isFromMessage()) return interaction.update({ components: [caseContainer(record).addActionRowComponents(caseActions(record))] });
    return reply(interaction, 'success', `Updated case **#${record.caseId}**.`);
  },
});
