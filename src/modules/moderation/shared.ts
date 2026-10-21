import { ButtonStyle, type Guild, type User } from 'discord.js';
import { cid } from '../../core/customId.js';
import { createLogger } from '../../core/logger.js';
import { formatDuration, timestamp } from '../../core/time.js';
import type { CaseRecord, CaseType } from '../../database/models/index.js';
import { cases } from '../../services/index.js';
import type { GuildSettings } from '../../settings/schema.js';
import { button, divider, panel, row, text, v2 } from '../../ui/components.js';
import { emoji, type EmojiKey } from '../../ui/emoji.js';
import { colors } from '../../ui/theme.js';
import { appealButton } from './appeals.js';

const log = createLogger('moderation');

export const CASE_STYLE: Record<CaseType, { label: string; past: string; emoji: EmojiKey; color: number }> = {
  warn: { label: 'Warn', past: 'warned', emoji: 'warn', color: colors.warning },
  timeout: { label: 'Timeout', past: 'timed out', emoji: 'timeout', color: 0xf47b67 },
  untimeout: { label: 'Timeout removed', past: 'un-timed out', emoji: 'untimeout', color: colors.success },
  kick: { label: 'Kick', past: 'kicked', emoji: 'kick', color: 0xe67e22 },
  ban: { label: 'Ban', past: 'banned', emoji: 'ban', color: colors.error },
  unban: { label: 'Unban', past: 'unbanned', emoji: 'unban', color: colors.success },
  purge: { label: 'Purge', past: 'purged', emoji: 'purge', color: colors.info },
};

export function caseContainer(record: CaseRecord) {
  const style = CASE_STYLE[record.type];
  const target = record.type === 'purge' ? `<#${record.targetId}>` : `<@${record.targetId}> · \`${record.targetTag}\``;
  const lines = [
    `${emoji('user')} **${record.type === 'purge' ? 'Channel' : 'Member'}** ${target}`,
    `${emoji('shield')} **Moderator** <@${record.moderatorId}>`,
    record.duration ? `${emoji('clock')} **Duration** ${formatDuration(record.duration)}` : null,
    record.status === 'voided' ? `${emoji('info')} **Case status** Voided` : null,
    `${emoji('list')} **Reason** ${record.reason ?? '*No reason given*'}`,
  ].filter(Boolean);

  return panel({ title: `${style.label} · Case #${record.caseId}`, emoji: style.emoji, accent: style.color })
    .addTextDisplayComponents(text(lines.join('\n')))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# ${timestamp(record.createdAt, 'f')} · ID ${record.targetId}`));
}

/** Posts a case to the mod log channel (if set). */
export async function logCase(guild: Guild, settings: GuildSettings, record: CaseRecord): Promise<void> {
  const channelId = settings.moderation.logChannelId;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isSendable()) return;
  try {
    const message = await channel.send(v2(caseContainer(record)));
    await cases.setLogMessage(guild.id, record.caseId, channel.id, message.id);
  } catch (error) {
    log.warn(`Could not post case #${record.caseId} in ${guild.id}`, error);
  }
}

/** Tells the member what happened. Best effort — DMs may be closed. */
export async function notifyMember(user: User, guild: Guild, type: CaseType, reason: string | null, duration?: number | null, record?: CaseRecord, pendingRemoval = false) {
  const style = CASE_STYLE[type];
  const lines = [
    pendingRemoval
      ? `A moderator is about to ${type === 'kick' ? 'kick' : 'ban'} you from **${guild.name}**. This case is recorded below.`
      : `You were **${style.past}** in **${guild.name}**.`,
    duration ? `${emoji('clock')} **Duration** ${formatDuration(duration)}` : null,
    `${emoji('list')} **Reason** ${reason ?? 'No reason given'}`,
    pendingRemoval ? 'Use the button below to send context to the moderators. An appeal does not automatically stop the action.' : null,
  ].filter(Boolean);
  const container = panel({ title: style.label, emoji: style.emoji, description: lines.join('\n'), accent: style.color, thumbnail: guild.iconURL() });
  if (record && ['warn', 'timeout', 'kick', 'ban'].includes(type)) container.addActionRowComponents(appealButton(guild.id, record.caseId));
  return user.send(v2(container)).then(() => true).catch(() => false);
}

/** Corrects a pre-action notice if Discord rejects the kick or ban. */
export async function notifyActionCancelled(user: User, type: 'kick' | 'ban', guild: Guild, caseId: number): Promise<void> {
  const action = type === 'kick' ? 'kick' : 'ban';
  await user.send(v2(panel({
    title: 'Action not applied',
    emoji: 'info',
    description: `The planned ${action} from **${guild.name}** did not go through. Case #${caseId} is marked voided; contact the server moderators if you already sent an appeal.`,
    accent: colors.muted,
  }))).catch(() => null);
}

/** Concise case-linked confirmation; moderation commands reply privately. */
export function actionDone(record: CaseRecord, targetName: string, dmSent: boolean | null) {
  const style = CASE_STYLE[record.type];
  const extra = dmSent === false ? `\n-# ${emoji('dm')} Couldn't DM them.` : '';
  return panel({
    title: `${targetName} was ${style.past}`,
    emoji: style.emoji,
    description: `${record.reason ? `**Reason** ${record.reason}` : '*No reason given*'}${record.duration ? ` · ${formatDuration(record.duration)}` : ''}${extra}`,
    accent: style.color,
  }).addActionRowComponents(row(button({ id: cid('case', 'view', record.caseId), label: `Case #${record.caseId}`, emoji: 'case', style: ButtonStyle.Secondary })));
}
