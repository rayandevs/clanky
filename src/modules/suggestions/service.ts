import { createHash } from 'node:crypto';
import { ButtonStyle, PermissionFlagsBits, ThreadAutoArchiveDuration, type GuildMember } from 'discord.js';
import type { Clanky } from '../../client/Clanky.js';
import { cid } from '../../core/customId.js';
import { createLogger } from '../../core/logger.js';
import { timestamp } from '../../core/time.js';
import { GuildModel, SuggestionModel, type SuggestionRecord, type SuggestionStatus } from '../../database/models/index.js';
import { guilds } from '../../services/index.js';
import type { GuildSettings } from '../../settings/schema.js';
import { isSuggestionAnonymous } from './privacy.js';
import { button, divider, panel, row, text, truncate, v2 } from '../../ui/components.js';
import { emoji, type EmojiKey } from '../../ui/emoji.js';
import { colors } from '../../ui/theme.js';

const log = createLogger('suggestions');

export const SUGGESTION_STATUSES: Record<SuggestionStatus, { label: string; emoji: EmojiKey; color?: number }> = {
  pending: { label: 'Open for votes', emoji: 'loading' },
  under_review: { label: 'Under review', emoji: 'shield', color: colors.warning },
  planned: { label: 'Planned', emoji: 'loading', color: colors.info },
  in_progress: { label: 'In progress', emoji: 'loading', color: colors.info },
  approved: { label: 'Approved', emoji: 'approve', color: colors.success },
  denied: { label: 'Declined', emoji: 'deny', color: colors.error },
  implemented: { label: 'Implemented', emoji: 'rocket', color: colors.info },
};
export const SUGGESTION_STATUS_KEYS = Object.keys(SUGGESTION_STATUSES) as SuggestionStatus[];

export const OPEN_SUGGESTION_STATUSES: SuggestionStatus[] = ['pending', 'under_review', 'planned', 'in_progress'];

const isPosted = (record: SuggestionRecord) => Boolean(record.messageId) && (!record.postStatus || record.postStatus === 'posted');

export function renderSuggestion(s: SuggestionRecord, settings: GuildSettings) {
  const up = s.upvotes.length;
  const down = s.downvotes.length;
  const status = SUGGESTION_STATUSES[s.status];
  const anonymous = isSuggestionAnonymous(s.anonymous);
  const container = panel({
    title: `Suggestion #${s.suggestionId}`,
    emoji: 'suggestion',
    description: `**${s.title}**\n${s.content}`,
    accent: status.color ?? settings.general.accentColor,
  })
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          `${emoji(status.emoji)} **${status.label}**`,
          [
            s.category ? `**Category** · ${s.category}` : null,
            s.reviewNote ? `**Reviewer note**\n> ${truncate(s.reviewNote, 300)}` : null,
          ].filter(Boolean).join('\n'),
          `-# ${anonymous ? 'Submitted anonymously' : `Suggested by <@${s.authorId}>`} · ${timestamp(s.createdAt, 'R')}`,
        ].filter(Boolean).join('\n\n'),
      ),
    );
  const closed = !OPEN_SUGGESTION_STATUSES.includes(s.status);
  container.addActionRowComponents(
    row(
      button({ id: cid('sg', 'up', s.suggestionId), label: `Upvote · ${up}`, emoji: 'upvote', style: ButtonStyle.Success, disabled: closed }),
      button({ id: cid('sg', 'down', s.suggestionId), label: `Downvote · ${down}`, emoji: 'downvote', style: ButtonStyle.Danger, disabled: closed }),
      button({ id: cid('sg', 'review', s.suggestionId), label: 'Review', emoji: 'shield' }),
    ),
  );
  return container;
}

export function isSuggestionReviewer(member: GuildMember, settings: GuildSettings): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild) || settings.suggestions.reviewerRoleIds.some((id) => member.roles.cache.has(id));
}

export class SuggestionActionError extends Error {
  constructor(readonly code: 'not_found' | 'conflict' | 'not_posted' | 'busy', message: string) {
    super(message);
  }
}

function suggestionNonce(guildId: string, suggestionId: number): string {
  return createHash('sha256').update(`${guildId}:${suggestionId}`).digest('hex').slice(0, 24);
}

