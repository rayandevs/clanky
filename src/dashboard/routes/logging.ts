import { PermissionFlagsBits, type Guild, type GuildMember } from 'discord.js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Clanky } from '../../client/Clanky.js';
import { IncidentModel, LoggerEventModel, type IncidentRecord, type LoggerEventRecord } from '../../database/models/index.js';
import { guilds } from '../../services/index.js';
import { LOG_CATEGORIES, LOG_EVENTS } from '../../settings/schema.js';
import { requireUser } from '../auth.js';
import { retryLoggerEvent, verifyLoggerEvidence } from '../../modules/logging/service.js';

const PAGE_SIZE = 25;
const statusSchema = z.enum(['open', 'investigating', 'resolved', 'false_alarm']);
const listQuery = z.object({
  page: z.coerce.number().int().min(0).max(10_000).default(0),
  status: statusSchema.optional(),
});
const eventQuery = z.object({
  page: z.coerce.number().int().min(0).max(10_000).default(0),
  q: z.string().trim().max(100).optional(),
  event: z.enum(LOG_EVENTS).optional(),
  category: z.enum(LOG_CATEGORIES).optional(),
  delivery: z.enum(['pending', 'sending', 'delivered', 'failed', 'not_configured']).optional(),
  incidentId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: 'Invalid date range.' });
const updateIncidentBody = z.object({
  status: statusSchema.optional(),
  note: z.string().trim().max(1000).optional(),
}).refine((value) => value.status !== undefined || Boolean(value.note), { message: 'Add a status or note.' });

interface LogAccess {
  guild: Guild;
  member: GuildMember;
  canManage: boolean;
  canViewSensitive: boolean;
}

async function logAccess(client: Clanky, request: FastifyRequest, reply: FastifyReply, manageOnly = false): Promise<LogAccess | null> {
  const { guildId } = request.params as { guildId: string };
  const guild = /^\d{17,20}$/.test(guildId) ? client.guilds.cache.get(guildId) : undefined;
  if (!guild) {
    reply.code(404).send({ error: 'not_found', message: "Clanky isn't in that server." });
    return null;
  }
  const member = guild.members.cache.get(request.session!.record.userId) ?? await guild.members.fetch(request.session!.record.userId).catch(() => null);
  if (!member) {
    reply.code(403).send({ error: 'forbidden', message: 'You must be a member of this server to view its logs.' });
    return null;
  }
  const settings = (await guilds.settings(guild.id)).logging;
  const canManage = member.permissions.has(PermissionFlagsBits.ManageGuild);
  const roleIds = new Set(member.roles.cache.keys());
  const canViewSensitive = canManage || settings.sensitiveEvidenceRoleIds.some((id) => roleIds.has(id));
  const canRead = canViewSensitive || settings.viewerRoleIds.some((id) => roleIds.has(id));
  if (manageOnly ? !canManage : !(canManage || canRead)) {
    reply.code(403).send({ error: 'forbidden', message: manageOnly ? 'You need the Manage Server permission to change incident status or retry a delivery.' : 'You do not have a role that can view server logs.' });
    return null;
  }
  return { guild, member, canManage, canViewSensitive };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function eventListItem(event: LoggerEventRecord) {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    category: event.category,
    source: event.source,
    occurredAt: event.occurredAt,
    actorId: event.actorId,
    actorAttribution: event.actorAttribution,
    targetUserId: event.targetUserId,
    channelId: event.channelId,
    roleId: event.roleId,
    messageId: event.messageId,
    summary: event.summary,
    severity: event.severity,
    riskScore: event.riskScore,
    riskReasons: event.riskReasons,
    incidentId: event.incidentId,
    evidenceHash: event.evidenceHash,
    integrityValid: verifyLoggerEvidence(event),
    delivery: event.delivery,
  };
}

function evidenceFor(event: LoggerEventRecord, canViewSensitive: boolean) {
  return {
    ...eventListItem(event),
    evidence: canViewSensitive
      ? event.evidence
      : { changedFields: event.evidence.changedFields, linkCount: event.evidence.linkCount, relatedEventIds: event.evidence.relatedEventIds, relatedMessageIds: event.evidence.relatedMessageIds },
  };
}

function incidentView(incident: IncidentRecord) {
  return {
    incidentId: incident.incidentId,
    title: incident.title,
    summary: incident.summary,
    ruleId: incident.ruleId,
    status: incident.status,
    severity: incident.severity,
    riskScore: incident.riskScore,
    firstEventAt: incident.firstEventAt,
    lastEventAt: incident.lastEventAt,
    eventCount: incident.eventCount,
    affectedUserIds: incident.affectedUserIds,
    affectedChannelIds: incident.affectedChannelIds,
    affectedRoleIds: incident.affectedRoleIds,
    actorIds: incident.actorIds,
    notes: incident.notes,
    resolvedAt: incident.resolvedAt,
  };
}

