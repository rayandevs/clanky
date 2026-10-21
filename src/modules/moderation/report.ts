import {
  ApplicationCommandType,
  ButtonStyle,
  ContainerBuilder,
  ContextMenuCommandBuilder,
  LabelBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  RadioGroupBuilder,
  RadioGroupOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type APIContainerComponent,
} from 'discord.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { moderationBlocker } from '../../core/permissions.js';
import { guildComponents, guildMessageMenu } from '../../core/types.js';
import { cases } from '../../services/index.js';
import { button, divider, panel, row, text, truncate, v2 } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';
import { reply } from '../../ui/respond.js';
import { colors } from '../../ui/theme.js';
import { logCase, notifyMember } from './shared.js';
import { beginReportAction, createReport, finishReportAction, reviewReport } from './reviewService.js';
import { deleteReportedMessage } from './reviewActions.js';

const REASONS = {
  spam: 'Spam or scam',
  harassment: 'Harassment or hate',
  nsfw: 'NSFW content',
  other: 'Something else',
} as const;

export const reportMenu = guildMessageMenu({
  module: 'moderation',
  cooldown: 30,
  data: inServers(new ContextMenuCommandBuilder().setName('Report message').setType(ApplicationCommandType.Message)),
  execute: async ({ interaction, guild }) => {
    if (!guild.settings.moderation.reportsChannelId) {
      return reply(interaction, 'warning', "Reports aren't set up in this server yet.");
    }
    const message = interaction.targetMessage;
    if (message.author.id === interaction.user.id) return reply(interaction, 'info', "You can't report your own message.");
    if (message.author.bot) return reply(interaction, 'info', "You can't report bot messages.");

    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(cid('rep', 'submit', message.channelId, message.id))
        .setTitle('Report message')
        .addLabelComponents(
          new LabelBuilder().setLabel("What's wrong?").setRadioGroupComponent(
            new RadioGroupBuilder()
              .setCustomId('reason')
              .setRequired(true)
              .setOptions(Object.entries(REASONS).map(([value, label]) => new RadioGroupOptionBuilder().setValue(value).setLabel(label))),
          ),
          new LabelBuilder()
            .setLabel('Anything else?')
            .setDescription('Optional. Only moderators can see this.')
            .setTextInputComponent(new TextInputBuilder().setCustomId('details').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
        ),
    );
  },
});

function closeReport(interaction: { message: { components: unknown[] } }, line: string): ContainerBuilder {
  const original = interaction.message.components[0] as { toJSON(): APIContainerComponent };
  const container = new ContainerBuilder(original.toJSON());
  container.spliceComponents(-1, 1);
  return container.setAccentColor(colors.muted).addTextDisplayComponents(text(line));
}