/** Publish a queued/failed record once; failures stay visible for staff recovery. */
export async function publishSuggestion(client: Clanky, guildId: string, suggestionId: number): Promise<SuggestionRecord> {
  const stalePosting = new Date(Date.now() - 10 * 60_000);
  const record = await SuggestionModel.findOneAndUpdate(
    {
      guildId,
      suggestionId,
      $or: [
        { postStatus: { $in: ['queued', 'failed'] } },
        { postStatus: 'posting', postAttemptedAt: { $lt: stalePosting } },
        { postStatus: { $exists: false }, messageId: null },
      ],
    },
    { $set: { postStatus: 'posting', postAttemptedAt: new Date(), postError: null } },
    { returnDocument: 'after' },
  ).lean<SuggestionRecord>();
  if (!record) {
    const current = await SuggestionModel.findOne({ guildId, suggestionId }).lean<SuggestionRecord>();
    if (!current) throw new SuggestionActionError('not_found', 'That suggestion no longer exists.');
    if (current.postStatus === 'posted') return current;
    throw new SuggestionActionError('busy', 'A post attempt is already in progress. Try again shortly.');
  }

  try {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(record.channelId);
    if (!guild || !channel?.isSendable() || !channel.isTextBased()) throw new Error('The configured suggestions channel is unavailable or cannot receive messages.');
    const settings = await guilds.settings(guildId);
    const message = await channel.send({
      ...v2(renderSuggestion(record, settings)),
      allowedMentions: { parse: [] },
      nonce: suggestionNonce(guildId, suggestionId),
      enforceNonce: true,
    });
    let threadId: string | null = null;
    if (settings.suggestions.createThreads && 'startThread' in message) {
      const thread = await message.startThread({ name: truncate(`💡 ${record.title}`, 100), autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays }).catch(() => null);
      threadId = thread?.id ?? null;
    }
    const posted = await SuggestionModel.findOneAndUpdate(
      { guildId, suggestionId, postStatus: 'posting' },
      { $set: { messageId: message.id, threadId, postStatus: 'posted', postError: null } },
      { returnDocument: 'after' },
    ).lean<SuggestionRecord>();
    if (!posted) throw new Error('The message was sent but its record could not be finalized. Retry is safe.');
    return posted;
  } catch (error) {
    const message = error instanceof Error ? truncate(error.message, 300) : 'Discord did not accept the suggestion post.';
    await SuggestionModel.updateOne({ guildId, suggestionId }, { $set: { postStatus: 'failed', postError: message } });
    throw new Error(message);
  }
}

/** Refresh the public Discord post from the canonical database record. */
export async function syncSuggestionPost(client: Clanky, record: SuggestionRecord, settings: GuildSettings): Promise<boolean> {
  if (!isPosted(record) || !record.messageId) return false;
  const guild = client.guilds.cache.get(record.guildId);
  const channel = guild?.channels.cache.get(record.channelId);
  if (!channel?.isTextBased() || !('messages' in channel)) return false;
  const message = await channel.messages.fetch(record.messageId).catch(() => null);
  if (!message) return false;
  await message.edit({ components: [renderSuggestion(record, settings)], allowedMentions: { parse: [] } });
  return true;
}

/** Shared review transition used by Discord and dashboard; appends an immutable event. */
export async function reviewSuggestion(
  client: Clanky,
  guildId: string,
  suggestionId: number,
  reviewerId: string,
  status: SuggestionStatus,
  note: string | null,
  settings: GuildSettings,
): Promise<{ record: SuggestionRecord; changed: boolean; postSynced: boolean }> {
  const current = await SuggestionModel.findOne({ guildId, suggestionId }).lean<SuggestionRecord>();
  if (!current) throw new SuggestionActionError('not_found', 'That suggestion was deleted.');
  if (!isPosted(current)) throw new SuggestionActionError('not_posted', 'Post or recover the suggestion before reviewing it.');
  const changed = current.status !== status || (current.reviewNote ?? null) !== note;
  if (!changed) return { record: current, changed: false, postSynced: true };
  const updated = await SuggestionModel.findOneAndUpdate(
    { guildId, suggestionId, status: current.status, $or: [{ postStatus: 'posted' }, { postStatus: { $exists: false }, messageId: { $ne: null } }] },
    {
      $set: { status, reviewNote: note, reviewerId },
      $push: { reviewHistory: { $each: [{ status, note, reviewerId, changedAt: new Date() }], $slice: -100 } },
    },
    { returnDocument: 'after' },
  ).lean<SuggestionRecord>();
  if (!updated) throw new SuggestionActionError('conflict', 'Another reviewer changed this suggestion. Refresh and try again.');

  let postSynced = false;
  try {
    postSynced = await syncSuggestionPost(client, updated, settings);
  } catch (error) {
    log.warn(`Could not refresh Discord post for suggestion #${suggestionId}`, error);
  }
  if (current.status !== status) await notifySuggestionAuthor(client, updated, settings).catch(() => undefined);
  return { record: updated, changed: true, postSynced };
}

export async function notifySuggestionAuthor(client: Clanky, record: SuggestionRecord, settings: GuildSettings): Promise<void> {
  const author = await client.users.fetch(record.authorId).catch(() => null);
  if (!author) return;
  const info = SUGGESTION_STATUSES[record.status];
  await author.send(v2(panel({
    title: `Your suggestion is ${info.label.toLowerCase()}`,
    emoji: info.emoji,
    description: `**${record.title}** in **${client.guilds.cache.get(record.guildId)?.name ?? 'your server'}**${record.reviewNote ? `\n> ${record.reviewNote}` : ''}`,
    accent: info.color ?? settings.general.accentColor,
  }))).catch(() => null);
}

