import { PermissionFlagsBits } from 'discord.js';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Clanky } from '../../client/Clanky.js';
import { moderationBlocker } from '../../core/permissions.js';
import { CaseModel, ModerationAppealModel, ModerationReportModel, type CaseRecord, type ModerationAppealRecord, type ModerationReportRecord } from '../../database/models/index.js';
import { caseContainer, notifyMember, logCase } from '../../modules/moderation/shared.js';
import { beginReportAction, finishReportAction, reviewAppeal, reviewReport } from '../../modules/moderation/reviewService.js';
import { deleteReportedMessage } from '../../modules/moderation/reviewActions.js';
import { managedGuild } from '../access.js';
import { requireUser } from '../auth.js';
import { cases, guilds } from '../../services/index.js';

const PAGE_SIZE = 20;

async function requireModerationEnabled(guildId: string, reply: FastifyReply) {
  const settings = await guilds.settings(guildId);
  if (settings.moderation.enabled) return settings;
  reply.code(409).send({ error: 'disabled', message: 'Moderation is turned off for this server.' });
  return null;
}

export async function moderationRoutes(app: FastifyInstance, client: Clanky) {
  app.addHook('preHandler', requireUser);

  app.get('/api/guilds/:guildId/moderation/reviews', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const access = await managedGuild(client, request, reply, true);
    if (!access) return;
    const query = z.object({ kind: z.enum(['reports', 'appeals', 'cases']), status: z.string().default('open'), q: z.string().trim().max(80).default(''), page: z.coerce.number().int().min(0).max(1000).default(0) }).safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid', message: 'Choose a valid review filter.' });
    const { kind, status, q, page } = query.data;
    if (kind === 'cases') {
      if (!['all', 'active', 'voided'].includes(status)) return reply.code(400).send({ error: 'invalid', message: 'Unknown case status.' });
      const terms: object[] = [];
      if (status === 'active') terms.push({ $or: [{ status: 'active' }, { status: { $exists: false } }] });
      else if (status !== 'all') terms.push({ status });
      if (q) {
        const id = /^#?\d+$/.test(q) ? Number(q.replace(/^#/, '')) : null;
        terms.push(id !== null ? { caseId: id } : { $or: [{ targetTag: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { reason: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }] });
      }
      const filter = { guildId: access.guild.id, ...(terms.length ? { $and: terms } : {}) };
      const [entries, total] = await Promise.all([CaseModel.find(filter).sort({ caseId: -1 }).skip(page * PAGE_SIZE).limit(PAGE_SIZE).lean<CaseRecord[]>(), CaseModel.countDocuments(filter)]);
      return { kind, page, pageSize: PAGE_SIZE, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), entries };
    }
    const allowed = kind === 'reports' ? ['open', 'in_review', 'processing', 'resolved', 'dismissed'] : ['submitted', 'reviewing', 'accepted', 'denied'];
    if (status !== 'all' && !allowed.includes(status)) return reply.code(400).send({ error: 'invalid', message: 'Unknown review status.' });
    if (kind === 'reports') {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const numericId = /^\d+$/.test(q) && Number.isSafeInteger(Number(q)) ? Number(q) : null;
      const filter = {
        guildId: access.guild.id,
        ...(status === 'all' ? {} : { status: status as ModerationReportRecord['status'] }),
        ...(q ? { $or: [
          { reporterId: { $regex: escaped, $options: 'i' } },
          { targetId: { $regex: escaped, $options: 'i' } },
          { reason: { $regex: escaped, $options: 'i' } },
          { details: { $regex: escaped, $options: 'i' } },
          { contentSnapshot: { $regex: escaped, $options: 'i' } },
          ...(numericId === null ? [] : [{ messageId: q }]),
        ] } : {}),
      };
      const [entries, total, open, reviewing] = await Promise.all([
        ModerationReportModel.find(filter).sort({ createdAt: -1 }).skip(page * PAGE_SIZE).limit(PAGE_SIZE).lean<ModerationReportRecord[]>(),
        ModerationReportModel.countDocuments(filter),
        ModerationReportModel.countDocuments({ guildId: access.guild.id, status: { $in: ['open', 'processing'] } }),
        ModerationReportModel.countDocuments({ guildId: access.guild.id, status: 'in_review' }),
      ]);
      return { kind, page, pageSize: PAGE_SIZE, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), stats: { open, reviewing }, entries };
    }
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const numericCaseId = /^\d+$/.test(q) && Number.isSafeInteger(Number(q)) ? Number(q) : null;
    const appealFilter = {
      guildId: access.guild.id,
      ...(status === 'all' ? {} : { status: status as ModerationAppealRecord['status'] }),
      ...(q ? { $or: [
        { targetId: { $regex: escaped, $options: 'i' } },
        { statement: { $regex: escaped, $options: 'i' } },
        ...(numericCaseId === null ? [] : [{ caseId: numericCaseId }]),
      ] } : {}),
    };
    const [entries, total, submitted, reviewing] = await Promise.all([
      ModerationAppealModel.find(appealFilter).sort({ createdAt: -1 }).skip(page * PAGE_SIZE).limit(PAGE_SIZE).lean<ModerationAppealRecord[]>(),
      ModerationAppealModel.countDocuments(appealFilter),
      ModerationAppealModel.countDocuments({ guildId: access.guild.id, status: 'submitted' }),
      ModerationAppealModel.countDocuments({ guildId: access.guild.id, status: 'reviewing' }),
    ]);
    const casesById = new Map<number, CaseRecord>();
    const linked = await CaseModel.find({ guildId: access.guild.id, caseId: { $in: entries.map((entry) => entry.caseId) } }).lean<CaseRecord[]>();
    for (const record of linked) casesById.set(record.caseId, record);
    return {
      kind,
      page,
      pageSize: PAGE_SIZE,
      total,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      stats: { open: submitted, reviewing },
      entries: entries.map((entry) => {
        const record = casesById.get(entry.caseId);
        return { ...entry, case: record ? { type: record.type, reason: record.reason, status: record.status ?? 'active', createdAt: record.createdAt } : null };
      }),
    };
  });

  app.post('/api/guilds/:guildId/moderation/reports/:reportId/review', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const access = await managedGuild(client, request, reply, true);
    if (!access) return;
    const parsed = z.object({ action: z.enum(['claim', 'resolve', 'dismiss', 'delete', 'timeout']), note: z.string().trim().max(500).default('') }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', message: 'Choose a valid report action and a note under 500 characters.' });
    const { reportId } = request.params as { reportId: string };
    const current = await ModerationReportModel.findOne({ guildId: access.guild.id, reportId }).lean<ModerationReportRecord>();
    if (!current) return reply.code(404).send({ error: 'not_found', message: 'That report has expired or was removed.' });
    const settings = await requireModerationEnabled(access.guild.id, reply);
    if (!settings) return;
    const { action, note } = parsed.data;
    if (action === 'claim' || action === 'resolve' || action === 'dismiss') {
      const updated = await reviewReport({ guildId: access.guild.id, reportId, reviewerId: access.member.id, status: action === 'claim' ? 'in_review' : action === 'dismiss' ? 'dismissed' : 'resolved', note: note || null });
      if (!updated) return reply.code(409).send({ error: 'conflict', message: 'Another moderator already changed this report.' });
      return { ok: true, report: updated };
    }
    if (action === 'delete' && !access.member.permissions.has(PermissionFlagsBits.ManageMessages)) return reply.code(403).send({ error: 'forbidden', message: 'You need Manage Messages to delete a reported message.' });
    if (action === 'timeout' && !access.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return reply.code(403).send({ error: 'forbidden', message: 'You need Timeout Members to time out a member.' });
    const claimed = await beginReportAction(access.guild.id, reportId, access.member.id);
    if (!claimed) return reply.code(409).send({ error: 'conflict', message: 'Another moderator already started or finished this report.' });
    try {
      if (action === 'delete') {
        const deletion = await deleteReportedMessage(access.guild, claimed.channelId, claimed.messageId);
        if (deletion.status === 'failed') {
          await finishReportAction({ guildId: access.guild.id, reportId, reviewerId: access.member.id, processingToken: claimed.processingToken!, status: 'in_review', note: note || null });
          return reply.code(409).send({ error: 'action_failed', message: deletion.message });
        }
        const updated = await finishReportAction({ guildId: access.guild.id, reportId, reviewerId: access.member.id, processingToken: claimed.processingToken!, status: 'resolved', note: [note, deletion.status === 'deleted' ? 'Reported message deleted.' : 'Reported message was already gone.'].filter(Boolean).join('\n') });
        if (!updated) return reply.code(409).send({ error: 'conflict', message: 'The message action finished, but this report was reassigned while processing. Check the queue before taking another action.' });
        return { ok: true, report: updated };
      }
      const member = await access.guild.members.fetch(claimed.targetId).catch(() => null);
      const blocker = member ? moderationBlocker(access.member, member, access.guild.members.me!) : null;
      if (!member?.moderatable || blocker) {
        await finishReportAction({ guildId: access.guild.id, reportId, reviewerId: access.member.id, processingToken: claimed.processingToken!, status: 'in_review', note });
        return reply.code(400).send({ error: 'hierarchy', message: blocker ?? "I can't time out that member." });
      }
      const reason = `Reported message: ${claimed.reason}`;
      const record = await cases.create({ guildId: access.guild.id, type: 'timeout', targetId: member.id, targetTag: member.user.tag, moderatorId: access.member.id, reason, duration: 3_600_000, reportId });
      try {
        await member.timeout(3_600_000, `${access.member.user.tag}: ${reason}`);
      } catch {
        const voided = await cases.setStatus(access.guild.id, record.caseId, 'voided', { moderatorId: access.member.id, text: 'Voided: Discord did not apply the report timeout.' }).catch(() => null);
        await logCase(access.guild, settings, voided ?? record);
        await finishReportAction({ guildId: access.guild.id, reportId, reviewerId: access.member.id, processingToken: claimed.processingToken!, status: 'in_review', note: note || null });
        return reply.code(400).send({ error: 'action_failed', message: "I couldn't apply that timeout. The report is still in review; check my permissions and the member's role." });
      }
      await logCase(access.guild, settings, record);
      if (settings.moderation.dmOnAction) await notifyMember(member.user, access.guild, 'timeout', reason, 3_600_000, record);
      const updated = await finishReportAction({ guildId: access.guild.id, reportId, reviewerId: access.member.id, processingToken: claimed.processingToken!, status: 'resolved', note: `Timed out for 1h (case #${record.caseId}).${note ? ` ${note}` : ''}`, caseId: record.caseId });
      if (!updated) return reply.code(409).send({ error: 'conflict', message: `The timeout and case #${record.caseId} were recorded, but this report was reassigned while processing. Check the queue.` });
      return { ok: true, report: updated, caseId: record.caseId };
    } catch (error) {
      await finishReportAction({ guildId: access.guild.id, reportId, reviewerId: access.member.id, processingToken: claimed.processingToken!, status: 'in_review', note: note || null }).catch(() => null);
      throw error;
    }
  });

  app.post('/api/guilds/:guildId/moderation/appeals/:appealId/review', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const access = await managedGuild(client, request, reply, true);
    if (!access) return;
    const parsed = z.object({ status: z.enum(['reviewing', 'accepted', 'denied']), note: z.string().trim().max(500).default('') }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', message: 'Choose a valid appeal status and a note under 500 characters.' });
    if (!await requireModerationEnabled(access.guild.id, reply)) return;
    const { appealId } = request.params as { appealId: string };
    const appeal = await reviewAppeal({ guildId: access.guild.id, appealId, reviewerId: access.member.id, status: parsed.data.status, note: parsed.data.note || null });
    if (!appeal) return reply.code(409).send({ error: 'conflict', message: 'Another moderator already changed this appeal.' });
    if (parsed.data.status === 'accepted' || parsed.data.status === 'denied') {
      const label = parsed.data.status === 'accepted' ? 'Appeal accepted' : 'Appeal denied';
      await cases.addNote(access.guild.id, appeal.caseId, access.member.id, `${label}${parsed.data.note ? `: ${parsed.data.note}` : '.'}`);
    }
    return { ok: true, appeal };
  });

  app.post('/api/guilds/:guildId/moderation/cases/:caseId/notes', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const access = await managedGuild(client, request, reply, true);
    if (!access) return;
    if (!await requireModerationEnabled(access.guild.id, reply)) return;
    const { caseId: rawId } = request.params as { caseId: string };
    const caseId = Number(rawId);
    if (!Number.isSafeInteger(caseId) || caseId < 1) return reply.code(400).send({ error: 'invalid', message: 'Choose a valid case number.' });
    const parsed = z.object({ text: z.string().trim().min(1).max(1000) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', message: 'Add a note up to 1,000 characters.' });
    const record = await cases.addNote(access.guild.id, caseId, access.member.id, parsed.data.text);
    if (!record) return reply.code(404).send({ error: 'not_found', message: 'That case could not be found.' });
    return { ok: true, case: record };
  });

  app.post('/api/guilds/:guildId/moderation/cases/:caseId/status', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const access = await managedGuild(client, request, reply, true);
    if (!access) return;
    if (!await requireModerationEnabled(access.guild.id, reply)) return;
    const caseId = Number((request.params as { caseId: string }).caseId);
    if (!Number.isSafeInteger(caseId) || caseId < 1) return reply.code(400).send({ error: 'invalid', message: 'Choose a valid case number.' });
    const parsed = z.object({ status: z.enum(['active', 'voided']), reason: z.string().trim().min(5).max(500) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', message: 'Add a reason between 5 and 500 characters.' });
    const record = await cases.setStatus(access.guild.id, caseId, parsed.data.status, { moderatorId: access.member.id, text: `${parsed.data.status === 'voided' ? 'Voided' : 'Reopened'}: ${parsed.data.reason}` });
    if (!record) return reply.code(404).send({ error: 'not_found', message: 'That case could not be found.' });
    if (record.logChannelId && record.logMessageId) {
      const channel = access.guild.channels.cache.get(record.logChannelId);
      if (channel?.isTextBased()) await channel.messages.edit(record.logMessageId, { components: [caseContainer(record)] }).catch(() => null);
    }
    return { ok: true, case: record };
  });
}
