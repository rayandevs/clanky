import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { cid } from '../../core/customId.js';
import { components } from '../../core/types.js';
import { cases, guilds } from '../../services/index.js';
import { button, row } from '../../ui/components.js';
import { reply } from '../../ui/respond.js';
import { createAppeal } from './reviewService.js';

export function appealButton(guildId: string, caseId: number) {
  return row(button({ id: cid('appeal', 'open', guildId, caseId), label: 'Appeal this action', emoji: 'report' }));
}

export const appealComponents = components({
  prefix: 'appeal',
  module: 'moderation',
  button: async ({ interaction }, [action, guildId, rawCaseId]) => {
    if (action !== 'open' || !guildId || !rawCaseId) return reply(interaction, 'error', 'That appeal link is not valid.');
    const caseId = Number(rawCaseId);
    if (!Number.isSafeInteger(caseId) || caseId < 1) return reply(interaction, 'error', 'That case could not be found.');
    const record = await cases.get(guildId, caseId);
    if (!record || record.targetId !== interaction.user.id || record.status === 'voided' || !['warn', 'timeout', 'kick', 'ban'].includes(record.type)) {
      return reply(interaction, 'error', 'This appeal is unavailable. Check that you are using the original message for your case.');
    }
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(cid('appeal', 'submit', guildId, caseId))
        .setTitle(`Appeal case #${caseId}`)
        .addLabelComponents(
          new LabelBuilder()
            .setLabel('What should the moderators know?')
            .setDescription('Only the server’s moderation team can read this.')
            .setTextInputComponent(new TextInputBuilder().setCustomId('statement').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(10).setMaxLength(1000)),
        ),
    );
  },
  modal: async ({ interaction }, [action, guildId, rawCaseId]) => {
    if (action !== 'submit' || !guildId || !rawCaseId) return reply(interaction, 'error', 'That appeal form is not valid.');
    const caseId = Number(rawCaseId);
    const record = Number.isSafeInteger(caseId) ? await cases.get(guildId, caseId) : null;
    if (!record || record.targetId !== interaction.user.id || record.status === 'voided' || !['warn', 'timeout', 'kick', 'ban'].includes(record.type)) {
      return reply(interaction, 'error', 'This appeal is no longer available.');
    }
    const statement = interaction.fields.getTextInputValue('statement').trim();
    if (statement.length < 10) return reply(interaction, 'warning', 'Please add a little more detail (at least 10 characters).');
    const settings = await guilds.settings(guildId);
    const result = await createAppeal({ guildId, caseId, targetId: interaction.user.id, statement, retentionDays: settings.moderation.reviewRetentionDays });
    await reply(interaction, result.duplicate ? 'info' : 'success', result.duplicate ? 'You already sent an appeal for this case. The moderation team can see its current status.' : 'Your appeal has been sent to the moderation team.');
  },
});