export async function loggingRoutes(app: FastifyInstance, client: Clanky): Promise<void> {
  app.addHook('preHandler', requireUser);

  app.get('/api/guilds/:guildId/logging/context', async (request, reply) => {
    const access = await logAccess(client, request, reply);
    if (!access) return;
    return {
      guild: { id: access.guild.id, name: access.guild.name, icon: access.guild.iconURL({ size: 96 }) },
      canManage: access.canManage,
      canViewSensitive: access.canViewSensitive,
      loggingEnabled: (await guilds.settings(access.guild.id)).logging.enabled,
    };
  });

  app.get('/api/guilds/:guildId/incidents', { config: { rateLimit: { max: 40, timeWindow: 60_000 } } }, async (request, reply) => {
    const access = await logAccess(client, request, reply);
    if (!access) return;
    const query = listQuery.parse(request.query);
    const filter = { guildId: access.guild.id, ...(query.status ? { status: query.status } : {}) };
    const [total, entries] = await Promise.all([
      IncidentModel.countDocuments(filter),
      IncidentModel.find(filter).sort({ lastEventAt: -1 }).skip(query.page * PAGE_SIZE).limit(PAGE_SIZE).lean<IncidentRecord[]>(),
    ]);
    return { total, page: query.page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), entries: entries.map(incidentView) };
  });

  app.get('/api/guilds/:guildId/incidents/:incidentId', async (request, reply) => {
    const access = await logAccess(client, request, reply);
    if (!access) return;
    const { incidentId } = request.params as { incidentId: string };
    const incident = await IncidentModel.findOne({ guildId: access.guild.id, incidentId }).lean<IncidentRecord | null>();
    if (!incident) return reply.code(404).send({ error: 'not_found', message: 'That incident is no longer available.' });
    const events = await LoggerEventModel.find({ guildId: access.guild.id, incidentId }).sort({ occurredAt: 1 }).limit(200).lean<LoggerEventRecord[]>();
    return { incident: incidentView(incident), events: events.map((event) => evidenceFor(event, access.canViewSensitive)), canManage: access.canManage, canViewSensitive: access.canViewSensitive };
  });

  app.patch('/api/guilds/:guildId/incidents/:incidentId', { config: { rateLimit: { max: 20, timeWindow: 60_000 } } }, async (request, reply) => {
    const access = await logAccess(client, request, reply, true);
    if (!access) return;
    const { incidentId } = request.params as { incidentId: string };
    const body = updateIncidentBody.parse(request.body);
    const incident = await IncidentModel.findOne({ guildId: access.guild.id, incidentId });
    if (!incident) return reply.code(404).send({ error: 'not_found', message: 'That incident is no longer available.' });
    const now = new Date();
    const update: Record<string, unknown> = {};
    let note: IncidentRecord['notes'][number];
    if (body.status) {
      update.status = body.status;
      update.resolvedAt = ['resolved', 'false_alarm'].includes(body.status) ? now : null;
      note = { actorId: access.member.id, action: 'status', status: body.status, text: body.note || `Marked as ${body.status.replace('_', ' ')}.`, createdAt: now };
    } else note = { actorId: access.member.id, action: 'note', text: body.note!, createdAt: now };
    await IncidentModel.updateOne(
      { guildId: access.guild.id, incidentId },
      { $set: update, $push: { notes: { $each: [note], $slice: -20 } } },
    );
    const saved = await IncidentModel.findOne({ guildId: access.guild.id, incidentId }).lean<IncidentRecord>();
    return { incident: saved ? incidentView(saved) : null };
  });

  app.get('/api/guilds/:guildId/logs', { config: { rateLimit: { max: 60, timeWindow: 60_000 } } }, async (request, reply) => {
    const access = await logAccess(client, request, reply);
    if (!access) return;
    const query = eventQuery.parse(request.query);
    const filter: Record<string, unknown> = { guildId: access.guild.id };
    if (query.event) filter.eventType = query.event;
    if (query.category) filter.category = query.category;
    if (query.delivery) filter['delivery.status'] = query.delivery;
    if (query.incidentId) filter.incidentId = query.incidentId;
    if (query.from || query.to) filter.occurredAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
    if (query.q) {
      const q = query.q.trim();
      const escaped = escapeRegex(q);
      filter.$or = [
        { eventId: new RegExp(`^${escaped}`, 'i') },
        { actorId: q }, { targetUserId: q }, { channelId: q }, { roleId: q },
        { messageId: q }, { 'evidence.relatedMessageIds': q },
        { summary: new RegExp(escaped, 'i') },
      ];
    }
    const [total, entries] = await Promise.all([
      LoggerEventModel.countDocuments(filter),
      LoggerEventModel.find(filter).sort({ occurredAt: -1 }).skip(query.page * PAGE_SIZE).limit(PAGE_SIZE).lean<LoggerEventRecord[]>(),
    ]);
    return { total, page: query.page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), entries: entries.map(eventListItem), canViewSensitive: access.canViewSensitive };
  });

  app.get('/api/guilds/:guildId/logs/:eventId', async (request, reply) => {
    const access = await logAccess(client, request, reply);
    if (!access) return;
    const { eventId } = request.params as { eventId: string };
    const event = await LoggerEventModel.findOne({ guildId: access.guild.id, eventId }).lean<LoggerEventRecord | null>();
    if (!event) return reply.code(404).send({ error: 'not_found', message: 'That event is no longer available.' });
    return evidenceFor(event, access.canViewSensitive);
  });

  app.post('/api/guilds/:guildId/logs/:eventId/retry', { config: { rateLimit: { max: 5, timeWindow: 60_000 } } }, async (request, reply) => {
    const access = await logAccess(client, request, reply, true);
    if (!access) return;
    const { eventId } = request.params as { eventId: string };
    const event = await LoggerEventModel.findOne({ guildId: access.guild.id, eventId }).lean<LoggerEventRecord | null>();
    if (!event) return reply.code(404).send({ error: 'not_found', message: 'That event is no longer available.' });
    if (event.delivery.status !== 'failed' && event.delivery.status !== 'not_configured') return reply.code(409).send({ error: 'conflict', message: 'Only undelivered log events can be retried.' });
    const retried = await retryLoggerEvent(client, access.guild.id, eventId);
    if (!retried) return reply.code(409).send({ error: 'unavailable', message: 'Choose a log channel for this category before retrying.' });
    const updated = await LoggerEventModel.findOne({ guildId: access.guild.id, eventId }).lean<LoggerEventRecord>();
    return { event: updated ? eventListItem(updated) : null };
  });
}