function reportCard(report: Awaited<ReturnType<typeof createReport>>['report'], message: { url: string; channel: { toString(): string } }) {
  return panel({ title: `New report · ${report.reason}`, emoji: 'report', accent: colors.error })
    .addTextDisplayComponents(
      text([
        `${emoji('user')} **Author** <@${report.targetId}> · \`${report.targetId}\``,
        `${emoji('report')} **Reported by** <@${report.reporterId}>`,
        `${emoji('list')} **Reason** ${REASONS[report.reason]}${report.details ? `\n> ${truncate(report.details, 400)}` : ''}`,
      ].join('\n')),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Message** in ${message.channel}\n${truncate(report.contentSnapshot || '*No text — maybe an attachment.*', 900)}`))
    .addActionRowComponents(
      row(
        button({ url: message.url, label: 'Jump', emoji: 'link' }),
        button({ id: cid('rep', 'claim', report.reportId), label: 'Review', emoji: 'edit' }),
        button({ id: cid('rep', 'delete', report.reportId), label: 'Delete message', emoji: 'delete', style: ButtonStyle.Danger }),
        button({ id: cid('rep', 'timeout', report.reportId), label: 'Timeout 1h', emoji: 'timeout', style: ButtonStyle.Danger }),
        button({ id: cid('rep', 'dismiss', report.reportId), label: 'Dismiss', emoji: 'done' }),
      ),
    );
}

export const reportComponents = guildComponents({
  prefix: 'rep',
  module: 'moderation',
  modal: async ({ interaction, guild }, [, channelId, messageId]) => {
    const source = interaction.guild.channels.cache.get(channelId!);
    const message = source?.isTextBased() ? await source.messages.fetch(messageId!).catch(() => null) : null;
    if (!message) return reply(interaction, 'error', 'That message was already deleted.');
    const reason = interaction.fields.getRadioGroup('reason', true) as keyof typeof REASONS;
    const details = interaction.fields.getTextInputValue('details').trim();
    const created = await createReport({
      guildId: interaction.guildId,
      reporterId: interaction.user.id,
      targetId: message.author.id,
      channelId: message.channelId,
      messageId: message.id,
      messageUrl: message.url,
      reason: reason in REASONS ? reason : 'other',
      details: details || null,
      contentSnapshot: truncate(message.content || '*No text — maybe an attachment.*', 1000),
      retentionDays: guild.settings.moderation.reviewRetentionDays,
    });
    if (created.duplicate) return reply(interaction, 'info', 'You already sent a report for that message. Staff can still see the existing report.');

    const reportsChannel = interaction.guild.channels.cache.get(guild.settings.moderation.reportsChannelId ?? '');
    if (reportsChannel?.isSendable()) {
      await reportsChannel.send(v2(reportCard(created.report, message))).catch(() => null);
    }
    await reply(interaction, 'success', 'Thanks. Your report was saved for moderator review.');
  },

  button: async ({ interaction, guild }, [action, reportId]) => {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      return reply(interaction, 'error', 'You need the **Timeout Members** permission to review reports.');
    }
    const report = await import('../../database/models/ModerationReport.js').then(({ ModerationReportModel }) => ModerationReportModel.findOne({ guildId: interaction.guildId, reportId }).lean());
    if (!report) return reply(interaction, 'error', 'That report has expired or was already removed.');
    const by = `-# ${emoji('success')} Handled by ${interaction.user}`;

    if (action === 'claim') {
      const updated = await reviewReport({ guildId: interaction.guildId, reportId: report.reportId, reviewerId: interaction.user.id, status: 'in_review', note: 'Claimed in Discord.' });
      if (!updated) return reply(interaction, 'warning', 'Another moderator has already started or finished this report.');
      return interaction.update({ components: [closeReport(interaction, `${by} · In review`)] });
    }
    if (action === 'dismiss') {
      const updated = await reviewReport({ guildId: interaction.guildId, reportId: report.reportId, reviewerId: interaction.user.id, status: 'dismissed' });
      if (!updated) return reply(interaction, 'warning', 'Another moderator has already started or finished this report.');
      return interaction.update({ components: [closeReport(interaction, `${by} · Dismissed`)] });
    }

    if (action === 'delete' && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      return reply(interaction, 'error', 'You need the **Manage Messages** permission to delete a reported message.');
    }
    if (action === 'timeout' && !interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      return reply(interaction, 'error', 'You need the **Timeout Members** permission to time out a member.');
    }
    const claimed = await beginReportAction(interaction.guildId, report.reportId, interaction.user.id);
    if (!claimed) return reply(interaction, 'warning', 'Another moderator has already started or finished this report.');

    if (action === 'delete') {
      const deletion = await deleteReportedMessage(interaction.guild, claimed.channelId, claimed.messageId);
      if (deletion.status === 'failed') {
        await finishReportAction({ guildId: interaction.guildId, reportId: claimed.reportId, reviewerId: interaction.user.id, processingToken: claimed.processingToken!, status: 'in_review' });
        return reply(interaction, 'error', deletion.message);
      }
      const finished = await finishReportAction({ guildId: interaction.guildId, reportId: claimed.reportId, reviewerId: interaction.user.id, processingToken: claimed.processingToken!, status: 'resolved', note: deletion.status === 'deleted' ? 'Reported message deleted.' : 'Reported message was already gone.' });
      if (!finished) return reply(interaction, 'warning', 'The message action finished, but this report was reassigned while it was processing. Check the Moderation Desk before taking another action.');
      return interaction.update({ components: [closeReport(interaction, `${by} · ${deletion.status === 'deleted' ? 'Message deleted' : 'Message was already gone'}`)] });
    }
    if (action === 'timeout') {
      const member = await interaction.guild.members.fetch(claimed.targetId).catch(() => null);
      const blocker = member ? moderationBlocker(interaction.member, member, interaction.guild.members.me!) : null;
      if (!member?.moderatable || blocker) {
        await finishReportAction({ guildId: interaction.guildId, reportId: claimed.reportId, reviewerId: interaction.user.id, processingToken: claimed.processingToken!, status: 'in_review', note: null });
        return reply(interaction, 'error', blocker ?? "I can't time out that member.");
      }
      const reason = `Report ${claimed.reportId}: ${REASONS[claimed.reason]}`;
      const record = await cases.create({ guildId: interaction.guildId, type: 'timeout', targetId: member.id, targetTag: member.user.tag, moderatorId: interaction.user.id, reason, duration: 3_600_000, reportId: claimed.reportId });
      try {
        await member.timeout(3_600_000, `${interaction.user.tag}: ${reason}`);
      } catch {
        const voided = await cases.setStatus(interaction.guildId, record.caseId, 'voided', { moderatorId: interaction.user.id, text: 'Voided: Discord did not apply the report timeout.' }).catch(() => null);
        await logCase(interaction.guild, guild.settings, voided ?? record);
        await finishReportAction({ guildId: interaction.guildId, reportId: claimed.reportId, reviewerId: interaction.user.id, processingToken: claimed.processingToken!, status: 'in_review' });
        return reply(interaction, 'error', "I couldn't apply that timeout. The report is still in review; check my permissions and the member's role.");
      }
      await logCase(interaction.guild, guild.settings, record);
      if (guild.settings.moderation.dmOnAction) await notifyMember(member.user, interaction.guild, 'timeout', reason, 3_600_000, record);
      const finished = await finishReportAction({ guildId: interaction.guildId, reportId: claimed.reportId, reviewerId: interaction.user.id, processingToken: claimed.processingToken!, status: 'resolved', note: `Timed out for 1h (case #${record.caseId}).`, caseId: record.caseId });
      if (!finished) return reply(interaction, 'warning', `The timeout was applied and case #${record.caseId} was recorded, but this report was reassigned while it was processing. Check the Moderation Desk.`);
      return interaction.update({ components: [closeReport(interaction, `${by} · Timed out for 1h (case #${record.caseId})`)] });
    }
    await finishReportAction({ guildId: interaction.guildId, reportId: claimed.reportId, reviewerId: interaction.user.id, processingToken: claimed.processingToken!, status: 'in_review' });
    return reply(interaction, 'error', 'That report action is not available.');
  },
});