/** Toggle or move a vote atomically, ensuring a member is counted once. */
export async function voteSuggestion(guildId: string, suggestionId: number, userId: string, vote: 'up' | 'down'): Promise<SuggestionRecord> {
  const current = await SuggestionModel.findOne({ guildId, suggestionId, status: { $in: OPEN_SUGGESTION_STATUSES }, $or: [{ postStatus: 'posted' }, { postStatus: { $exists: false }, messageId: { $ne: null } }] }).lean<SuggestionRecord>();
  if (!current) throw new SuggestionActionError('not_found', 'That suggestion is closed or could not be found.');
  const [mine, other] = vote === 'up' ? (['upvotes', 'downvotes'] as const) : (['downvotes', 'upvotes'] as const);
  const update = current[mine].includes(userId)
    ? { $pull: { [mine]: userId } }
    : { $addToSet: { [mine]: userId }, $pull: { [other]: userId } };
  const updated = await SuggestionModel.findOneAndUpdate(
    { guildId, suggestionId, status: { $in: OPEN_SUGGESTION_STATUSES }, $or: [{ postStatus: 'posted' }, { postStatus: { $exists: false }, messageId: { $ne: null } }] },
    update,
    { returnDocument: 'after' },
  ).lean<SuggestionRecord>();
  if (!updated) throw new SuggestionActionError('conflict', 'Voting closed while your vote was being saved.');
  return updated;
}

async function deliverSuggestionDigest(client: Clanky, guildId: string): Promise<void> {
  const settings = await guilds.settings(guildId);
  const intervalHours = settings.suggestions.digestIntervalHours;
  if (!settings.suggestions.enabled || !intervalHours) return;
  const state = await guilds.get(guildId);
  const now = new Date();
  if (state.meta.suggestionsDigestAt && now.getTime() - state.meta.suggestionsDigestAt.getTime() < intervalHours * 3_600_000) return;
  const pending = await SuggestionModel.find({ guildId, status: 'pending', $or: [{ postStatus: 'posted' }, { postStatus: { $exists: false }, messageId: { $ne: null } }] }).sort({ createdAt: 1 }).limit(50).lean<SuggestionRecord[]>();
  if (!pending.length) return;
  const guild = client.guilds.cache.get(guildId);
  const channelId = settings.suggestions.digestChannelId ?? settings.suggestions.channelId;
  const channel = channelId ? guild?.channels.cache.get(channelId) : null;
  if (!channel?.isSendable() || !channel.isTextBased()) return;
  const lines = pending.slice(0, 10).map((item) => {
    const votes = item.upvotes.length + item.downvotes.length;
    return `• **#${item.suggestionId} ${truncate(item.title, 90)}** · ${votes} vote${votes === 1 ? '' : 's'} · <t:${Math.floor(item.createdAt.getTime() / 1000)}:R>`;
  });
  const more = pending.length > lines.length ? `\n…and ${pending.length - lines.length} more waiting.` : '';
  await channel.send({ content: `💡 **Suggestions digest** · ${pending.length} idea${pending.length === 1 ? '' : 's'} awaiting review\n${lines.join('\n')}${more}`, allowedMentions: { parse: [] } });
  await guilds.setMeta(guildId, { suggestionsDigestAt: now });
}

export function startSuggestionDigest(client: Clanky): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const activeGuilds = await GuildModel.find({ active: true }).select({ guildId: 1 }).lean<Array<{ guildId: string }>>();
      for (const { guildId } of activeGuilds) {
        try {
          await deliverSuggestionDigest(client, guildId);
        } catch (error) {
          log.warn(`Could not send suggestion digest for ${guildId}`, error);
        }
      }
    } catch (error) {
      log.warn('Suggestion digest scan failed', error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 15 * 60_000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}


/** Recheck server-configured submission limits at command time and modal submit time. */
export async function getSubmissionBlockReason(guildId: string, authorId: string, settings: GuildSettings['suggestions']): Promise<string | null> {
  if (settings.cooldownSeconds > 0) {
    const latest = await SuggestionModel.findOne({ guildId, authorId }).sort({ createdAt: -1 }).select({ createdAt: 1 }).lean();
    const remaining = latest ? settings.cooldownSeconds * 1000 - (Date.now() - latest.createdAt.getTime()) : 0;
    if (remaining > 0) return `Please wait **${Math.ceil(remaining / 1000)} seconds** before submitting another suggestion.`;
  }
  if (settings.maxOpenPerUser > 0) {
    const open = await SuggestionModel.countDocuments({ guildId, authorId, status: { $in: OPEN_SUGGESTION_STATUSES } });
    if (open >= settings.maxOpenPerUser) return `You already have **${open} open suggestions**. Wait for one to be reviewed before submitting another.`;
  }
  return null;
}
